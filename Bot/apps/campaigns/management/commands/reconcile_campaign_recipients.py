import json

from django.core.management.base import BaseCommand, CommandError

from apps.campaigns.models import Campaign
from apps.campaigns.recipient_utils import (
    campaign_recipient_count,
    reconcile_campaign_recipients,
)


class Command(BaseCommand):
    help = 'Report Gmail inbox groups for a campaign; use --apply to mark duplicate rows.'

    def add_arguments(self, parser):
        parser.add_argument('--campaign-id', type=int, required=True)
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Persist duplicate statuses while preserving delivered rows and history.',
        )

    def handle(self, *args, **options):
        try:
            campaign = Campaign.objects.get(pk=options['campaign_id'])
        except Campaign.DoesNotExist as error:
            raise CommandError(f"Campaign {options['campaign_id']} does not exist.") from error

        report = reconcile_campaign_recipients(campaign, apply=options['apply'])
        if options['apply']:
            campaign.total_leads = campaign_recipient_count(campaign)
            campaign.save(update_fields=['total_leads', 'updated_at'])
        self.stdout.write(json.dumps({
            'campaign_id': campaign.pk,
            'mode': 'apply' if options['apply'] else 'dry-run',
            'unique_recipient_total': campaign_recipient_count(campaign),
            'summary': {key: value for key, value in report.items() if key != 'groups'},
            'groups': report['groups'],
        }, indent=2))
