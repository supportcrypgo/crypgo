from django.test import TestCase
from apps.unsubscribes.models import UnsubscribedLead


class UnsubscribedLeadModelTest(TestCase):
    def setUp(self):
        self.unsubscribed = UnsubscribedLead.objects.create(
            email='unsub@example.com',
            reason='Too many emails',
            source='web',
        )

    def test_unsubscribed_creation(self):
        self.assertEqual(str(self.unsubscribed), 'unsub@example.com')
        self.assertEqual(self.unsubscribed.source, 'web')


class UnsubscribeViewsTest(TestCase):
    def test_unsubscribe_page(self):
        response = self.client.get('/unsubscribe/test@example.com/')
        self.assertEqual(response.status_code, 200)

    def test_unsubscribe_confirm(self):
        response = self.client.get('/unsubscribe/confirm/test@example.com/')
        self.assertEqual(response.status_code, 200)