import logging
import subprocess
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignRun
from apps.campaigns.process_utils import get_campaign_python_executable

logger = logging.getLogger(__name__)


def claim_campaign_run(campaign_id):
    """Atomically claim the single active worker slot for a campaign."""
    stale_after = int(getattr(settings, 'CAMPAIGN_RUN_STALE_AFTER_SECONDS', 1800))
    stale_before = timezone.now() - timedelta(seconds=stale_after)
    CampaignRun.objects.filter(
        campaign_id=campaign_id,
        status='running',
        heartbeat_at__lt=stale_before,
    ).update(
        status='failed',
        finished_at=timezone.now(),
        error_message='Worker lease expired; a new run reclaimed the campaign.',
    )

    try:
        with transaction.atomic():
            campaign = Campaign.objects.select_for_update().get(pk=campaign_id)
            if campaign.status == 'completed' or campaign.is_archived:
                return None
            run = CampaignRun.objects.create(campaign_id=campaign.pk)
            campaign.status = 'running'
            campaign.is_paused = False
            campaign.started_at = campaign.started_at or timezone.now()
            campaign.save(update_fields=['status', 'is_paused', 'started_at', 'updated_at'])
            return run
    except IntegrityError:
        return None


def finish_campaign_run(run_id, status, error_message=''):
    """Release the active worker slot without requiring the campaign row to exist."""
    CampaignRun.objects.filter(pk=run_id, status='running').update(
        status=status,
        finished_at=timezone.now(),
        heartbeat_at=timezone.now(),
        error_message=error_message[:2000],
    )


def launch_campaign_worker(campaign_id):
    """Claim and launch a campaign worker with a durable cancellation token."""
    run = claim_campaign_run(campaign_id)
    if run is None:
        return False, 'Campaign is unavailable or already has an active worker.'

    manage_py = Path(__file__).resolve().parents[2] / 'manage.py'
    try:
        command = [
            get_campaign_python_executable(),
            str(manage_py),
            'send_campaign',
            f'--campaign-id={campaign_id}',
            f'--run-id={run.pk}',
        ]
        process = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            close_fds=True,
        )
    except (ImproperlyConfigured, OSError, ValueError) as error:
        finish_campaign_run(run.pk, 'failed', f'Worker launch failed: {error}')
        Campaign.objects.filter(pk=campaign_id, status='running').update(
            status='cancelled',
            updated_at=timezone.now(),
        )
        logger.exception('Could not launch campaign worker for campaign %s', campaign_id)
        return False, f'Campaign worker could not start: {error}'

    CampaignRun.objects.filter(pk=run.pk, status='running').update(
        process_id=process.pid,
        heartbeat_at=timezone.now(),
    )
    logger.info(
        'Launched campaign worker campaign_id=%s run_id=%s pid=%s executable=%s',
        campaign_id,
        run.pk,
        process.pid,
        command[0],
    )
    return True, f'Campaign worker started (run {run.pk}).'
