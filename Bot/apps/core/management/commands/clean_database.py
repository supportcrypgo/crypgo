from django.core.management.base import BaseCommand
from django.db import transaction
from apps.leads.models import BlacklistedLead
from apps.campaigns.models import Campaign, CampaignLead
from apps.email_engine.models import EmailLog, Tracking, Bounce
from apps.unsubscribes.models import UnsubscribedLead
from apps.webhooks.models import WebhookLog
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean all test data from the database for a fresh start'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write("=== DRY RUN — What would be deleted ===")
            self.delete_model(EmailLog, "Email logs", verbose=True)
            return

        self.stdout.write("=== Starting database cleanup ===")

        with transaction.atomic():
            self.delete_model(UnsubscribedLead, "Unsubscribed leads")
            self.delete_model(WebhookLog, "Webhook logs")
            self.delete_model(Tracking, "Tracking data")
            self.delete_model(Bounce, "Bounces")
            self.delete_model(EmailLog, "Email logs")
            self.delete_model(CampaignLead, "Campaign-Lead links")
            self.delete_model(Campaign, "Campaigns")
            self.delete_model(BlacklistedLead, "Blacklisted leads")

        self.stdout.write(self.style.SUCCESS("=== Database cleanup complete ==="))
        self.print_counts()

    def delete_model(self, model, name, verbose=False):
        count = model.objects.count()
        if verbose:
            self.stdout.write(f"  Would delete {count} {name}")
            return
        model.objects.all().delete()
        self.stdout.write(f"Deleted {count} {name}")

    def print_counts(self):
        self.stdout.write("\n=== Current counts ===")
        self.stdout.write(f"BlacklistedLeads: {BlacklistedLead.objects.count()}")
        self.stdout.write(f"Campaigns: {Campaign.objects.count()}")
        self.stdout.write(f"CampaignLeads: {CampaignLead.objects.count()}")
        self.stdout.write(f"EmailLogs: {EmailLog.objects.count()}")
        self.stdout.write(f"Tracking: {Tracking.objects.count()}")
        self.stdout.write(f"Bounces: {Bounce.objects.count()}")
        self.stdout.write(f"Unsubscribes: {UnsubscribedLead.objects.count()}")
        self.stdout.write(f"WebhookLogs: {WebhookLog.objects.count()}")