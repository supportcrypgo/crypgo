import hashlib
import hmac
from datetime import timedelta
from typing import Any, cast

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .management.commands.seed_named_user_history import build_transaction_address
from decimal import Decimal
from unittest.mock import patch

from .models import CampaignAccessToken, CustomUser, Transaction, WalletAddress, WalletAsset
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


class WalletMutationPersistenceTests(TestCase):
    def setUp(self):
        self.client: Any = APIClient()
        self.sender, _ = CustomUser.objects.get_or_create(
            username='sender-user',
            defaults={'email': 'sender@example.com', 'password': 'Password123!'}
        )
        if not self.sender.email:
            self.sender.email = 'sender@example.com'
            self.sender.save(update_fields=['email'])
        self.recipient, _ = CustomUser.objects.get_or_create(
            username='recipient-user',
            defaults={'email': 'recipient@example.com', 'password': 'Password123!'}
        )
        if not self.recipient.email:
            self.recipient.email = 'recipient@example.com'
            self.recipient.save(update_fields=['email'])

        self.sender.set_password('Password123!')
        self.recipient.set_password('Password123!')
        self.sender.save(update_fields=['password'])
        self.recipient.save(update_fields=['password'])

    def test_internal_transfer_updates_sender_and_recipient_wallets_and_persists(self):
        self.client.force_authenticate(user=self.sender)
        sender_wallet, _ = WalletAsset.objects.get_or_create(user=self.sender, ticker='BTC', defaults={'name': 'Bitcoin', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')})
        sender_wallet.quantity = Decimal('10.00000000')
        sender_wallet.available_quantity = Decimal('10.00000000')
        sender_wallet.save(update_fields=['quantity', 'available_quantity'])

        recipient_wallet, _ = WalletAsset.objects.get_or_create(user=self.recipient, ticker='BTC', defaults={'name': 'Bitcoin', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')})
        recipient_wallet.quantity = Decimal('2.00000000')
        recipient_wallet.available_quantity = Decimal('2.00000000')
        recipient_wallet.save(update_fields=['quantity', 'available_quantity'])

        response: Any = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': self.recipient.email, 'asset': 'BTC', 'amount': '3.5', 'memo': 'test-transfer'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        sender_wallet = WalletAsset.objects.get(user=self.sender, ticker='BTC')
        recipient_wallet = WalletAsset.objects.get(user=self.recipient, ticker='BTC')
        sender_wallet.refresh_from_db()
        recipient_wallet.refresh_from_db()
        self.assertEqual(sender_wallet.available_quantity, Decimal('6.50000000'))
        self.assertEqual(recipient_wallet.available_quantity, Decimal('5.50000000'))
        self.assertGreaterEqual(Transaction.objects.filter(user=self.sender, transaction_type='transfer_out').count(), 1)
        self.assertGreaterEqual(Transaction.objects.filter(user=self.recipient, transaction_type='transfer_in').count(), 1)
        sender_tx = Transaction.objects.filter(user=self.sender, transaction_type='transfer_out').latest('created_at')
        recipient_tx = Transaction.objects.filter(user=self.recipient, transaction_type='transfer_in').latest('created_at')
        self.assertEqual(sender_tx.to_address, WalletAddress.objects.get(user=self.recipient, ticker='BTC', network='mainnet').address)
        self.assertEqual(recipient_tx.from_address, WalletAddress.objects.get(user=self.sender, ticker='BTC', network='mainnet').address)

    def test_internal_transfer_resolves_recipient_generated_deposit_address(self):
        self.client.force_authenticate(user=self.sender)
        sender_wallet, _ = WalletAsset.objects.get_or_create(
            user=self.sender,
            ticker='BTC',
            defaults={'name': 'Bitcoin', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')},
        )
        sender_wallet.quantity = Decimal('5.00000000')
        sender_wallet.available_quantity = Decimal('5.00000000')
        sender_wallet.save(update_fields=['quantity', 'available_quantity'])

        address_seed = hashlib.sha256(f'crypgo:{self.recipient.id}:BTC:mainnet'.encode('utf-8')).hexdigest()
        recipient_address = f'bc1{address_seed[:30]}'
        response: Any = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': recipient_address, 'asset': 'BTC', 'amount': '1.25000000'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            WalletAsset.objects.get(user=self.recipient, ticker='BTC').available_quantity,
            Decimal('1.25000000'),
        )
        self.assertTrue(
            Transaction.objects.filter(user=self.recipient, transaction_type='transfer_in', amount=Decimal('1.25000000')).exists()
        )
        self.assertTrue(
            self.sender.internal_transfers_sent.filter(recipient=self.recipient, status='COMPLETED').exists()
        )

    def test_wallet_addresses_are_persisted_for_users(self):
        address = WalletAddress.objects.get(user=self.recipient, ticker='BTC', network='mainnet')
        self.assertTrue(address.is_active)
        self.assertTrue(address.address.startswith('bc1'))
        self.assertEqual(
            WalletAddress.objects.filter(user=self.recipient, ticker='BTC', network='mainnet').count(),
            1,
        )

    def test_known_wallet_address_on_withdraw_endpoint_credits_recipient(self):
        self.client.force_authenticate(user=self.sender)
        sender_wallet = WalletAsset.objects.get(user=self.sender, ticker='BTC')
        sender_wallet.quantity = Decimal('5.00000000')
        sender_wallet.available_quantity = Decimal('5.00000000')
        sender_wallet.save(update_fields=['quantity', 'available_quantity'])
        recipient_address = WalletAddress.objects.get(
            user=self.recipient, ticker='BTC', network='mainnet'
        ).address

        response: Any = self.client.post(
            '/api/wallet/withdraw/',
            {'asset': 'BTC', 'amount': '1.00000000', 'to_address': recipient_address},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Transaction.objects.filter(
            user=self.recipient,
            transaction_type='transfer_in',
            amount=Decimal('1.00000000'),
        ).exists())
        self.assertFalse(Transaction.objects.filter(
            user=self.sender,
            transaction_type='withdrawal',
            to_address=recipient_address,
        ).exists())

    def test_withdrawal_send_debits_wallet_and_keeps_balance_persisted(self):
        self.client.force_authenticate(user=self.sender)
        wallet, _ = WalletAsset.objects.get_or_create(user=self.sender, ticker='ETH', defaults={'name': 'Ethereum', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')})
        wallet.quantity = Decimal('10.00000000')
        wallet.available_quantity = Decimal('10.00000000')
        wallet.save(update_fields=['quantity', 'available_quantity'])

        response: Any = self.client.post(
            '/api/wallet/withdraw/',
            {'asset': 'ETH', 'amount': '2.00000000', 'destination_address': '0xabc1234567890abcdef1234567890abcdef1234'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_quantity, Decimal('7.99800000'))
        self.assertEqual(wallet.quantity, Decimal('7.99800000'))
        self.assertTrue(Transaction.objects.filter(user=self.sender, transaction_type='withdrawal', status='pending').exists())

    def test_simulated_deposit_receive_increases_balance_and_persists(self):
        self.client.force_authenticate(user=self.sender)

        response: Any = self.client.post('/api/wallet/simulate-deposit/', {'asset': 'SOL'}, format='json')

        self.assertEqual(response.status_code, 200, response.content)
        wallet = WalletAsset.objects.get(user=self.sender, ticker='SOL')
        self.assertEqual(wallet.available_quantity, Decimal('1.00000000'))
        self.assertEqual(wallet.quantity, Decimal('1.00000000'))
        self.assertTrue(Transaction.objects.filter(user=self.sender, transaction_type='deposit', status='completed').exists())

    def test_swap_reduces_source_asset_and_increases_destination_asset_and_persists(self):
        self.client.force_authenticate(user=self.sender)
        source_wallet, _ = WalletAsset.objects.get_or_create(user=self.sender, ticker='BTC', defaults={'name': 'Bitcoin', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')})
        source_wallet.quantity = Decimal('10.00000000')
        source_wallet.available_quantity = Decimal('10.00000000')
        source_wallet.save(update_fields=['quantity', 'available_quantity'])

        response: Any = self.client.post(
            '/api/wallet/swap/',
            {'from_asset': 'BTC', 'to_asset': 'ETH', 'amount': '2.00000000'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        source_wallet.refresh_from_db()
        dest_wallet = WalletAsset.objects.get(user=self.sender, ticker='ETH')
        self.assertEqual(source_wallet.available_quantity, Decimal('8.00000000'))
        self.assertEqual(source_wallet.quantity, Decimal('8.00000000'))
        self.assertGreater(dest_wallet.available_quantity, Decimal('0'))
        self.assertGreater(dest_wallet.quantity, Decimal('0'))
        self.assertTrue(Transaction.objects.filter(user=self.sender, transaction_type='swap', status='completed').exists())


class TransactionGuardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='guarded-user',
            email='guarded@example.com',
            password='Password123!',
            transaction_guard_enabled=True,
            transaction_guard_started_at=timezone.now(),
        )
        self.recipient = CustomUser.objects.create_user(
            username='guard-recipient',
            email='guard-recipient@example.com',
            password='Password123!',
        )
        self.wallet = WalletAsset.objects.get(user=self.user, ticker='BTC')
        self.wallet.quantity = Decimal('10.00000000')
        self.wallet.available_quantity = Decimal('10.00000000')
        self.wallet.locked_quantity = Decimal('0')
        self.wallet.save(update_fields=['quantity', 'available_quantity', 'locked_quantity'])
        self.client.force_authenticate(user=self.user)

    @patch('apps.users.services.send_mail')
    def test_two_successes_are_allowed_then_later_attempts_are_blocked_and_emailed(self, send_mail):
        first = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': self.recipient.email, 'asset': 'BTC', 'amount': '1'},
            format='json',
        )
        second = self.client.post(
            '/api/wallet/swap/',
            {'from_asset': 'BTC', 'to_asset': 'ETH', 'amount': '1'},
            format='json',
        )
        blocked = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': self.recipient.email, 'asset': 'BTC', 'amount': '1'},
            format='json',
        )
        blocked_again = self.client.post(
            '/api/wallet/swap/',
            {'from_asset': 'BTC', 'to_asset': 'ETH', 'amount': '1'},
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(blocked.status_code, 409, blocked.content)
        self.assertEqual(blocked.data['code'], 'TRANSACTION_CAUTION_REQUIRED')
        self.assertEqual(blocked_again.status_code, 409, blocked_again.content)
        self.assertEqual(send_mail.call_count, 2)
        self.assertEqual(send_mail.call_args_list[0].kwargs['recipient_list'], [self.user.email])
        self.user.refresh_from_db()
        self.assertEqual(self.user.transaction_guard_success_count, 2)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 2)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_quantity, Decimal('8.00000000'))


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
