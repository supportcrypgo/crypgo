import logging
import hashlib
import base64
from django.http import HttpResponse, HttpResponseRedirect, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.urls import reverse
from django.conf import settings
from .models import EmailLog, Tracking

logger = logging.getLogger(__name__)


class EmailTracker:
    """
    Handles email tracking: open tracking pixels and click tracking links.
    """

    def __init__(self):
        self.base_url = settings.SITE_URL.rstrip('/') if hasattr(settings, 'SITE_URL') else 'http://localhost:8000'
        self.pixel_data = base64.b64decode(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        )  # 1x1 transparent GIF

    def generate_tracking_pixel(self, email_log):
        """
        Generate an HTML img tag with tracking pixel.
        Returns HTML string to inject into email body.
        """
        if not email_log.tracking_id:
            email_log.tracking_id = self._generate_tracking_id(email_log)
            email_log.save(update_fields=['tracking_id'])

        tracking_url = (
            f"{self.base_url.rstrip('/')}/track/open/"
            f"?tid={email_log.tracking_id}"
        )

        return (
            f'<img src="{tracking_url}" '
            f'width="1" height="1" style="display:none;" alt=""/>'
        )

    def generate_click_tracking_url(self, email_log, destination_url):
        """
        Wrap a URL with click tracking.
        Returns the tracking redirect URL.
        """
        if not email_log.tracking_id:
            email_log.tracking_id = self._generate_tracking_id(email_log)
            email_log.save(update_fields=['tracking_id'])

        import urllib.parse
        encoded_url = urllib.parse.quote(destination_url, safe='')

        click_url = (
            f"{self.base_url.rstrip('/')}/track/click/"
            f"?tid={email_log.tracking_id}&url={encoded_url}"
        )
        return click_url

    def track_open(self, request):
        """
        Track an email open event.
        Returns a 1x1 transparent GIF response.
        """
        tracking_id = request.GET.get('tid')
        if not tracking_id:
            raise Http404("Missing tracking ID")

        try:
            email_log = EmailLog.objects.get(tracking_id=tracking_id)

            # Record open event
            if not email_log.opened_at:
                email_log.opened_at = timezone.now()

                # Don't overwrite 'clicked' status with 'opened'
                if email_log.status not in ('clicked', 'bounced', 'failed'):
                    email_log.status = 'opened'

                email_log.ip_address = self._get_client_ip(request)
                email_log.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
                email_log.save(update_fields=[
                    'opened_at', 'status', 'ip_address', 'user_agent'
                ])

                # Create tracking record
                Tracking.objects.create(
                    email_log=email_log,
                    tracking_type='open',
                    ip_address=email_log.ip_address,
                    user_agent=email_log.user_agent,
                )

                # Update campaign statistics
                self._update_campaign_stats(email_log.campaign)

                logger.info("Tracked open for %s", email_log.recipient_email)

        except EmailLog.DoesNotExist:
            logger.warning("Open tracking: EmailLog not found for tid=%s", tracking_id)

        # Return 1x1 transparent GIF
        return HttpResponse(
            self.pixel_data,
            content_type='image/gif',
        )

    def track_click(self, request):
        """
        Track a click event and redirect to destination URL.
        """
        tracking_id = request.GET.get('tid')
        destination_url = request.GET.get('url')

        if not tracking_id or not destination_url:
            raise Http404("Missing tracking parameters")

        try:
            email_log = EmailLog.objects.get(tracking_id=tracking_id)

            # Record click event
            if not email_log.clicked_at:
                email_log.clicked_at = timezone.now()
                email_log.status = 'clicked'
                email_log.ip_address = self._get_client_ip(request)
                email_log.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
                email_log.save(update_fields=[
                    'clicked_at', 'status', 'ip_address', 'user_agent'
                ])

                # Create tracking record
                Tracking.objects.create(
                    email_log=email_log,
                    tracking_type='click',
                    ip_address=email_log.ip_address,
                    user_agent=email_log.user_agent,
                    url_clicked=destination_url,
                )

                # Update campaign statistics
                self._update_campaign_stats(email_log.campaign)

                logger.info(
                    "Tracked click for %s -> %s",
                    email_log.recipient_email, destination_url
                )

        except EmailLog.DoesNotExist:
            logger.warning("Click tracking: EmailLog not found for tid=%s", tracking_id)

        # Redirect to destination URL
        return HttpResponseRedirect(destination_url)

    def inject_tracking(self, email_log, html_body):
        """
        Inject tracking pixel and convert links for click tracking.
        Returns modified HTML body.
        """
        # Inject tracking pixel before closing </body> or at the end
        pixel = self.generate_tracking_pixel(email_log)

        if '</body>' in html_body:
            html_body = html_body.replace('</body>', f'{pixel}\n</body>')
        else:
            html_body += pixel

        # Process links for click tracking
        import re

        def replace_link(match):
            original_url = match.group(1)
            # Skip tracking links and unsubscribe links
            if (original_url.startswith(self.base_url) or
                'unsubscribe' in original_url.lower() or
                'track/' in original_url):
                return f'href="{original_url}"'

            tracked_url = self.generate_click_tracking_url(email_log, original_url)
            return f'href="{tracked_url}"'

        # Replace href values in anchor tags
        html_body = re.sub(
            r'href="([^"]+)"',
            replace_link,
            html_body,
        )

        return html_body

    def get_tracking_stats(self, email_log):
        """Get tracking statistics for a specific email"""
        events = Tracking.objects.filter(email_log=email_log)
        return {
            'opens': events.filter(tracking_type='open').count(),
            'clicks': events.filter(tracking_type='click').count(),
            'first_opened': email_log.opened_at,
            'first_clicked': email_log.clicked_at,
            'open_count': events.filter(tracking_type='open').count(),
            'click_count': events.filter(tracking_type='click').count(),
        }

    def _generate_tracking_id(self, email_log):
        """Generate a unique tracking ID for an email log"""
        raw = f"{email_log.pk}-{email_log.recipient_email}-{timezone.now().isoformat()}"
        hash_obj = hashlib.sha256(raw.encode('utf-8'))
        return hash_obj.hexdigest()[:32]

    def _get_client_ip(self, request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _update_campaign_stats(self, campaign):
        """Update the campaign aggregate statistics"""
        if not campaign:
            return

        try:
            from apps.campaigns.models import Campaign
            from django.db.models import Count, Q

            # Recalculate stats from EmailLog
            logs = EmailLog.objects.filter(campaign=campaign)
            campaign.sent_count = logs.filter(status__in=[
                'sent', 'delivered', 'opened', 'clicked'
            ]).count()
            campaign.opened_count = logs.filter(
                opened_at__isnull=False
            ).count()
            campaign.clicked_count = logs.filter(
                clicked_at__isnull=False
            ).count()
            campaign.bounced_count = logs.filter(status='bounced').count()
            campaign.failed_count = logs.filter(status='failed').count()

            campaign.save(update_fields=[
                'sent_count', 'opened_count', 'clicked_count',
                'bounced_count', 'failed_count', 'updated_at'
            ])
        except Exception as e:
            logger.error(
                "Failed to update campaign stats for %s: %s",
                campaign.pk, str(e)
            )


# Module-level convenience
tracker = EmailTracker()


def generate_tracking_pixel(email_log):
    return tracker.generate_tracking_pixel(email_log)


def track_open(request):
    return tracker.track_open(request)


def track_click(request):
    return tracker.track_click(request)