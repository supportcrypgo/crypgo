from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from django.test.client import RequestFactory
from unittest.mock import patch

from apps.campaigns.models import Campaign
from apps.campaigns.admin import CampaignAdmin
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

        with patch('apps.campaigns.admin.subprocess.Popen') as popen, patch.object(admin, 'message_user') as message_user:
            admin.send_campaign_now(request, Campaign.objects.filter(pk=self.campaign.pk))

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'running')
        self.assertFalse(self.campaign.is_paused)
        self.assertIsNotNone(self.campaign.started_at)
        popen.assert_called_once()
        self.assertTrue(message_user.called)

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
