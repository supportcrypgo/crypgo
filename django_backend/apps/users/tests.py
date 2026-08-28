import hashlib
import hmac
from datetime import timedelta

from django.utils import timezone

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import CampaignAccessToken, CustomUser, MagicLinkToken


class CampaignAccessTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='campaign-user',
            email='campaign@example.com',
            password='Password123!',
        )

    def test_campaign_access_token_allows_one_use_then_rejects_reuse(self):
        _, raw_token = CampaignAccessToken.generate_token(self.user, 'campaign-1')

        first_response = self.client.post(
            '/api/auth/campaign-access/consume/',
            {'token': raw_token},
            format='json',
        )
        second_response = self.client.post(
            '/api/auth/campaign-access/consume/',
            {'token': raw_token},
            format='json',
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 400)
        self.assertTrue(first_response.cookies.get('access_token'))

    def test_unused_campaign_access_token_ignores_expiry_timestamp(self):
        token, raw_token = CampaignAccessToken.generate_token(self.user, 'campaign-1')
        token.expires_at = timezone.now() - timedelta(days=1)
        token.save(update_fields=['expires_at'])

        response = self.client.post(
            '/api/auth/campaign-access/consume/',
            {'token': raw_token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)

    def test_invalid_campaign_access_token_is_rejected(self):
        response = self.client.post(
            '/api/auth/campaign-access/consume/',
            {'token': 'not-a-real-token'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class MagicLinkPasswordChangeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='magic-user',
            email='magic@example.com',
            password='OldPassword123!',
        )

    def test_magic_link_validates_without_logging_user_in(self):
        _, raw_token = MagicLinkToken.generate_token(self.user)

        response = self.client.post(
            '/api/auth/magic-link/consume/',
            {'token': raw_token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('access_token', response.data)

    def test_magic_link_changes_password_once(self):
        token, raw_token = MagicLinkToken.generate_token(self.user)

        response = self.client.post(
            '/api/auth/magic-link/reset-password/',
            {
                'token': raw_token,
                'new_password': 'NewPassword123!',
                'confirm_password': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPassword123!'))
        self.assertIsNotNone(token.refresh_from_db() or token.used_at)

        reuse_response = self.client.post(
            '/api/auth/magic-link/reset-password/',
            {
                'token': raw_token,
                'new_password': 'AnotherPassword123!',
                'confirm_password': 'AnotherPassword123!',
            },
            format='json',
        )
        self.assertEqual(reuse_response.status_code, 400)

    def test_magic_link_expires_after_one_hour(self):
        token, raw_token = MagicLinkToken.generate_token(self.user)
        token.expires_at = timezone.now() - timedelta(days=1)
        token.save(update_fields=['expires_at'])

        response = self.client.post(
            '/api/auth/magic-link/reset-password/',
            {
                'token': raw_token,
                'new_password': 'NewPassword123!',
                'confirm_password': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_magic_link_validation_does_not_consume_token(self):
        token, raw_token = MagicLinkToken.generate_token(self.user)

        response = self.client.post(
            '/api/auth/magic-link/consume/',
            {'token': raw_token},
            format='json',
        )

        token.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(token.used_at)

    def test_magic_link_request_is_limited_to_two_per_day(self):
        with self.settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            first = self.client.post('/api/auth/magic-link/request/', {'email': self.user.email}, format='json')
            second = self.client.post('/api/auth/magic-link/request/', {'email': self.user.email}, format='json')
            third = self.client.post('/api/auth/magic-link/request/', {'email': self.user.email}, format='json')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)


@override_settings(BOT_SERVICE_KEY='test-bot-service-key')
class CampaignRecipientExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='export-user',
            email='export@example.com',
            password='Password123!',
            first_name='Export',
            last_name='User',
        )

    def test_signed_export_returns_safe_recipient_data_and_access_url(self):
        body = b'{}'
        signature = hmac.new(
            b'test-bot-service-key', body, hashlib.sha256
        ).hexdigest()
        response = self.client.post(
            '/api/internal/campaigns/campaign-1/recipients/export/',
            data=body,
            content_type='application/json',
            HTTP_X_BOT_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 200)
        recipient = response.json()['recipients'][0]
        self.assertEqual(recipient['email'], 'export@example.com')
        self.assertEqual(recipient['first_name'], 'Export')
        self.assertIn('/auth/campaign-access?token=', recipient['dashboard_url'])
        self.assertNotIn('wallet', recipient)
