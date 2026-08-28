import json
import logging
import requests
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from .models import Webhook, WebhookLog

logger = logging.getLogger(__name__)


class WebhookService:
    """Manages webhook configuration, triggering, and delivery tracking"""

    EVENT_TYPES = [
        'campaign.started',
        'campaign.completed',
        'campaign.paused',
        'lead.created',
        'email.sent',
        'email.opened',
        'email.clicked',
        'email.bounced',
        'email.failed',
        'unsubscribe.created',
    ]

    def __init__(self):
        self.timeout = 30  # seconds
        self.max_retries = 3

    def trigger(self, event_type, data=None):
        """
        Trigger all webhooks subscribed to a given event type.
        Returns list of delivery results.
        """
        if data is None:
            data = {}

        if event_type not in self.EVENT_TYPES:
            logger.warning("Unknown event type: %s", event_type)
            return []

        webhooks = Webhook.objects.filter(
            event_type=event_type,
            is_active=True,
        )

        results = []
        for webhook in webhooks:
            result = self._deliver(webhook, event_type, data)
            results.append(result)

        return results

    def _deliver(self, webhook, event_type, data):
        """Deliver a webhook payload to a single endpoint"""
        payload = {
            'event': event_type,
            'timestamp': timezone.now().isoformat(),
            'data': data,
        }

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'MailBot-Webhook/1.0',
        }

        # Add custom headers if configured
        if webhook.headers:
            try:
                custom_headers = json.loads(webhook.headers)
                headers.update(custom_headers)
            except (json.JSONDecodeError, TypeError):
                pass

        # Add secret header for verification
        secret = webhook.secret or settings.SECRET_KEY
        if secret:
            headers['X-Webhook-Secret'] = secret

        attempt = 0
        last_error = None
        status_code = None
        response_body = None

        while attempt < self.max_retries:
            attempt += 1
            try:
                response = requests.post(
                    webhook.url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )
                status_code = response.status_code
                response_body = response.text[:1000]  # Truncate long responses

                if 200 <= status_code < 300:
                    # Success
                    self._log_delivery(
                        webhook=webhook,
                        event_type=event_type,
                        payload=payload,
                        status_code=status_code,
                        response_body=response_body,
                        success=True,
                        attempt=attempt,
                    )
                    logger.info(
                        "Webhook delivered to %s (event: %s, status: %d)",
                        webhook.url, event_type, status_code
                    )
                    return {
                        'success': True,
                        'webhook_id': webhook.pk,
                        'url': webhook.url,
                        'status_code': status_code,
                        'attempt': attempt,
                    }
                else:
                    last_error = f"HTTP {status_code}: {response_body}"
                    logger.warning(
                        "Webhook delivery failed (attempt %d/%d) to %s: %s",
                        attempt, self.max_retries, webhook.url, last_error
                    )

            except requests.exceptions.Timeout:
                last_error = 'Connection timeout'
                logger.warning(
                    "Webhook timeout (attempt %d/%d) to %s",
                    attempt, self.max_retries, webhook.url
                )
            except requests.exceptions.ConnectionError:
                last_error = 'Connection error'
                logger.warning(
                    "Webhook connection error (attempt %d/%d) to %s",
                    attempt, self.max_retries, webhook.url
                )
            except Exception as e:
                last_error = str(e)
                logger.error(
                    "Webhook error (attempt %d/%d) to %s: %s",
                    attempt, self.max_retries, webhook.url, last_error
                )

        # All retries failed
        self._log_delivery(
            webhook=webhook,
            event_type=event_type,
            payload=payload,
            status_code=status_code or 0,
            response_body=last_error,
            success=False,
            attempt=attempt,
        )

        logger.error(
            "Webhook permanently failed to %s (event: %s): %s",
            webhook.url, event_type, last_error
        )
        return {
            'success': False,
            'webhook_id': webhook.pk,
            'url': webhook.url,
            'error': last_error,
            'attempt': attempt,
        }

    def _log_delivery(self, webhook, event_type, payload, status_code,
                      response_body, success, attempt):
        """Log a webhook delivery attempt"""
        try:
            WebhookLog.objects.create(
                webhook=webhook,
                event_type=event_type,
                payload=payload,
                status_code=status_code,
                response=response_body,
                success=success,
                attempt=attempt,
            )
        except Exception as e:
            logger.error("Failed to log webhook delivery: %s", str(e))

    def get_stats(self, days=7):
        """Get webhook delivery statistics"""
        since = timezone.now() - timedelta(days=days)

        total = WebhookLog.objects.filter(created_at__gte=since).count()
        successful = WebhookLog.objects.filter(
            created_at__gte=since, success=True
        ).count()
        failed = WebhookLog.objects.filter(
            created_at__gte=since, success=False
        ).count()

        return {
            'total': total,
            'successful': successful,
            'failed': failed,
            'success_rate': (successful / total * 100) if total > 0 else 0,
            'active_webhooks': Webhook.objects.filter(is_active=True).count(),
            'period_days': days,
        }

    def add_webhook(self, url, event_type, secret=None, headers=None):
        """Create a new webhook subscription"""
        if event_type not in self.EVENT_TYPES:
            raise ValueError(f"Invalid event type: {event_type}")

        webhook, created = Webhook.objects.get_or_create(
            url=url,
            event_type=event_type,
            defaults={
                'secret': secret or '',
                'headers': headers or '',
                'is_active': True,
            }
        )
        return webhook, created

    def remove_webhook(self, webhook_id):
        """Remove a webhook subscription"""
        try:
            webhook = Webhook.objects.get(pk=webhook_id)
            webhook.delete()
            return True
        except Webhook.DoesNotExist:
            logger.warning("Webhook %d not found", webhook_id)
            return False


# Module-level convenience
webhook_service = WebhookService()


def trigger(event_type, data=None):
    """Convenience function to trigger webhooks"""
    return webhook_service.trigger(event_type, data)