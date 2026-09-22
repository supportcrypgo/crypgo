import hashlib
import hmac
from datetime import timedelta
from typing import Any, cast

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .management.commands.seed_named_user_history import build_transaction_address
from .models import CampaignAccessToken, CustomUser
from .serializers import LoginSerializer


class EmailNormalizationTests(TestCase):
    def test_email_is_lowercased_and_login_accepts_mixed_case(self):
        user = CustomUser.objects.create_user(
            username='case-user',
            email='Sirmattfrewer@gmail.com',
            password='Password123!',
        )

        self.assertEqual(user.email, 'sirmattfrewer@gmail.com')

        serializer = LoginSerializer(data={
            'email': 'SiRmAtTfReWeR@gmail.com',
            'password': 'Password123!',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

        validated_data = cast(dict[str, Any], serializer.validated_data)
        self.assertIn('user', validated_data)

        validated_user = validated_data['user']
        self.assertEqual(validated_user.email, 'sirmattfrewer@gmail.com')


class SeededTransactionAddressTests(TestCase):
    def test_transaction_addresses_are_deterministic_and_reused(self):
        first = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 1, 'receive')
        second = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 1, 'receive')
        third = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 9, 'receive')

        self.assertEqual(first, second)
        self.assertTrue(first.startswith('bc1q'))
        self.assertNotIn('Unknown', first)
        self.assertNotEqual(first, third)


class CampaignAccessTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='campaign-user',
            email='campaign@example.com',
            password='Password123!',
        )

    def test_campaign_access_token_allows_one_use_then_rejects_second(self):
        token, raw_token = CampaignAccessToken.generate_token(self.user, 'campaign-1')

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

        token.refresh_from_db()
        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 400)
        self.assertTrue(first_response.cookies.get('access_token'))
        self.assertIsNotNone(token.used_at)
        self.assertEqual(token.use_count, 1)

    def test_campaign_access_token_ignores_legacy_expiry(self):
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

        data = response.json()
        self.assertIsInstance(data, dict)

        recipients = data.get('recipients', [])
        self.assertIsInstance(recipients, list)
        self.assertGreater(len(recipients), 0)

        recipient = recipients[0]
        self.assertEqual(recipient['email'], 'export@example.com')
        self.assertEqual(recipient['first_name'], 'Export')
        self.assertIn('/auth/campaign-access?token=', recipient['dashboard_url'])
        self.assertNotIn('wallet', recipient)

    def test_signed_export_excludes_internal_admin_accounts(self):
        CustomUser.objects.create_user(
            username='internal-admin',
            email='admin@crypgo.com',
            password='Password123!',
            is_staff=True,
            is_superuser=True,
        )

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

        data = response.json()
        self.assertIsInstance(data, dict)

        recipients = data.get('recipients', [])
        self.assertIsInstance(recipients, list)
        self.assertEqual(len(recipients), 1)
        self.assertEqual(recipients[0]['email'], 'export@example.com')
        self.assertNotIn('admin@crypgo.com', [recipient['email'] for recipient in recipients])
