from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Permission
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from django.test.client import RequestFactory
from unittest.mock import patch

from apps.campaigns.models import Campaign, CampaignLead, CampaignRun
from apps.campaigns.worker import claim_campaign_run
from apps.campaigns.process_utils import get_campaign_python_executable
from apps.email_engine.models import EmailLog, Tracking
from apps.campaigns.admin import CampaignAdmin, CampaignLeadAdmin
from apps.templates.models import EmailTemplate


class CampaignModelTest(TestCase):
    def setUp(self):
        self.admin_user = get_user_model().objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.template = EmailTemplate.objects.create(
            name='Test Template',
            subject='Test Subject',
            html_content='<p>Test</p>',
            is_active=True,
        )
        self.campaign = Campaign.objects.create(
            name='Test Campaign',
            subject='Campaign Subject',
            template=self.template,
            status='draft',
        )

    def test_campaign_creation(self):
        self.assertEqual(str(self.campaign), 'Test Campaign (Draft)')
        self.assertEqual(self.campaign.status, 'draft')

    def test_open_rate(self):
        self.assertEqual(self.campaign.open_rate(), 0.0)

    def test_click_rate(self):
        self.assertEqual(self.campaign.click_rate(), 0.0)

    def test_bounce_rate(self):
        self.assertEqual(self.campaign.bounce_rate(), 0.0)

    def test_campaign_delete_is_logged(self):
        with self.assertLogs('apps.campaigns.models', level='WARNING') as logs:
            self.campaign.delete()

        self.assertTrue(
            any('Campaign DELETED' in message for message in logs.output),
            logs.output,
        )

    def test_campaign_delete_cancels_run_and_removes_only_its_history(self):
        other_campaign = Campaign.objects.create(name='Other Campaign', subject='Other')
        CampaignLead.objects.create(
            campaign=self.campaign,
            recipient_email='campaign@example.com',
        )
        campaign_log = EmailLog.objects.create(
            campaign=self.campaign,
            recipient_email='campaign@example.com',
            subject='Campaign',
            tracking_id='campaign-delete-log',
        )
        Tracking.objects.create(email_log=campaign_log, tracking_type='open')
        other_log = EmailLog.objects.create(
            campaign=other_campaign,
            recipient_email='other@example.com',
            subject='Other',
            tracking_id='other-delete-log',
        )
        detached_log = EmailLog.objects.create(
            recipient_email='legacy@example.com',
            subject='Detached',
            tracking_id='detached-delete-log',
        )
        run = CampaignRun.objects.create(campaign_id=self.campaign.pk)

        self.campaign.delete()

        self.assertTrue(run.__class__.objects.get(pk=run.pk).cancel_requested)
        self.assertFalse(CampaignLead.objects.filter(campaign_id=self.campaign.pk).exists())
        self.assertFalse(EmailLog.objects.filter(pk=campaign_log.pk).exists())
        self.assertFalse(Tracking.objects.filter(email_log_id=campaign_log.pk).exists())
        self.assertTrue(EmailLog.objects.filter(pk=other_log.pk).exists())
        self.assertTrue(EmailLog.objects.filter(pk=detached_log.pk).exists())

    def test_campaign_has_only_one_active_worker_claim(self):
        first_run = claim_campaign_run(self.campaign.pk)
        second_run = claim_campaign_run(self.campaign.pk)

        self.assertIsNotNone(first_run)
        self.assertIsNone(second_run)
        self.assertEqual(
            CampaignRun.objects.filter(campaign_id=self.campaign.pk, status='running').count(),
            1,
        )

    @override_settings(CAMPAIGN_PYTHON_EXECUTABLE='/usr/local/bin/uwsgi')
    def test_worker_configuration_rejects_uwsgi_as_python(self):
        with self.assertRaisesMessage(ImproperlyConfigured, 'not a web server'):
            get_campaign_python_executable()

    def test_campaign_delete_permission_allows_campaign_lead_cascade_only(self):
        staff_user = get_user_model().objects.create_user(
            username='campaign-admin',
            email='campaign-admin@example.com',
            password='campaignpass123',
            is_staff=True,
        )
        delete_campaign_permission = Permission.objects.get(
            content_type__app_label='campaigns',
            codename='delete_campaign',
        )
        staff_user.user_permissions.add(delete_campaign_permission)
        CampaignLead.objects.create(
            campaign=self.campaign,
            recipient_email='cascade@example.com',
        )
        site = AdminSite()
        campaign_admin = CampaignAdmin(Campaign, site)
        site.register(CampaignLead, CampaignLeadAdmin)
        request = type('Request', (), {'user': staff_user})()

        _, _, perms_needed, _ = campaign_admin.get_deleted_objects([self.campaign], request)
        campaign_lead_admin = site._registry[CampaignLead]

        self.assertNotIn(CampaignLead._meta.verbose_name, perms_needed)
        self.assertFalse(campaign_lead_admin.has_delete_permission(request))

    def test_staff_without_campaign_lead_delete_permission_cannot_delete_leads(self):
        staff_user = get_user_model().objects.create_user(
            username='staff',
            email='staff@example.com',
            password='staffpass123',
            is_staff=True,
        )
        campaign_lead_admin = CampaignLeadAdmin(CampaignLead, AdminSite())
        request = type('Request', (), {'user': staff_user})()

        self.assertFalse(campaign_lead_admin.has_delete_permission(request))

    def test_archive_action_marks_campaign_archived(self):
        admin = CampaignAdmin(Campaign, AdminSite())
        request = type('Request', (), {'user': self.admin_user})()

        with patch.object(admin, 'message_user') as message_user:
            admin.archive_campaigns(request, Campaign.objects.filter(pk=self.campaign.pk))

        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.is_archived)
        message_user.assert_called_once()

    def test_send_campaign_now_action_queues_send(self):
        admin = CampaignAdmin(Campaign, AdminSite())
        request = type('Request', (), {'user': self.admin_user})()

        with (
            patch('apps.campaigns.worker.get_campaign_python_executable', return_value='/home/bot/venv/bin/python'),
            patch('apps.campaigns.worker.subprocess.Popen') as popen,
            patch.object(admin, 'message_user') as message_user,
        ):
            popen.return_value.pid = 12345
            admin.send_campaign_now(request, Campaign.objects.filter(pk=self.campaign.pk))

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'running')
        self.assertFalse(self.campaign.is_paused)
        self.assertIsNotNone(self.campaign.started_at)
        popen.assert_called_once()
        self.assertEqual(popen.call_args.args[0][0], '/home/bot/venv/bin/python')
        command = ' '.join(popen.call_args.args[0])
        self.assertTrue(any(str(run.pk) in command for run in CampaignRun.objects.all()))
        self.assertTrue(message_user.called)

    def test_send_campaign_worker_failure_does_not_leave_campaign_running(self):
        admin = CampaignAdmin(Campaign, AdminSite())
        with (
            patch.object(admin, '_sync_crypgo_users', return_value=(True, 'Synced')),
            patch(
                'apps.campaigns.worker.get_campaign_python_executable',
                side_effect=ImproperlyConfigured('bad worker executable'),
            ),
        ):
            ok, message = admin._queue_campaign_send(self.campaign)

        self.campaign.refresh_from_db()
        self.assertFalse(ok)
        self.assertIn('bad worker executable', message)
        self.assertEqual(self.campaign.status, 'cancelled')

    def test_send_campaign_view_redirects(self):
        admin = CampaignAdmin(Campaign, AdminSite())
        factory = RequestFactory()
        request = factory.get('/admin/campaigns/campaign/1/send-now/', HTTP_REFERER='/admin/campaigns/campaign/')
        request.user = self.admin_user

        with patch.object(admin, '_queue_campaign_send', return_value=(True, 'Queued')) as queue_send, patch.object(admin, 'message_user') as message_user:
            response = admin.send_campaign_view(request, self.campaign.pk)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/admin/campaigns/campaign/')
        queue_send.assert_called_once()
        message_user.assert_called_once()
