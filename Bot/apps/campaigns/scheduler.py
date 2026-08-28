import logging
import subprocess
import sys
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q

logger = logging.getLogger(__name__)


class CampaignScheduler:
    """
    Manages campaign scheduling, execution, and status transitions.
    Sending is launched in a separate process so it doesn't block the web server.
    """

    def __init__(self):
        pass

    def _spawn_send_command(self, campaign_id):
        """Launch send_campaign in a detached subprocess (non-blocking)."""
        manage_py = self._get_manage_py_path()
        subprocess.Popen(
            [sys.executable, manage_py, 'send_campaign', f'--campaign-id={campaign_id}'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            close_fds=True,
        )
        logger.info("Spawned send_campaign subprocess for campaign ID %s", campaign_id)

    def _get_manage_py_path(self):
        """Find manage.py relative to this file's location."""
        import os
        # This file is at apps/campaigns/scheduler.py, manage.py is 2 levels up
        return os.path.normpath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'manage.py')
        )

    def schedule_campaign(self, campaign, schedule_time):
        """Schedule a campaign for future execution"""
        if schedule_time <= timezone.now():
            raise ValueError("Schedule time must be in the future")

        campaign.scheduled_at = schedule_time
        campaign.status = 'scheduled'
        campaign.save(update_fields=['scheduled_at', 'status', 'updated_at'])
        logger.info(
            "Campaign '%s' scheduled for %s",
            campaign.name, schedule_time
        )
        return campaign

    def process_scheduled_campaigns(self):
        """Process all campaigns that are due to start"""
        now = timezone.now()
        due_campaigns = self.get_due_campaigns()

        started_count = 0
        for campaign in due_campaigns:
            try:
                self.start_campaign(campaign)
                started_count += 1
            except Exception as e:
                logger.error(
                    "Failed to start campaign '%s' (ID: %d): %s",
                    campaign.name, campaign.pk, str(e)
                )
                # Mark as failed to prevent retry loops
                campaign.status = 'cancelled'
                campaign.save(update_fields=['status', 'updated_at'])

        return started_count

    def start_campaign(self, campaign):
        """Start executing a campaign (runs sending in a separate process)"""
        campaign.status = 'running'
        campaign.started_at = timezone.now()
        campaign.save(update_fields=['status', 'started_at', 'updated_at'])

        from apps.campaigns.models import CampaignLead

        lead_count = CampaignLead.objects.filter(campaign=campaign).count()
        campaign.total_leads = lead_count
        campaign.save(update_fields=['total_leads'])

        logger.info(
            "Campaign '%s' started with %d leads",
            campaign.name, lead_count
        )

        # Launch sending in a separate process so the web server stays responsive
        self._spawn_send_command(campaign.pk)

        return campaign

    def pause_campaign(self, campaign):
        """Pause a running campaign"""
        if campaign.status != 'running':
            raise ValueError("Only running campaigns can be paused")

        campaign.status = 'paused'
        campaign.save(update_fields=['status', 'updated_at'])
        logger.info("Campaign '%s' paused", campaign.name)
        return campaign

    def resume_campaign(self, campaign):
        """Resume a running campaign (launches sending in a separate process)"""
        if campaign.status != 'paused':
            raise ValueError("Only paused campaigns can be resumed")

        campaign.status = 'running'
        campaign.save(update_fields=['status', 'updated_at'])
        logger.info("Campaign '%s' resumed", campaign.name)

        self._spawn_send_command(campaign.pk)

        return campaign

    def cancel_campaign(self, campaign):
        """Cancel a campaign"""
        campaign.status = 'cancelled'
        campaign.save(update_fields=['status', 'updated_at'])
        logger.info("Campaign '%s' cancelled", campaign.name)
        return campaign

    def complete_campaign(self, campaign):
        """Mark a campaign as completed"""
        campaign.status = 'completed'
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=['status', 'completed_at', 'updated_at'])
        logger.info("Campaign '%s' completed", campaign.name)
        return campaign

    def get_due_campaigns(self):
        """Get all campaigns that are scheduled and due to start"""
        from apps.campaigns.models import Campaign
        now = timezone.now()
        return Campaign.objects.filter(
            status='scheduled',
            scheduled_at__lte=now,
        )

    def get_running_campaigns(self):
        """Get all currently running campaigns"""
        from apps.campaigns.models import Campaign
        return Campaign.objects.filter(
            status__in=['running', 'paused']
        )

    def get_campaign_progress(self, campaign):
        """Get detailed progress of a campaign"""
        total = campaign.total_leads
        sent = campaign.sent_count
        opened = campaign.opened_count
        clicked = campaign.clicked_count
        bounced = campaign.bounced_count
        failed = campaign.failed_count

        remaining = max(0, total - sent - failed - bounced)

        progress = 0
        if total > 0:
            progress = min(100, int(((sent + failed) / total) * 100))

        return {
            'total': total,
            'sent': sent,
            'opened': opened,
            'clicked': clicked,
            'bounced': bounced,
            'failed': failed,
            'remaining': remaining,
            'progress_percentage': progress,
            'status': campaign.status,
            'open_rate': campaign.open_rate(),
            'click_rate': campaign.click_rate(),
            'bounce_rate': campaign.bounce_rate(),
        }

    def cleanup_old_campaigns(self, days=90):
        """Archive or cleanup campaigns older than specified days"""
        from apps.campaigns.models import Campaign
        cutoff = timezone.now() - timedelta(days=days)
        old_campaigns = Campaign.objects.filter(
            completed_at__lte=cutoff,
            status='completed'
        )
        count = old_campaigns.count()
        logger.info("Cleaning up %d old campaigns", count)
        # Soft delete by marking
        old_campaigns.update(status='completed')
        return count
