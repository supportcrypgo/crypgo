import logging
import time
import threading
from datetime import datetime, timedelta
from django.utils import timezone
from .models import EmailLog

logger = logging.getLogger(__name__)


class RetryHandler:
    """Handles retry logic with exponential backoff for failed email sends"""

    RETRY_DELAYS = [60, 300, 900, 3600]  # 1min, 5min, 15min, 1hr

    def __init__(self):
        self._retry_queue = {}
        self._lock = threading.Lock()

    def schedule_retry(self, email_log_id, func, args=None, kwargs=None,
                       max_retries=3):
        """Schedule a retry for a failed email send"""
        if args is None:
            args = ()
        if kwargs is None:
            kwargs = {}

        with self._lock:
            retry_count = self._get_retry_count(email_log_id)

            if retry_count >= max_retries:
                logger.warning(
                    "Max retries (%d) reached for email log %d",
                    max_retries, email_log_id
                )
                self._mark_as_failed(email_log_id, 'Max retries exceeded')
                return False

            delay = self._get_delay(retry_count)
            scheduled_time = timezone.now() + timedelta(seconds=delay)

            self._retry_queue[email_log_id] = {
                'func': func,
                'args': args,
                'kwargs': kwargs,
                'scheduled_at': scheduled_time,
                'retry_count': retry_count + 1,
                'max_retries': max_retries,
            }

            logger.info(
                "Scheduled retry %d/%d for email log %d in %d seconds",
                retry_count + 1, max_retries, email_log_id, delay
            )
            return True

    def process_retries(self):
        """Process all scheduled retries that are due"""
        with self._lock:
            now = timezone.now()
            due_retries = [
                (log_id, data) for log_id, data in self._retry_queue.items()
                if data['scheduled_at'] <= now
            ]

            for log_id, data in due_retries:
                del self._retry_queue[log_id]

        for log_id, data in due_retries:
            try:
                logger.info("Processing retry for email log %d", log_id)
                result = data['func'](*data['args'], **data['kwargs'])
                if result and getattr(result, 'status', '') == 'sent':
                    logger.info("Retry succeeded for email log %d", log_id)
                else:
                    logger.warning("Retry failed for email log %d", log_id)
            except Exception as e:
                logger.error(
                    "Retry error for email log %d: %s", log_id, str(e)
                )
                # Re-schedule with incremented retry count
                self.schedule_retry(
                    email_log_id=log_id,
                    func=data['func'],
                    args=data['args'],
                    kwargs=data['kwargs'],
                    max_retries=data['max_retries'],
                )

    def get_pending_retries(self):
        """Get count of pending retries"""
        with self._lock:
            return len(self._retry_queue)

    def _get_retry_count(self, email_log_id):
        """Get current retry count from queue or log"""
        if email_log_id in self._retry_queue:
            return self._retry_queue[email_log_id]['retry_count']

        try:
            log_entry = EmailLog.objects.get(pk=email_log_id)
            # Count existing retries from error message
            if log_entry.error_message:
                if 'retry' in log_entry.error_message.lower():
                    return 1
        except EmailLog.DoesNotExist:
            pass
        return 0

    def _get_delay(self, retry_count):
        """Get delay in seconds for the given retry count"""
        if retry_count < len(self.RETRY_DELAYS):
            return self.RETRY_DELAYS[retry_count]
        return self.RETRY_DELAYS[-1] * 2  # Cap at double max

    def _mark_as_failed(self, email_log_id, reason):
        """Mark an email log as permanently failed"""
        try:
            EmailLog.objects.filter(pk=email_log_id).update(
                status='failed',
                error_message=reason,
            )
        except Exception as e:
            logger.error("Failed to mark email log %d as failed: %s",
                         email_log_id, str(e))