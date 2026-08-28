import logging
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class Throttler:
    """Rate limiting for email sends."""

    DEFAULT_PER_SECOND = 1
    DEFAULT_PER_HOUR = getattr(settings, 'MAX_EMAILS_PER_HOUR', 50)
    DEFAULT_PER_DAY = getattr(settings, 'MAX_EMAILS_PER_DAY', 450)

    CAMPAIGN_SECONDS_BETWEEN_EMAILS = 90
    CAMPAIGN_MAX_PER_HOUR = 40
    CAMPAIGN_MAX_PER_DAY = 350

    def __init__(self, per_second=None, per_hour=None, per_day=None):
        self.per_second = per_second or self.DEFAULT_PER_SECOND
        self.per_hour = per_hour or self.DEFAULT_PER_HOUR
        self.per_day = per_day or self.DEFAULT_PER_DAY

        self._lock = threading.Lock()
        self._second_timestamps = []
        self._hour_count = 0
        self._hour_reset = time.time() + 3600
        self._day_count = 0
        self._day_reset = time.time() + 86400

    def can_send(self, campaign=None):
        """Check if we can send an email within rate limits."""
        if campaign is not None:
            return self.can_send_campaign(campaign)

        with self._lock:
            now = time.time()
            self._maybe_reset(now)

            self._second_timestamps = [
                ts for ts in self._second_timestamps
                if now - ts < 1.0
            ]
            if len(self._second_timestamps) >= self.per_second:
                return False

            if self._hour_count >= self.per_hour:
                return False

            if self._day_count >= self.per_day:
                return False

            return True

    def record_send(self, campaign=None):
        """Record that an email was sent."""
        if campaign is not None:
            return None

        with self._lock:
            now = time.time()
            self._maybe_reset(now)
            self._second_timestamps.append(now)
            self._hour_count += 1
            self._day_count += 1

    def get_remaining(self, campaign=None):
        """Get remaining sends for the current period."""
        if campaign is not None:
            return self.get_campaign_remaining(campaign)

        with self._lock:
            now = time.time()
            self._maybe_reset(now)

            self._second_timestamps = [
                ts for ts in self._second_timestamps
                if now - ts < 1.0
            ]

            return {
                'per_second': max(0, self.per_second - len(self._second_timestamps)),
                'per_hour': max(0, self.per_hour - self._hour_count),
                'per_day': max(0, self.per_day - self._day_count),
                'hour_reset_in': max(0, self._hour_reset - now),
                'day_reset_in': max(0, self._day_reset - now),
            }

    def can_send_campaign(self, campaign):
        """Check whether a campaign can send another email right now."""
        return (
            self.get_remaining_day(campaign) > 0
            and self.get_remaining_hour(campaign) > 0
            and self.wait_for_next_slot(campaign) <= 0
        )

    def get_campaign_remaining(self, campaign):
        """Return campaign-specific throttling details."""
        return {
            'per_hour': self.get_remaining_hour(campaign),
            'per_day': self.get_remaining_day(campaign),
            'wait_time': self.wait_for_next_slot(campaign),
            'can_send': self.can_send_campaign(campaign),
        }

    def get_campaign_email_queryset(self, campaign, *, since=None):
        from apps.email_engine.models import EmailLog

        filters = {
            'campaign': campaign,
            'status__in': ('sent', 'delivered'),
        }
        if since is not None:
            filters['sent_at__gte'] = since
        return EmailLog.objects.filter(**filters)

    def get_last_sent_time(self, campaign):
        """Get the timestamp of the last sent email for a campaign."""
        last_log = self.get_campaign_email_queryset(campaign).order_by('-sent_at', '-created_at').first()
        return last_log.sent_at if last_log else None

    def get_remaining_hour(self, campaign):
        """Get how many campaign sends remain in the current rolling hour."""
        since = timezone.now() - timedelta(hours=1)
        sent_last_hour = self.get_campaign_email_queryset(campaign, since=since).count()
        return max(0, self.CAMPAIGN_MAX_PER_HOUR - sent_last_hour)

    def get_remaining_day(self, campaign):
        """Get how many campaign sends remain for today."""
        today = timezone.now().date()
        sent_today = self.get_campaign_email_queryset(campaign).filter(sent_at__date=today).count()
        return max(0, self.CAMPAIGN_MAX_PER_DAY - sent_today)

    def wait_for_next_slot(self, campaign):
        """Return the number of seconds to wait before the next campaign send."""
        last_sent = self.get_last_sent_time(campaign)
        wait_for_gap = 0
        if last_sent:
            elapsed = (timezone.now() - last_sent).total_seconds()
            wait_for_gap = max(0, self.CAMPAIGN_SECONDS_BETWEEN_EMAILS - elapsed)

        since = timezone.now() - timedelta(hours=1)
        recent_logs = self.get_campaign_email_queryset(campaign, since=since).order_by('sent_at', 'created_at')
        recent_count = recent_logs.count()
        wait_for_hour = 0
        if recent_count >= self.CAMPAIGN_MAX_PER_HOUR:
            oldest_recent = recent_logs.first()
            if oldest_recent:
                wait_for_hour = max(
                    0,
                    (oldest_recent.sent_at + timedelta(hours=1) - timezone.now()).total_seconds(),
                )

        return max(wait_for_gap, wait_for_hour)

    def _maybe_reset(self, now):
        """Reset counters if time period has passed."""
        if now >= self._hour_reset:
            self._hour_count = 0
            self._hour_reset = now + 3600

        if now >= self._day_reset:
            self._day_count = 0
            self._day_reset = now + 86400

    def set_limits(self, per_second=None, per_hour=None, per_day=None):
        """Dynamically update rate limits."""
        with self._lock:
            if per_second is not None:
                self.per_second = per_second
            if per_hour is not None:
                self.per_hour = per_hour
            if per_day is not None:
                self.per_day = per_day


default_throttler = Throttler()


def can_send():
    """Check if we can send within limits."""
    return default_throttler.can_send()


def record_send():
    """Record a sent email."""
    return default_throttler.record_send()
