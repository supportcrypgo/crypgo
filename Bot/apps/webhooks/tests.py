from django.test import TestCase
from apps.webhooks.models import Webhook, WebhookLog


class WebhookModelTest(TestCase):
    def setUp(self):
        self.webhook = Webhook.objects.create(
            name='Test Webhook',
            url='https://example.com/webhook',
            event='email_sent',
            status='active',
        )

    def test_webhook_creation(self):
        self.assertEqual(str(self.webhook), 'Test Webhook - Email Sent')

    def test_webhook_log(self):
        log = WebhookLog.objects.create(
            webhook=self.webhook,
            payload={'email': 'test@example.com'},
            status='success',
        )
        self.assertEqual(str(log), 'Test Webhook - success')