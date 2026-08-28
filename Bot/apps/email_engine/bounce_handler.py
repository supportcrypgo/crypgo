import logging
import json
from datetime import timedelta
from django.utils import timezone
from .models import EmailLog, Bounce
from apps.leads.models import BlacklistedLead
from apps.campaigns.models import CampaignLead

logger = logging.getLogger(__name__)


class BounceHandler:
    """Handles email bounce detection, classification, and automated responses"""

    HARD_BOUNCE_KEYWORDS = [
        'user unknown', 'no such user', 'mailbox not found',
        'address rejected', 'invalid address', 'does not exist',
        'no such mailbox', 'invalid recipient', 'user not found',
        'account disabled', 'mailbox unavailable', 'recipient rejected',
    ]
    SOFT_BOUNCE_KEYWORDS = [
        'mailbox full', 'over quota', 'temporarily unavailable',
        'try again later', 'connection timeout', 'service unavailable',
        'too many connections', 'rate limit', 'try again',
    ]
    SPAM_BOUNCE_KEYWORDS = [
        'spam detected', 'bulk email', 'blacklisted', 'rejected by policy',
        'message content rejected', 'spam reported',
    ]

    def __init__(self):
        self.max_hard_bounces = 3
        self.max_soft_bounces = 5

    def process_bounce_notification(self, email, bounce_type='hard',
                                    reason=None, message_id=None):
        """Process a bounce notification (from webhook or manual)"""
        bounce_type = bounce_type.lower()
        if bounce_type not in ['hard', 'soft', 'spam', 'blocked']:
            bounce_type = 'soft'

        if reason is None:
            reason = 'No reason provided'

        # Create or update bounce record
        bounce, created = Bounce.objects.get_or_create(
            email=email,
            bounce_type=bounce_type,
            defaults={
                'reason': reason,
                'bounce_count': 1,
                'last_bounce_at': timezone.now(),
            }
        )

        if not created:
            bounce.bounce_count += 1
            bounce.reason = reason
            bounce.last_bounce_at = timezone.now()
            bounce.save(update_fields=['bounce_count', 'reason',
                                        'last_bounce_at'])

        # Update Crypgo campaign recipient status
        self._update_recipient_status(email, bounce_type)

        # Update email log if message_id is provided
        if message_id:
            self._update_email_log(message_id, bounce_type)

        # Auto-blacklist on hard bounces
        if bounce_type in ('hard', 'spam', 'blocked'):
            if bounce.bounce_count >= self.max_hard_bounces:
                self._auto_blacklist(email, reason, bounce_type)

        # Auto-blacklist on soft bounces exceeding threshold
        if bounce_type == 'soft' and bounce.bounce_count >= self.max_soft_bounces:
            self._auto_blacklist(email, reason, bounce_type)

        logger.info(
            "Processed %s bounce for %s (count: %d)",
            bounce_type, email, bounce.bounce_count
        )
        return bounce

    def check_bounce_keywords(self, error_message):
        """Classify a bounce based on keywords in the error message"""
        error_lower = error_message.lower() if error_message else ''

        # Check for hard bounce keywords
        for keyword in self.HARD_BOUNCE_KEYWORDS:
            if keyword in error_lower:
                return 'hard'

        # Check for spam bounce keywords
        for keyword in self.SPAM_BOUNCE_KEYWORDS:
            if keyword in error_lower:
                return 'spam'

        # Check for soft bounce keywords
        for keyword in self.SOFT_BOUNCE_KEYWORDS:
            if keyword in error_lower:
                return 'soft'

        return 'soft'  # Default to soft bounce if unsure

    def process_failed_email(self, email_log_id):
        """Process a failed email and classify the failure"""
        try:
            email_log = EmailLog.objects.get(pk=email_log_id)
        except EmailLog.DoesNotExist:
            logger.error("EmailLog %d not found", email_log_id)
            return None

        if not email_log.error_message:
            return None

        bounce_type = self.check_bounce_keywords(email_log.error_message)

        return self.process_bounce_notification(
            email=email_log.recipient_email,
            bounce_type=bounce_type,
            reason=email_log.error_message,
            message_id=email_log.message_id,
        )

    def get_bounce_stats(self):
        """Get bounce statistics"""
        now = timezone.now()
        last_hour = now - timedelta(hours=1)
        last_day = now - timedelta(days=1)

        return {
            'total_bounces': Bounce.objects.count(),
            'hard_bounces': Bounce.objects.filter(bounce_type='hard').count(),
            'soft_bounces': Bounce.objects.filter(bounce_type='soft').count(),
            'spam_reports': Bounce.objects.filter(bounce_type='spam').count(),
            'recent_bounces': Bounce.objects.filter(
                last_bounce_at__gte=last_hour
            ).count(),
            'daily_bounces': Bounce.objects.filter(
                last_bounce_at__gte=last_day
            ).count(),
            'auto_blacklisted_today': BlacklistedLead.objects.filter(
                created_at__gte=last_day,
                reason__icontains='bounce'
            ).count(),
        }

    def _update_recipient_status(self, email, bounce_type):
        """Update synced Crypgo recipients based on bounce classification."""
        try:
            CampaignLead.objects.filter(
                recipient_email__iexact=email,
                status__in=['pending', 'queued', 'sent'],
            ).update(status='bounced', updated_at=timezone.now())
        except Exception as e:
            logger.error("Failed to update recipient status for %s: %s",
                         email, str(e))

    def _update_email_log(self, message_id, bounce_type):
        """Update email log with bounce status"""
        try:
            EmailLog.objects.filter(message_id=message_id).update(
                status='bounced'
            )
        except Exception as e:
            logger.error("Failed to update email log %s: %s",
                         message_id, str(e))

    def _auto_blacklist(self, email, reason, bounce_type):
        """Auto-blacklist an email that has exceeded bounce thresholds"""
        try:
            BlacklistedLead.objects.get_or_create(
                email=email,
                defaults={
                    'reason': (
                        f'Auto-blacklisted after {self.max_hard_bounces} '
                        f'hard bounces' if bounce_type != 'soft'
                        else f'Auto-blacklisted after {self.max_soft_bounces} '
                             f'soft bounces'
                    )
                }
            )
            logger.info("Auto-blacklisted %s due to %s bounces",
                        email, bounce_type)
        except Exception as e:
            logger.error("Failed to auto-blacklist %s: %s", email, str(e))