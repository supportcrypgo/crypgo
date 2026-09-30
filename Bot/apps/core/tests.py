import uuid
from datetime import timedelta
from io import StringIO

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignLead
from apps.core.models import Setting
from apps.email_engine.models import EmailLog
from apps.leads.models import BlacklistedLead


class CoreModelsTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_setting_creation(self):
        setting = Setting.objects.create(
            key='test_key',
            value='test_value',
            description='Test setting'
        )
        self.assertEqual(str(setting), 'test_key')
        self.assertEqual(setting.value, 'test_value')


class CoreAdminTest(TestCase):
    def setUp(self):
        self.admin_user = get_user_model().objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.client.login(username='admin', password='adminpass123')

    def test_admin_dashboard_access(self):
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)


class CampaignRecipientAuditResetCommandTest(TestCase):
    def setUp(self):
        self.campaign = Campaign.objects.create(
            name='Audit reset test campaign',
            subject='Test',
        )
        self.unsent_lead = CampaignLead.objects.create(
            campaign=self.campaign,
            recipient_email='unsent@example.com',
            status='failed',
            error_message='internal TypeError',
        )
        self.logged_lead = CampaignLead.objects.create(
            campaign=self.campaign,
            recipient_email='logged@example.com',
            status='bounced',
            error_message='mailbox full',
        )
        self.unrelated_lead = CampaignLead.objects.create(
            campaign=self.campaign,
            recipient_email='unrelated@example.com',
            status='failed',
            error_message='mailbox full',
        )
        EmailLog.objects.create(
            campaign=self.campaign,
            recipient_email='LOGGED@example.com',
            subject='Test',
            tracking_id=str(uuid.uuid4()),
            status='failed',
        )
        EmailLog.objects.create(
            campaign=self.campaign,
            recipient_email='confirmed@example.com',
            subject='Test',
            tracking_id=str(uuid.uuid4()),
            status='sent',
        )
        self.since = timezone.now() - timedelta(minutes=5)
        self.incident_blacklist = BlacklistedLead.objects.create(
            email='unsent@example.com',
            reason='Auto-blacklisted after 5 soft bounces',
        )
        self.old_blacklist = BlacklistedLead.objects.create(
            email='old@example.com',
            reason='Auto-blacklisted after 5 soft bounces',
        )
        BlacklistedLead.objects.filter(pk=self.old_blacklist.pk).update(
            created_at=self.since - timedelta(days=1),
        )

    def _run_reset(self, **extra_options):
        output = StringIO()
        arguments = [
            '--campaign-id', str(self.campaign.pk),
            '--email', 'unsent@example.com',
            '--email', 'logged@example.com',
            '--email', 'unrelated@example.com',
            '--email', 'old@example.com',
            '--error-contains', 'TypeError',
            '--since', self.since.isoformat(),
        ]
        arguments.extend(f'--{name.replace("_", "-")}' for name, enabled in extra_options.items() if enabled)
        call_command('audit_reset_campaign_recipients', *arguments, stdout=output)
        return output.getvalue()

    def test_audit_is_dry_run_by_default(self):
        output = self._run_reset(clear_blacklist=True)

        self.unsent_lead.refresh_from_db()
        self.assertEqual(self.unsent_lead.status, 'failed')
        self.assertTrue(BlacklistedLead.objects.filter(pk=self.incident_blacklist.pk).exists())
        self.assertIn('DRY RUN', output)
        self.assertIn('SKIP logged@example.com', output)
        self.assertIn('NO ACTION unrelated@example.com', output)
        self.assertIn('Confirmed sent addresses: confirmed@example.com', output)

    def test_apply_resets_only_rows_without_campaign_logs_and_recent_auto_blacklist(self):
        self._run_reset(apply=True, clear_blacklist=True)

        self.unsent_lead.refresh_from_db()
        self.logged_lead.refresh_from_db()
        self.unrelated_lead.refresh_from_db()
        self.assertEqual(self.unsent_lead.status, 'pending')
        self.assertEqual(self.logged_lead.status, 'bounced')
        self.assertEqual(self.unrelated_lead.status, 'failed')
        self.assertFalse(BlacklistedLead.objects.filter(pk=self.incident_blacklist.pk).exists())
        self.assertTrue(BlacklistedLead.objects.filter(pk=self.old_blacklist.pk).exists())