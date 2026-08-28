import hashlib
import hmac
import json

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignLead
from apps.templates.models import EmailTemplate


@override_settings(CRYPGO_SERVICE_KEY='test-crypgo-service-key')
class CampaignRecipientSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.template = EmailTemplate.objects.create(
            name='Crypgo Campaign Template',
            subject='Account update',
            html_content='<a href="{{ dashboard_url }}">Go to dashboard</a>',
            plain_text='Go to dashboard: {{ dashboard_url }}',
        )
        self.campaign = Campaign.objects.create(
            name='Crypgo User Campaign',
            subject='Account update',
            template=self.template,
        )

    def signed_post(self, payload, signature_key='test-crypgo-service-key'):
        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        signature = hmac.new(signature_key.encode('utf-8'), body, hashlib.sha256).hexdigest()
        return self.client.post(
            f'/api/internal/campaigns/{self.campaign.pk}/recipients/sync/',
            data=body,
            content_type='application/json',
            HTTP_X_CRYPGO_SIGNATURE=signature,
        )

    def test_sync_creates_campaign_scoped_recipient(self):
        response = self.signed_post({
            'recipients': [{
                'external_user_id': 'crypgo-289',
                'email': 'user@example.com',
                'first_name': 'James',
                'last_name': 'Borunda',
                'dashboard_url': 'https://app.crypgo.com/campaign-access?token=one',
            }],
        })

        self.assertEqual(response.status_code, 200)
        recipient = CampaignLead.objects.get(campaign=self.campaign)
        self.assertEqual(recipient.source, 'crypgo_user')
        self.assertEqual(recipient.recipient_email, 'user@example.com')
        self.assertEqual(recipient.recipient_first_name, 'James')
        self.assertEqual(recipient.dashboard_url, 'https://app.crypgo.com/campaign-access?token=one')

    def test_sync_rejects_invalid_signature(self):
        response = self.signed_post({'recipients': []}, signature_key='wrong-key')

        self.assertEqual(response.status_code, 401)
        self.assertFalse(CampaignLead.objects.filter(campaign=self.campaign).exists())
