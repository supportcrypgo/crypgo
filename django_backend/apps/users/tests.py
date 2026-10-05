import hashlib
import hmac
from datetime import timedelta
from email.message import Message
from io import BytesIO
import os
import tempfile
from typing import Any, cast

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from .management.commands.seed_named_user_history import build_transaction_address
from decimal import Decimal
from unittest.mock import patch

from .models import AccountSelectionChallenge, CampaignAccessToken, CustomUser, DeletionHistory, PasswordResetToken, SharedInboxGroup, SharedInboxLinkToken, Transaction, UserActivityLog, WalletAddress, WalletAsset
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

    def test_user_serializers_do_not_expose_account_phone(self):
        from .serializers import RegisterSerializer, UserCreateSerializer, UserSerializer

        user = CustomUser.objects.create_user(
            username='profile-user',
            email='profile@example.com',
            password='Password123!',
        )

        self.assertNotIn('phone', UserSerializer(user).data)
        self.assertNotIn('phone', cast(Any, UserCreateSerializer()).get_fields())
        self.assertNotIn('phone', cast(Any, RegisterSerializer()).get_fields())


class LoginActivityAuditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='activity-user',
            email='activity@example.com',
            password='Password123!',
            transaction_guard_enabled=True,
        )

    def test_password_login_records_request_device_ip_and_time(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'Password123!'},
            format='json',
            HTTP_X_FORWARDED_FOR='203.0.113.24, 10.0.0.5',
            HTTP_USER_AGENT=(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
                'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1'
            ),
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['user']['transaction_guard_enabled'])
        self.assertEqual(response.cookies['refresh_token']['max-age'], 900)
        activity = UserActivityLog.objects.get(user=self.user, action='login')
        self.assertEqual(activity.status, 'success')
        self.assertEqual(activity.ip_address, '203.0.113.24')
        self.assertEqual(activity.device, 'iPhone')
        self.assertTrue(activity.created_at)
        self.assertEqual(activity.metadata['browser'], 'Safari')
        self.assertEqual(activity.metadata['operating_system'], 'iOS')
        self.assertEqual(activity.metadata['auth_method'], 'password')

        activity_response = self.client.get(
            '/api/users/activity-log/',
            HTTP_AUTHORIZATION=f"Bearer {response.json()['access_token']}",
        )

        self.assertEqual(activity_response.status_code, 200, activity_response.content)
        logged_activity = activity_response.json()[0]
        self.assertEqual(logged_activity['action'], 'login')
        self.assertEqual(logged_activity['status'], 'success')
        self.assertEqual(logged_activity['device'], 'iPhone')
        self.assertEqual(logged_activity['ip_address'], '203.0.113.24')

    def test_refresh_cannot_extend_session_past_fifteen_minutes(self):
        now = int(timezone.now().timestamp())
        refresh = RefreshToken.for_user(self.user)
        refresh['iat'] = now - 14 * 60
        refresh['exp'] = now + 7 * 24 * 60 * 60
        self.client.cookies['refresh_token'] = str(refresh)

        response = self.client.post('/api/auth/refresh/')

        self.assertEqual(response.status_code, 200, response.content)
        access = AccessToken(response.json()['access_token'])
        self.assertLessEqual(int(access['exp']), int(refresh['iat']) + 15 * 60)

    def test_legacy_seven_day_refresh_token_expires_after_fifteen_minutes(self):
        now = int(timezone.now().timestamp())
        refresh = RefreshToken.for_user(self.user)
        refresh['iat'] = now - 16 * 60
        refresh['exp'] = now + 7 * 24 * 60 * 60
        self.client.cookies['refresh_token'] = str(refresh)

        response = self.client.post('/api/auth/refresh/')

        self.assertEqual(response.status_code, 401)


class SharedInboxLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.first = CustomUser.objects.create_user(
            username='shared-first',
            email='sirmattfrewer@gmail.com',
            password='SharedPassword123!',
            first_name='Matt',
            last_name='Frewer',
            date_of_birth='1980-01-02',
            country='New Zealand',
            city='Auckland',
        )
        self.second = CustomUser.objects.create_user(
            username='shared-second',
            email='sirmattfrewer+1@gmail.com',
            password='SharedPassword123!',
        )
        self.group = SharedInboxGroup.objects.create(inbox_email=self.first.email)
        self.group.users.add(self.first, self.second)

    def test_shared_login_requires_account_selection_before_issuing_tokens(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': self.first.email, 'password': 'SharedPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertTrue(payload['requires_account_selection'])
        self.assertNotIn('access_token', payload)
        self.assertNotIn('refresh_token', response.cookies)
        self.assertEqual(len(payload['accounts']), 2)
        self.assertEqual({account['label'] for account in payload['accounts']}, {'Matt Frewer'})
        self.assertEqual({account['email_hint'] for account in payload['accounts']}, {'sirmattfrewer@gmail.com'})

    def test_gmail_plus_alias_login_shows_chooser_without_a_linked_group(self):
        self.group.delete()

        for email in (self.first.email, self.second.email):
            with self.subTest(email=email):
                response = self.client.post(
                    '/api/auth/login/',
                    {'email': email, 'password': 'SharedPassword123!'},
                    format='json',
                )

                self.assertEqual(response.status_code, 200, response.content)
                payload = response.json()
                self.assertTrue(payload['requires_account_selection'])
                self.assertEqual(
                    {account['id'] for account in payload['accounts']},
                    {self.first.pk, self.second.pk},
                )
                self.assertEqual(
                    {account['email_hint'] for account in payload['accounts']},
                    {'sirmattfrewer@gmail.com'},
                )

    def test_gmail_plus_alias_login_skips_chooser_when_only_one_password_matches(self):
        self.group.delete()
        self.second.set_password('DifferentPassword123!')
        self.second.save(update_fields=['password'])

        response = self.client.post(
            '/api/auth/login/',
            {'email': self.first.email, 'password': 'SharedPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('requires_account_selection', response.json())
        self.assertEqual(response.json()['user']['id'], self.first.pk)

    def test_linked_account_profile_uses_canonical_identity_and_email(self):
        self.client.force_authenticate(user=self.second)

        response = self.client.get('/api/users/me/')

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['email'], 'sirmattfrewer@gmail.com')
        self.assertEqual(response.json()['first_name'], 'Matt')
        self.assertEqual(response.json()['last_name'], 'Frewer')
        self.assertEqual(response.json()['date_of_birth'], '1980-01-02')
        self.assertEqual(response.json()['country'], 'New Zealand')
        self.assertEqual(response.json()['city'], 'Auckland')

        update = self.client.put('/api/users/me/', {'city': 'Wellington'}, format='json')

        self.assertEqual(update.status_code, 200, update.content)
        self.first.refresh_from_db()
        self.assertEqual(self.first.city, 'Wellington')

    def test_selection_authenticates_only_the_chosen_linked_account(self):
        login = self.client.post(
            '/api/auth/login/',
            {'email': self.first.email, 'password': 'SharedPassword123!'},
            format='json',
        )
        challenge = login.json()['selection_token']

        selected = self.client.post(
            '/api/auth/login/select-account/',
            {'selection_token': challenge, 'account_id': self.second.pk},
            format='json',
        )

        self.assertEqual(selected.status_code, 200, selected.content)
        self.assertEqual(selected.json()['user']['id'], self.second.pk)
        self.assertEqual(str(AccessToken(selected.json()['access_token'])['user_id']), str(self.second.pk))

    def test_selection_cannot_choose_an_account_outside_challenge(self):
        outsider = CustomUser.objects.create_user(
            username='shared-outsider',
            email='outsider@example.com',
            password='SharedPassword123!',
        )
        login = self.client.post(
            '/api/auth/login/',
            {'email': self.first.email, 'password': 'SharedPassword123!'},
            format='json',
        )

        selected = self.client.post(
            '/api/auth/login/select-account/',
            {'selection_token': login.json()['selection_token'], 'account_id': outsider.pk},
            format='json',
        )

        self.assertEqual(selected.status_code, 403)
        self.assertFalse(selected.cookies)

    @patch('apps.users.views.send_mail', return_value=1)
    def test_link_request_requires_both_account_passwords_and_confirm_is_one_time(self, send_mail_mock):
        self.group.delete()
        self.first.first_name = 'Matt'
        self.first.last_name = 'Frewer'
        self.first.date_of_birth = '1980-01-02'
        self.first.country = 'New Zealand'
        self.first.city = 'Auckland'
        self.first.save()
        self.client.force_authenticate(user=self.first)
        request_response = self.client.post(
            '/api/auth/shared-inbox/link/request/',
            {'email': self.second.email, 'password': 'SharedPassword123!'},
            format='json',
        )
        self.assertEqual(request_response.status_code, 200, request_response.content)
        link = SharedInboxLinkToken.objects.get(initiator=self.first, target=self.second)
        message = send_mail_mock.call_args.kwargs['message']
        raw_token = message.split('token=', 1)[1].split()[0]

        self.client.force_authenticate(user=None)
        confirm_response = self.client.post(
            '/api/auth/shared-inbox/link/confirm/',
            {'token': raw_token},
            format='json',
        )
        self.assertEqual(confirm_response.status_code, 200, confirm_response.content)
        self.assertSetEqual(set(link.initiator.shared_inbox_groups.get().users.values_list('pk', flat=True)), {self.first.pk, self.second.pk})
        self.second.refresh_from_db()
        self.assertEqual(self.second.first_name, 'Matt')
        self.assertEqual(self.second.last_name, 'Frewer')
        self.assertEqual(str(self.second.date_of_birth), '1980-01-02')
        self.assertEqual(self.second.country, 'New Zealand')
        self.assertEqual(self.second.city, 'Auckland')

        replay_response = self.client.post(
            '/api/auth/shared-inbox/link/confirm/',
            {'token': raw_token},
            format='json',
        )
        self.assertEqual(replay_response.status_code, 400)


class DeleteAccountTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='delete-user',
            email='delete@example.com',
            password='Password123!',
        )
        self.client.force_authenticate(user=self.user)

    def test_delete_requires_explicit_confirmation(self):
        response = self.client.post('/api/auth/delete-account/', {}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(CustomUser.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(DeletionHistory.objects.exists())

    def test_confirmed_delete_removes_user_and_keeps_audit_record(self):
        user_id = str(self.user.pk)
        refresh_token = RefreshToken.for_user(self.user)
        refresh_jti = refresh_token['jti']

        response = self.client.post(
            '/api/auth/delete-account/',
            {'confirm_delete': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(CustomUser.objects.filter(pk=user_id).exists())
        history = DeletionHistory.objects.get(deleted_user_id=user_id)
        self.assertEqual(history.deleted_user_email, 'delete@example.com')
        self.assertEqual(history.deleted_by_email, 'delete@example.com')
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh_jti).exists())
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)


@override_settings(BOT_SERVICE_KEY='campaign-test-key', FRONTEND_URL='https://app.example.com')
class CampaignPasswordResetLinkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='campaign-reset-user',
            email='campaign-reset@example.com',
            password='Password123!',
        )

    def _signed_request(self, payload, signature_override=None):
        import json

        body = json.dumps(payload).encode('utf-8')
        signature = hmac.new(b'campaign-test-key', body, hashlib.sha256).hexdigest()
        return self.client.generic(
            'POST',
            '/api/internal/campaigns/closure-campaign/password-reset-link/',
            body,
            content_type='application/json',
            HTTP_X_BOT_SIGNATURE=signature_override or signature,
        )

    def test_signed_request_returns_direct_reset_modal_url(self):
        response = self._signed_request({'email': self.user.email})

        self.assertEqual(response.status_code, 200, response.content)
        response_data = cast(Any, response).data
        self.assertEqual(response_data['email'], self.user.email)
        self.assertIn('https://app.example.com/?resetToken=', response_data['password_reset_url'])
        token = response_data['password_reset_url'].split('resetToken=', 1)[1]
        reset = PasswordResetToken.objects.get(user=self.user, token=token)
        self.assertTrue(reset.is_valid())

    def test_unsigned_request_does_not_issue_a_reset_token(self):
        response = self._signed_request({'email': self.user.email}, signature_override='invalid')

        self.assertEqual(response.status_code, 401)
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_issued_reset_token_validates_updates_password_and_cannot_be_reused(self):
        reset_token = PasswordResetToken.generate_token(self.user)

        validation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': reset_token.token},
        )
        self.assertEqual(validation.status_code, 200, validation.content)
        validation_data = cast(Any, validation).data
        self.assertTrue(validation_data['valid'])

        update = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': reset_token.token,
                'new_password': 'UpdatedPassword456!',
                'confirm_password': 'UpdatedPassword456!',
            },
            format='json',
        )
        self.assertEqual(update.status_code, 200, update.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('UpdatedPassword456!'))

        reused = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': reset_token.token,
                'new_password': 'AnotherPassword789!',
                'confirm_password': 'AnotherPassword789!',
            },
            format='json',
        )
        self.assertEqual(reused.status_code, 400)


class UserReportLayoutTests(TestCase):
    def test_report_price_lookup_reads_snapshot_without_network(self):
        from decimal import Decimal
        from datetime import datetime, timezone as datetime_timezone
        from json import dumps, loads
        from generate_user_report import get_report_usd_prices

        with tempfile.TemporaryDirectory() as cache_dir:
            cache_path = os.path.join(cache_dir, 'market-prices.json')
            with patch.dict(os.environ, {
                'CRYPGO_REPORT_PRICE_CACHE': cache_path,
            }):
                fetched_at = datetime.now(datetime_timezone.utc)
                with open(cache_path, 'w', encoding='utf-8') as snapshot:
                    snapshot.write(dumps({
                        'schema_version': 1,
                        'fetched_at': fetched_at.isoformat(),
                        'source': 'manual_override',
                        'prices': {'BTC': '62000'},
                        'quote_timestamps': {},
                    }))

                prices = get_report_usd_prices({'BTC', 'ETH'})

                self.assertEqual(prices, {'BTC': Decimal('62000')})
                with open(cache_path, encoding='utf-8') as snapshot:
                    stored = loads(snapshot.read())
                self.assertEqual(stored['schema_version'], 1)
                self.assertEqual(stored['source'], 'manual_override')
                self.assertEqual(stored['prices']['BTC'], '62000')

    def test_manual_price_snapshot_is_not_expired(self):
        from datetime import datetime, timedelta, timezone as datetime_timezone
        from json import dumps
        from generate_user_report import get_report_usd_prices

        with tempfile.TemporaryDirectory() as cache_dir:
            cache_path = os.path.join(cache_dir, 'market-prices.json')
            stale_time = datetime.now(datetime_timezone.utc) - timedelta(hours=25)
            with patch.dict(os.environ, {'CRYPGO_REPORT_PRICE_CACHE': cache_path}):
                with open(cache_path, 'w', encoding='utf-8') as snapshot:
                    snapshot.write(dumps({
                        'schema_version': 1,
                        'fetched_at': stale_time.isoformat(),
                        'source': 'manual_override',
                        'prices': {'BTC': '62000'},
                    }))
                self.assertEqual(get_report_usd_prices({'BTC'}), {'BTC': Decimal('62000')})

    def test_snapshot_refresh_validates_manual_prices_without_network(self):
        from decimal import Decimal
        from json import loads
        from generate_user_report import DEFAULT_PRICE_CACHE_PATH, REPORT_TICKERS, refresh_report_price_snapshot

        cache_path = DEFAULT_PRICE_CACHE_PATH
        with patch.dict(os.environ, {'CRYPGO_REPORT_PRICE_CACHE': str(cache_path)}):
            prices = refresh_report_price_snapshot()

        self.assertEqual(set(prices), set(REPORT_TICKERS))
        self.assertEqual(prices['BTC'], Decimal('86350.00'))
        self.assertEqual(prices['ETH'], Decimal('2743.14'))
        self.assertEqual(prices['LTC'], Decimal('67.29'))
        with open(cache_path, encoding='utf-8') as snapshot:
            stored = loads(snapshot.read())
        self.assertEqual(stored['source'], 'manual_override')
        self.assertEqual(stored['prices']['USDT'], '1.00')

    def test_report_shows_unavailable_for_missing_market_snapshot(self):
        from generate_user_report import generate_user_report_bytes
        import pymupdf

        user = CustomUser.objects.create_user(
            username='unpriced-report-user',
            email='unpriced-report@example.com',
            password='Password123!',
        )
        WalletAsset.objects.update_or_create(
            user=user,
            ticker='BTC',
            defaults={
                'name': 'Bitcoin',
                'quantity': Decimal('1'),
                'available_quantity': Decimal('1'),
                'locked_quantity': Decimal('0'),
            },
        )

        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.dict(os.environ, {
                'CRYPGO_REPORT_PRICE_CACHE': os.path.join(cache_dir, 'missing-prices.json'),
            }):
                document = pymupdf.open(
                    stream=generate_user_report_bytes(user),
                    filetype='pdf',
                )

        report_text = cast(str, document[0].get_text())
        self.assertIn('Value: Unavailable', report_text)
        self.assertIn('Unavailable', report_text)
        self.assertIn('USD valuations are unavailable', report_text)
        self.assertNotIn('$0.00', report_text)

    def test_report_discloses_manual_prices_are_not_live(self):
        from generate_user_report import DEFAULT_PRICE_CACHE_PATH, generate_user_report_bytes
        import pymupdf

        user = CustomUser.objects.create_user(
            username='manual-price-report-user',
            email='manual-price-report@example.com',
            password='Password123!',
        )
        WalletAsset.objects.update_or_create(
            user=user,
            ticker='BTC',
            defaults={
                'name': 'Bitcoin',
                'quantity': Decimal('2'),
                'available_quantity': Decimal('1.5'),
                'locked_quantity': Decimal('0.5'),
            },
        )
        WalletAsset.objects.update_or_create(
            user=user,
            ticker='ETH',
            defaults={
                'name': 'Ethereum',
                'quantity': Decimal('1'),
                'available_quantity': Decimal('1'),
                'locked_quantity': Decimal('0'),
            },
        )
        WalletAsset.objects.update_or_create(
            user=user,
            ticker='LTC',
            defaults={
                'name': 'Litecoin',
                'quantity': Decimal('3'),
                'available_quantity': Decimal('2'),
                'locked_quantity': Decimal('1'),
            },
        )

        with patch.dict(os.environ, {'CRYPGO_REPORT_PRICE_CACHE': str(DEFAULT_PRICE_CACHE_PATH)}):
            document = pymupdf.open(
                stream=generate_user_report_bytes(user),
                filetype='pdf',
            )

        report_text = cast(str, document[0].get_text())
        self.assertIn('USD valuations use fixed manual prices and are not live', report_text)
        self.assertIn('$86,350.00', report_text)
        self.assertIn('$172,700.00', report_text)
        self.assertIn('$2,743.14', report_text)
        self.assertIn('$67.29', report_text)
        self.assertIn('$201.87', report_text)
        self.assertIn('Value: $175,645.01', report_text)

    def test_default_report_prices_load_from_local_manual_file(self):
        from decimal import Decimal
        from generate_user_report import DEFAULT_PRICE_CACHE_PATH, REPORT_TICKERS, get_report_usd_prices

        with patch.dict(os.environ):
            os.environ.pop('CRYPGO_REPORT_PRICE_CACHE', None)
            prices = get_report_usd_prices(set(REPORT_TICKERS))

        self.assertEqual(DEFAULT_PRICE_CACHE_PATH.name, 'user_report_prices.json')
        self.assertEqual(prices['BTC'], Decimal('86350.00'))
        self.assertEqual(prices['ETH'], Decimal('2743.14'))
        self.assertEqual(prices['LTC'], Decimal('67.29'))
        self.assertEqual(set(prices), set(REPORT_TICKERS))

    def test_report_transaction_labels_normalize_transfers_only(self):
        from generate_user_report import get_report_transaction_type

        self.assertEqual(get_report_transaction_type('transfer_out', 'Transfer Out'), 'Sent')
        self.assertEqual(get_report_transaction_type('transfer_in', 'Transfer In'), 'Received')
        self.assertEqual(get_report_transaction_type('swap', 'Swap'), 'Swap')

    def test_transaction_fiat_uses_recorded_then_historical_then_estimated_spot(self):
        from types import SimpleNamespace
        from generate_user_report import get_transaction_fiat_display

        self.assertEqual(
            get_transaction_fiat_display(
                SimpleNamespace(fiat_amount=Decimal('0'), amount=Decimal('2'), price_at_time=None, asset='BTC'),
                {'BTC': Decimal('100')},
            ),
            '$0.00',
        )
        self.assertEqual(
            get_transaction_fiat_display(
                SimpleNamespace(fiat_amount=None, amount=Decimal('2'), price_at_time=Decimal('50'), asset='BTC'),
                {'BTC': Decimal('100')},
            ),
            '$100.00',
        )
        self.assertEqual(
            get_transaction_fiat_display(
                SimpleNamespace(fiat_amount=None, amount=Decimal('2'), price_at_time=None, asset='BTC'),
                {'BTC': Decimal('100')},
            ),
            '~$200.00',
        )

    def test_report_omits_account_phone_and_item_heading_prefixes(self):
        from generate_user_report import generate_user_report_bytes
        import pymupdf

        user = CustomUser.objects.create_user(
            username='report-user',
            email='report@example.com',
            password='Password123!',
            first_name='Report',
            last_name='User',
        )

        document = pymupdf.open(stream=generate_user_report_bytes(user), filetype='pdf')
        report_text = cast(str, document[0].get_text())

        self.assertIn('REPORT USER', report_text)
        self.assertIn('report@example.com', report_text)
        self.assertIn('1.01', report_text)
        self.assertIn('1.02', report_text)
        self.assertIn('1.03', report_text)
        self.assertNotIn('Phone:', report_text)
        self.assertNotIn('Public ID:', report_text)
        self.assertNotIn('Item 1.02', report_text)


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

        address_seed = hashlib.sha256(f'crypgo:{cast(Any, self.recipient).id}:BTC:mainnet'.encode('utf-8')).hexdigest()
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
            cast(Any, self.sender).internal_transfers_sent.filter(recipient=self.recipient, status='COMPLETED').exists()
        )

    def test_external_wallet_address_is_sent_out_instead_of_being_rejected(self):
        self.client.force_authenticate(user=self.sender)
        sender_wallet, _ = WalletAsset.objects.get_or_create(
            user=self.sender,
            ticker='BTC',
            defaults={'name': 'Bitcoin', 'quantity': Decimal('0'), 'available_quantity': Decimal('0'), 'locked_quantity': Decimal('0')},
        )
        sender_wallet.quantity = Decimal('10.00000000')
        sender_wallet.available_quantity = Decimal('10.00000000')
        sender_wallet.save(update_fields=['quantity', 'available_quantity'])

        external_address = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        response: Any = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': external_address, 'asset': 'BTC', 'amount': '2.00000000', 'memo': 'external-send'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        sender_wallet.refresh_from_db()
        self.assertEqual(sender_wallet.available_quantity, Decimal('7.99800000'))
        self.assertEqual(sender_wallet.quantity, Decimal('7.99800000'))
        self.assertTrue(
            Transaction.objects.filter(
                user=self.sender,
                transaction_type='withdrawal',
                status='pending',
                to_address=external_address,
            ).exists()
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
        self.assertEqual(cast(Any, blocked).data['code'], 'TRANSACTION_CAUTION_REQUIRED')
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
