import hashlib
import hmac
import json
import re
from datetime import timedelta
from email.message import Message
from io import BytesIO
import os
import tempfile
from typing import Any, cast

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from decimal import Decimal
from unittest.mock import patch

from .models import AccountSelectionChallenge, CampaignAccessToken, CustomUser, DeletionHistory, FirstLoginPasswordSetupChallenge, MagicLinkToken, PasswordResetToken, SharedInboxGroup, SharedInboxLinkToken, Transaction, UserActivityLog, WalletAddress, WalletAsset
from .serializers import LoginSerializer
from .transaction_address import build_transaction_address


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


class GmailRegistrationLimitTests(TestCase):
    limit_message = (
        'This Gmail address has reached Crypgo’s two-account limit. '
        'Please sign in to access your existing accounts.'
    )

    def setUp(self):
        self.client = APIClient()

    def register(self, email):
        return self.client.post(
            '/api/auth/register/',
            {'email': email, 'password': 'Password123!'},
            format='json',
        )

    def test_gmail_registration_allows_two_accounts_then_blocks_more(self):
        first = self.register('limit-test@gmail.com')
        second = self.register('limit-test+second@gmail.com')

        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 201, second.content)

        for email in ('limit-test@gmail.com', 'limit-test+third@gmail.com'):
            with self.subTest(email=email):
                response = self.register(email)
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(response.json()['email'], [self.limit_message])

        self.assertEqual(
            CustomUser.objects.filter(email__istartswith='limit-test').count(),
            2,
        )

    def test_linked_shared_inbox_accounts_count_toward_limit(self):
        first = CustomUser.objects.create_user(
            username='linked-gmail-first',
            email='linked-gmail@gmail.com',
            password='Password123!',
        )
        second = CustomUser.objects.create_user(
            username='linked-gmail-second',
            email='linked-alt-address@gmail.com',
            password='Password123!',
        )
        group = SharedInboxGroup.objects.create(inbox_email=first.email)
        group.users.add(first, second)

        response = self.register('linked-gmail+third@gmail.com')

        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response.json()['email'], [self.limit_message])

    def test_non_gmail_plus_aliases_are_not_limited_by_gmail_rule(self):
        for email in ('limit-test@example.com', 'limit-test+second@example.com'):
            response = self.register(email)
            self.assertEqual(response.status_code, 201, response.content)

        response = self.register('limit-test+third@example.com')

        self.assertEqual(response.status_code, 201, response.content)


class DisplayCurrencyPreferenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='currency-user',
            email='currency@example.com',
            password='Password123!',
        )
        self.client.force_authenticate(self.user)

    def test_display_currency_is_returned_and_saved_to_user(self):
        response = self.client.put(
            '/api/users/me/',
            {'display_currency': 'jpy'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['display_currency'], 'JPY')
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_currency, 'JPY')

    def test_display_currency_rejects_invalid_codes(self):
        response = self.client.put(
            '/api/users/me/',
            {'display_currency': 'US'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_currency, 'USD')


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
        self.assertEqual(response.cookies['access_token']['max-age'], 10800)
        self.assertEqual(response.cookies['refresh_token']['max-age'], 10800)
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

    def test_refresh_cannot_extend_session_past_three_hours(self):
        now = int(timezone.now().timestamp())
        refresh = RefreshToken.for_user(self.user)
        refresh['iat'] = now - 179 * 60
        refresh['exp'] = now + 7 * 24 * 60 * 60
        self.client.cookies['refresh_token'] = str(refresh)

        response = self.client.post('/api/auth/refresh/')

        self.assertEqual(response.status_code, 200, response.content)
        access = AccessToken(response.json()['access_token'])
        self.assertLessEqual(int(access['exp']), int(refresh['iat']) + 3 * 60 * 60)

    def test_legacy_seven_day_refresh_token_expires_after_three_hours(self):
        now = int(timezone.now().timestamp())
        refresh = RefreshToken.for_user(self.user)
        refresh['iat'] = now - 181 * 60
        refresh['exp'] = now + 7 * 24 * 60 * 60
        self.client.cookies['refresh_token'] = str(refresh)

        response = self.client.post('/api/auth/refresh/')

        self.assertEqual(response.status_code, 401)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='info@crypgo.us.ci',
    PASSWORD_HASHERS=('django.contrib.auth.hashers.MD5PasswordHasher',),
)
class FirstLoginPasswordSetupTests(TestCase):
    proposed_password = 'NewSecurePass!482'

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = CustomUser.objects.create_user(
            username='first-setup-user',
            email='first-setup@example.com',
            password='OldPassword123!',
            password_setup_required=True,
            first_name='Ada',
            last_name='Lovelace',
        )

    def begin_setup(self, email=None):
        response = self.client.post(
            '/api/auth/login/',
            {
                'email': email or self.user.email,
                'password': 'the-password-I-want',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['requires_password_setup'])
        self.assertNotIn('access_token', response.json())
        self.assertNotIn('access_token', response.cookies)
        return response.json()['setup_token']

    def test_email_code_then_confirmation_sets_password_and_only_prompts_once(self):
        from django.core import mail

        response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'the-password-I-want'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertTrue(payload['requires_password_setup'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertEqual(mail.outbox[0].subject, 'Your Crypgo password setup code')
        self.assertIn('Hello Ada Lovelace,', mail.outbox[0].body)
        self.assertIn('This code expires in 15 minutes.', mail.outbox[0].body)
        self.assertIn('Crypgo Support', mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].alternatives, [])
        self.assertFalse(self.user.check_password(self.proposed_password))

        code_match = re.search(r'Verification code: (\d{6})', mail.outbox[0].body)
        self.assertIsNotNone(code_match)
        wrong_code = '000000' if code_match.group(1) != '000000' else '000001'
        verify_response = self.client.post(
            '/api/auth/login/first-password/verify-code/',
            {'setup_token': payload['setup_token'], 'code': wrong_code},
            format='json',
        )
        self.assertEqual(verify_response.status_code, 400)

        verify_response = self.client.post(
            '/api/auth/login/first-password/verify-code/',
            {'setup_token': payload['setup_token'], 'code': code_match.group(1)},
            format='json',
        )
        self.assertEqual(verify_response.status_code, 200, verify_response.content)

        complete_response = self.client.post(
            '/api/auth/login/first-password/complete/',
            {'setup_token': payload['setup_token'], 'password': self.proposed_password},
            format='json',
        )
        self.assertEqual(complete_response.status_code, 200, complete_response.content)
        self.assertIn('access_token', complete_response.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.proposed_password))
        self.assertFalse(self.user.password_setup_required)

        next_login = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': self.proposed_password},
            format='json',
        )
        self.assertEqual(next_login.status_code, 200, next_login.content)
        self.assertNotIn('requires_password_setup', next_login.json())
        self.assertIn('access_token', next_login.json())

    def test_password_cannot_be_changed_until_email_code_is_verified(self):
        setup_token = self.begin_setup()
        response = self.client.post(
            '/api/auth/login/first-password/complete/',
            {'setup_token': setup_token, 'password': self.proposed_password},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.password_setup_required)
        self.assertFalse(self.user.check_password(self.proposed_password))

    def test_five_incorrect_codes_lock_the_setup_challenge(self):
        from django.core import mail

        setup_token = self.begin_setup()
        for _ in range(5):
            response = self.client.post(
                '/api/auth/login/first-password/verify-code/',
                {'setup_token': setup_token, 'code': '000000'},
                format='json',
            )
            self.assertEqual(response.status_code, 400)

        challenge = FirstLoginPasswordSetupChallenge.objects.get()
        self.assertIsNotNone(challenge.used_at)
        code_match = re.search(r'Verification code: (\d{6})', mail.outbox[0].body)
        response = self.client.post(
            '/api/auth/login/first-password/verify-code/',
            {'setup_token': setup_token, 'code': code_match.group(1)},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_linked_accounts_share_password_and_choose_account_after_confirmation(self):
        self.user.email = 'first-setup@gmail.com'
        self.user.save(update_fields=['email'])
        second = CustomUser.objects.create_user(
            username='first-setup-second',
            email='first-setup+1@gmail.com',
            password='OldPassword123!',
            password_setup_required=True,
        )
        group = SharedInboxGroup.objects.create(inbox_email=self.user.email)
        group.users.add(self.user, second)

        login_response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'my-new-pass'},
            format='json',
        )
        self.assertEqual(login_response.status_code, 200, login_response.content)
        self.assertTrue(login_response.json()['requires_password_setup'])
        from django.core import mail
        code_match = re.search(r'Verification code: (\d{6})', mail.outbox[0].body)

        verify_response = self.client.post(
            '/api/auth/login/first-password/verify-code/',
            {
                'setup_token': login_response.json()['setup_token'],
                'code': code_match.group(1),
            },
            format='json',
        )
        self.assertEqual(verify_response.status_code, 200, verify_response.content)
        complete_response = self.client.post(
            '/api/auth/login/first-password/complete/',
            {
                'setup_token': login_response.json()['setup_token'],
                'password': self.proposed_password,
            },
            format='json',
        )
        self.assertEqual(complete_response.status_code, 200, complete_response.content)
        self.assertTrue(complete_response.json()['requires_account_selection'])
        self.assertNotIn('access_token', complete_response.json())
        self.user.refresh_from_db()
        second.refresh_from_db()
        self.assertTrue(self.user.check_password(self.proposed_password))
        self.assertTrue(second.check_password(self.proposed_password))
        self.assertFalse(self.user.password_setup_required)
        self.assertFalse(second.password_setup_required)

        selected = self.client.post(
            '/api/auth/login/select-account/',
            {
                'selection_token': complete_response.json()['selection_token'],
                'account_id': second.pk,
            },
            format='json',
        )
        self.assertEqual(selected.status_code, 200, selected.content)
        self.assertEqual(selected.json()['user']['id'], second.pk)


@override_settings(PASSWORD_HASHERS=('django.contrib.auth.hashers.MD5PasswordHasher',))
class FirstLoginPasswordResetCommandTests(TestCase):
    def test_command_dry_run_preserves_password_and_confirm_resets_customers_only(self):
        customer = CustomUser.objects.create_user(
            username='reset-customer',
            email='reset-customer@example.com',
            password='OldPassword123!',
        )
        already_flagged = CustomUser.objects.create_user(
            username='reset-flagged',
            email='reset-flagged@example.com',
            password='OldPassword123!',
            password_setup_required=True,
        )
        already_flagged.set_unusable_password()
        already_flagged.save(update_fields=['password'])
        staff = CustomUser.objects.create_user(
            username='reset-staff',
            email='reset-staff@example.com',
            password='AdminPassword123!',
            is_staff=True,
        )

        call_command('require_first_login_password_setup')
        customer.refresh_from_db()
        self.assertTrue(customer.check_password('OldPassword123!'))
        self.assertFalse(customer.password_setup_required)

        call_command('require_first_login_password_setup', confirm=True)

        customer.refresh_from_db()
        already_flagged.refresh_from_db()
        staff.refresh_from_db()
        self.assertFalse(customer.has_usable_password())
        self.assertTrue(customer.password_setup_required)
        self.assertFalse(already_flagged.has_usable_password())
        self.assertTrue(already_flagged.password_setup_required)
        self.assertTrue(staff.check_password('AdminPassword123!'))
        self.assertFalse(staff.password_setup_required)


class SharedInboxLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
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

    def test_non_gmail_plus_alias_login_uses_account_selection(self):
        self.group.delete()
        self.first.email = 'shared.account@outlook.com'
        self.first.save(update_fields=['email'])
        self.second.email = 'shared.account+1@outlook.com'
        self.second.save(update_fields=['email'])

        response = self.client.post(
            '/api/auth/login/',
            {'email': self.second.email, 'password': 'SharedPassword123!'},
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
            {'shared.account@outlook.com'},
        )

    @patch('apps.users.views.send_magic_link_email', return_value=True)
    def test_magic_link_requested_with_non_gmail_alias_goes_to_base_account(self, send_magic_link):
        self.group.delete()
        self.first.email = 'magic.person@outlook.com'
        self.first.save(update_fields=['email'])
        self.second.email = 'magic.person+1@outlook.com'
        self.second.save(update_fields=['email'])

        response = self.client.post(
            '/api/auth/magic-link/request/',
            {'email': self.second.email},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        send_magic_link.assert_called_once()
        self.assertEqual(send_magic_link.call_args.args[0].pk, self.first.pk)

    def test_linked_account_profile_uses_canonical_identity_and_email(self):
        self.client.force_authenticate(user=self.second)

        response = self.client.get('/api/users/me/')

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['email'], 'sirmattfrewer@gmail.com')
        self.assertEqual(response.json()['first_name'], 'Matt')
        self.assertEqual(response.json()['last_name'], 'Frewer')

    def test_unlinked_non_gmail_alias_profile_uses_base_account_identity(self):
        self.group.delete()
        self.first.email = 'profile.person@outlook.com'
        self.first.save(update_fields=['email'])
        self.second.email = 'profile.person+1@outlook.com'
        self.second.first_name = 'Different'
        self.second.country = 'Canada'
        self.second.save(update_fields=['email', 'first_name', 'country'])
        self.client.force_authenticate(user=self.second)

        response = self.client.get('/api/users/me/')

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['email'], 'profile.person@outlook.com')
        self.assertEqual(response.json()['first_name'], 'Matt')
        self.assertEqual(response.json()['country'], 'New Zealand')
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
        cache.clear()
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


class PasswordResetAccountSelectionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.first = CustomUser.objects.create_user(
            username='reset-base-account',
            email='reset.shared@gmail.com',
            password='OldPassword123!',
        )
        self.second = CustomUser.objects.create_user(
            username='reset-alias-account',
            email='reset.shared+1@gmail.com',
            password='OldPassword123!',
        )
        self.reset_token = PasswordResetToken.generate_token(self.first)

    @override_settings(
        DEFAULT_FROM_EMAIL='news.crypgo@gmail.com',
        EMAIL_FROM_NAME='Unexpected sender',
        FRONTEND_URL='https://app.example.com',
    )
    @patch('apps.users.services.send_mail', return_value=1)
    def test_password_reset_email_always_uses_support_sender(self, send_mail_mock):
        from .services import send_reset_password_email

        self.assertTrue(send_reset_password_email(self.second, self.reset_token))
        self.assertIn(self.second.username, send_mail_mock.call_args.kwargs['message'])
        self.assertIn(self.reset_token.token, send_mail_mock.call_args.kwargs['message'])
        self.assertNotIn('html_message', send_mail_mock.call_args.kwargs)
        self.assertEqual(
            send_mail_mock.call_args.kwargs['from_email'],
            'Crypgo <support.crypgo@gmail.com>',
        )
        self.assertEqual(send_mail_mock.call_args.kwargs['recipient_list'], [self.first.email])

    @patch('apps.users.services.send_mail', return_value=1)
    def test_transaction_caution_email_is_plain_text_only(self, send_mail_mock):
        from .services import send_transaction_caution_email

        self.assertTrue(send_transaction_caution_email(self.first))
        self.assertIn(self.first.username, send_mail_mock.call_args.kwargs['message'])
        self.assertNotIn('html_message', send_mail_mock.call_args.kwargs)

    @patch('apps.users.services.send_mail', return_value=1)
    def test_password_reset_email_routes_non_gmail_alias_to_canonical_inbox(self, send_mail_mock):
        from .services import send_reset_password_email

        self.first.email = 'reset.shared@outlook.com'
        self.first.save(update_fields=['email'])
        self.second.email = 'reset.shared+1@outlook.com'
        self.second.save(update_fields=['email'])

        self.assertTrue(send_reset_password_email(self.second, self.reset_token))
        self.assertEqual(
            send_mail_mock.call_args.kwargs['recipient_list'],
            ['reset.shared@outlook.com'],
        )

    def test_reset_confirmation_requires_account_choice_for_gmail_aliases(self):
        response = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': self.reset_token.token},
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertTrue(payload['valid'])
        self.assertTrue(payload['requires_account_selection'])
        self.assertEqual(
            {account['id'] for account in payload['accounts']},
            {self.first.pk, self.second.pk},
        )
        self.assertEqual(
            {account['email_hint'] for account in payload['accounts']},
            {self.first.email},
        )
        self.assertTrue(self.reset_token.is_valid())

    @patch('apps.users.views.send_reset_password_email', return_value=True)
    def test_non_gmail_alias_forgot_password_sends_to_base_and_offers_account_choice(self, send_reset):
        base = CustomUser.objects.create_user(
            username='outlook-reset-base',
            email='reset.person@outlook.com',
            password='OldPassword123!',
        )
        alias = CustomUser.objects.create_user(
            username='outlook-reset-alias',
            email='reset.person+1@outlook.com',
            password='OldPassword123!',
        )

        response = self.client.post(
            '/api/auth/forgot-password/',
            {'email': alias.email},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        send_reset.assert_called_once()
        self.assertEqual(send_reset.call_args.args[0].pk, base.pk)
        reset_token = send_reset.call_args.args[1]
        confirmation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': reset_token.token},
        )
        self.assertEqual(confirmation.status_code, 200, confirmation.content)
        self.assertTrue(confirmation.json()['requires_account_selection'])
        self.assertEqual(
            {account['id'] for account in confirmation.json()['accounts']},
            {base.pk, alias.pk},
        )
        self.assertEqual(
            {account['email_hint'] for account in confirmation.json()['accounts']},
            {base.email},
        )

    def test_selected_account_alone_is_reset_and_selection_is_one_time(self):
        confirmation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': self.reset_token.token},
        )
        selection = self.client.post(
            '/api/auth/reset-password/select-account/',
            {
                'selection_token': confirmation.json()['selection_token'],
                'account_id': self.second.pk,
            },
            format='json',
        )

        self.assertEqual(selection.status_code, 200, selection.content)
        self.reset_token.refresh_from_db()
        self.assertTrue(self.reset_token.is_valid())

        bypass = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': self.reset_token.token,
                'new_password': 'BypassPassword789!',
                'confirm_password': 'BypassPassword789!',
            },
            format='json',
        )
        self.assertEqual(bypass.status_code, 400)

        update = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': selection.json()['reset_token'],
                'new_password': 'NewPassword456!',
                'confirm_password': 'NewPassword456!',
            },
            format='json',
        )

        self.assertEqual(update.status_code, 200, update.content)
        self.first.refresh_from_db()
        self.second.refresh_from_db()
        self.reset_token.refresh_from_db()
        self.assertTrue(self.first.check_password('OldPassword123!'))
        self.assertTrue(self.second.check_password('NewPassword456!'))
        self.assertFalse(self.reset_token.is_valid())

        reused_selection = self.client.post(
            '/api/auth/reset-password/select-account/',
            {
                'selection_token': confirmation.json()['selection_token'],
                'account_id': self.first.pk,
            },
            format='json',
        )
        self.assertEqual(reused_selection.status_code, 400)

    def test_reset_challenge_cannot_select_an_unrelated_account(self):
        outsider = CustomUser.objects.create_user(
            username='reset-outsider',
            email='reset-outsider@example.com',
            password='OldPassword123!',
        )
        confirmation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': self.reset_token.token},
        )

        response = self.client.post(
            '/api/auth/reset-password/select-account/',
            {
                'selection_token': confirmation.json()['selection_token'],
                'account_id': outsider.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.reset_token.refresh_from_db()
        self.assertTrue(self.reset_token.is_valid())

    def test_magic_password_link_selects_and_resets_only_chosen_alias_account(self):
        magic_token, raw_token = MagicLinkToken.generate_token(self.first)
        confirmation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': raw_token},
        )

        self.assertEqual(confirmation.status_code, 200, confirmation.content)
        self.assertTrue(confirmation.json()['requires_account_selection'])
        magic_token.refresh_from_db()
        self.assertIsNone(magic_token.used_at)

        selection = self.client.post(
            '/api/auth/reset-password/select-account/',
            {
                'selection_token': confirmation.json()['selection_token'],
                'account_id': self.second.pk,
            },
            format='json',
        )
        self.assertEqual(selection.status_code, 200, selection.content)

        update = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': selection.json()['reset_token'],
                'new_password': 'MagicReset456!',
                'confirm_password': 'MagicReset456!',
            },
            format='json',
        )

        self.assertEqual(update.status_code, 200, update.content)
        self.first.refresh_from_db()
        self.second.refresh_from_db()
        magic_token.refresh_from_db()
        self.assertTrue(self.first.check_password('OldPassword123!'))
        self.assertTrue(self.second.check_password('MagicReset456!'))
        self.assertIsNotNone(magic_token.used_at)

    def test_single_account_magic_password_link_updates_password_without_signing_in(self):
        self.second.delete()
        magic_token, raw_token = MagicLinkToken.generate_token(self.first)

        confirmation = self.client.get(
            '/api/auth/reset-password/confirm/',
            {'token': raw_token},
        )
        self.assertEqual(confirmation.status_code, 200, confirmation.content)
        self.assertNotIn('requires_account_selection', confirmation.json())
        self.assertFalse(confirmation.cookies)

        update = self.client.post(
            '/api/auth/reset-password/update/',
            {
                'token': raw_token,
                'new_password': 'MagicReset456!',
                'confirm_password': 'MagicReset456!',
            },
            format='json',
        )

        self.assertEqual(update.status_code, 200, update.content)
        self.first.refresh_from_db()
        magic_token.refresh_from_db()
        self.assertTrue(self.first.check_password('MagicReset456!'))
        self.assertIsNotNone(magic_token.used_at)


class UserReportLayoutTests(TestCase):
    def test_report_displays_base_address_for_plus_tag_account_on_any_domain(self):
        from generate_user_report import generate_user_report_bytes
        import pymupdf

        user = CustomUser.objects.create_user(
            username='plus-tag-report-user',
            email='report+tag@outlook.com',
            password='Password123!',
        )

        document = pymupdf.open(
            stream=generate_user_report_bytes(user),
            filetype='pdf',
        )

        report_text = cast(str, document[0].get_text())
        self.assertIn('Email: report@outlook.com', report_text)
        self.assertNotIn('report+tag@outlook.com', report_text)

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
        self.assertEqual(prices['BTC'], Decimal('83000.00'))
        self.assertEqual(prices['ETH'], Decimal('2500.00'))
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
        self.assertIn('USD valuations use fixed manual USD crypto prices and are not live', report_text)
        self.assertIn('$83,000.00', report_text)
        self.assertIn('$166,000.00', report_text)
        self.assertIn('$2,500.00', report_text)
        self.assertIn('$67.29', report_text)
        self.assertIn('$201.87', report_text)
        self.assertIn('Value: $168,701.87', report_text)

    def test_default_report_prices_load_from_local_manual_file(self):
        from decimal import Decimal
        from generate_user_report import DEFAULT_PRICE_CACHE_PATH, REPORT_TICKERS, get_report_usd_prices

        with patch.dict(os.environ):
            os.environ.pop('CRYPGO_REPORT_PRICE_CACHE', None)
            prices = get_report_usd_prices(set(REPORT_TICKERS))

        self.assertEqual(DEFAULT_PRICE_CACHE_PATH.name, 'user_report_prices.json')
        self.assertEqual(prices['BTC'], Decimal('83000.00'))
        self.assertEqual(prices['ETH'], Decimal('2500.00'))
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
        self.assertEqual(
            get_transaction_fiat_display(
                SimpleNamespace(fiat_amount=Decimal('20'), amount=Decimal('2'), price_at_time=None, asset='BTC'),
                {'BTC': Decimal('100')},
                currency='BRL',
                currency_rate=Decimal('5'),
            ),
            'R$ 100.00',
        )

    def test_non_usd_report_converts_holdings_and_discloses_exchange_rate(self):
        from generate_user_report import generate_user_report_bytes
        import pymupdf

        user = CustomUser.objects.create_user(
            username='brl-report-user',
            email='brl-report@example.com',
            password='Password123!',
            display_currency='BRL',
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

        with (
            patch('generate_user_report.get_report_usd_prices', return_value={'BTC': Decimal('100')}),
            patch('generate_user_report.MARKET_PRICE_AS_OF', 'June 28, 2025 at 00:00 UTC'),
            patch('generate_user_report.MARKET_PRICE_SOURCE', 'manual_override'),
        ):
            document = pymupdf.open(
                stream=generate_user_report_bytes(
                    user,
                    currency_rate=Decimal('5'),
                    exchange_rate_as_of='June 28, 2025 at 00:00 UTC',
                ),
                filetype='pdf',
            )

        report_text = ' '.join(cast(str, document[0].get_text()).split())
        self.assertIn('Currency: BRL', report_text)
        self.assertIn('Unit Price (BRL)', report_text)
        self.assertIn('Fiat Value (BRL)', report_text)
        self.assertIn('R$ 500.00', report_text)
        self.assertIn('R$ 1,000.00', report_text)
        self.assertIn('Value: R$ 1,000.00', report_text)
        self.assertIn('1 USD = 5.000000 BRL', report_text)
        self.assertIn('rate updated June 28, 2025 at 00:00 UTC', report_text)

    def test_report_download_requires_a_valid_rate_for_saved_non_usd_currency(self):
        user = CustomUser.objects.create_user(
            username='rate-required-report-user',
            email='rate-required-report@example.com',
            password='Password123!',
            display_currency='BRL',
        )
        client = APIClient()
        client.force_authenticate(user)

        response = client.get('/api/users/report/')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('display_currency_rate', response.json())

    def test_report_download_converts_to_saved_display_currency(self):
        import pymupdf

        user = CustomUser.objects.create_user(
            username='converted-report-user',
            email='converted-report@example.com',
            password='Password123!',
            display_currency='BRL',
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
        client = APIClient()
        client.force_authenticate(user)

        response = client.get('/api/users/report/', {
            'display_currency_rate': '5',
            'display_currency_rate_as_of': 'Sat, 28 Jun 2025 00:00:00 +0000',
        })

        self.assertEqual(response.status_code, 200, response.content)
        document = pymupdf.open(stream=response.content, filetype='pdf')
        report_text = ' '.join(cast(str, document[0].get_text()).split())
        self.assertIn('Currency: BRL', report_text)
        self.assertIn('Fiat Value (BRL)', report_text)
        self.assertIn('R$ 415,000.00', report_text)
        self.assertIn('1 USD = 5.000000 BRL', report_text)

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
    def test_transfer_and_swap_are_not_limited_by_transaction_caution_guard(self, send_mail):
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
        third = self.client.post(
            '/api/wallet/transfer/',
            {'recipient': self.recipient.email, 'asset': 'BTC', 'amount': '1'},
            format='json',
        )
        fourth = self.client.post(
            '/api/wallet/swap/',
            {'from_asset': 'BTC', 'to_asset': 'ETH', 'amount': '1'},
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(third.status_code, 200, third.content)
        self.assertEqual(fourth.status_code, 200, fourth.content)
        send_mail.assert_not_called()
        self.user.refresh_from_db()
        self.assertEqual(self.user.transaction_guard_success_count, 0)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 4)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_quantity, Decimal('6.00000000'))


class SeededTransactionAddressTests(TestCase):
    def test_transaction_addresses_are_deterministic_and_reused(self):
        first = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 1, 'receive')
        second = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 1, 'receive')
        third = build_transaction_address('sirmattfrewer@gmail.com', 'BTC', 9, 'receive')

        self.assertEqual(first, second)
        self.assertTrue(first.startswith('bc1q'))
        self.assertNotIn('Unknown', first)
        self.assertNotEqual(first, third)

    def test_transaction_address_changes_with_account_asset_or_direction(self):
        base = build_transaction_address('user@example.com', 'BTC', 1, 'receive')

        self.assertNotEqual(
            base,
            build_transaction_address('other@example.com', 'BTC', 1, 'receive'),
        )
        self.assertNotEqual(
            base,
            build_transaction_address('user@example.com', 'ETH', 1, 'receive'),
        )
        self.assertNotEqual(
            base,
            build_transaction_address('user@example.com', 'BTC', 1, 'send'),
        )

    def test_transaction_address_uses_asset_specific_display_formats(self):
        self.assertTrue(
            build_transaction_address('user@example.com', 'ETH', 1, 'receive').startswith('0x')
        )
        self.assertEqual(
            len(build_transaction_address('user@example.com', 'SOL', 1, 'receive')),
            44,
        )


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

    def test_campaign_link_allows_selection_of_gmail_plus_alias_account(self):
        alias = CustomUser.objects.create_user(
            username='campaign-user-alias',
            email='campaign+1@gmail.com',
            password='Password123!',
        )
        self.user.email = 'campaign@gmail.com'
        self.user.save(update_fields=['email'])
        token, raw_token = CampaignAccessToken.generate_token(self.user, 'campaign-1')

        response = self.client.post(
            '/api/auth/campaign-access/consume/',
            {'token': raw_token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['requires_account_selection'])
        self.assertEqual(
            {account['id'] for account in payload['accounts']},
            {self.user.pk, alias.pk},
        )

        selected = self.client.post(
            '/api/auth/login/select-account/',
            {
                'selection_token': payload['selection_token'],
                'account_id': alias.pk,
            },
            format='json',
        )

        token.refresh_from_db()
        self.assertEqual(selected.status_code, 200)
        self.assertTrue(selected.cookies.get('access_token'))
        self.assertEqual(token.use_count, 1)

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

    def test_signed_export_groups_gmail_plus_aliases_and_keeps_account_emails(self):
        alias = CustomUser.objects.create_user(
            username='export-user-alias',
            email='export+1@gmail.com',
            password='Password123!',
            first_name='Alias',
            last_name='User',
        )
        self.user.email = 'export@gmail.com'
        self.user.save(update_fields=['email'])
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
        recipients = response.json()['recipients']
        grouped = next(item for item in recipients if item['email'] == 'export@gmail.com')
        self.assertEqual(grouped['external_user_id'], str(self.user.pk))
        self.assertEqual(
            set(grouped['account_emails']),
            {'export@gmail.com', 'export+1@gmail.com'},
        )
        self.assertEqual(
            sum(item['email'] == 'export@gmail.com' for item in recipients),
            1,
        )

    def test_signed_export_groups_non_gmail_plus_aliases(self):
        base = CustomUser.objects.create_user(
            username='outlook-export-base',
            email='export.person@outlook.com',
            password='Password123!',
            first_name='Export',
            last_name='Person',
        )
        alias = CustomUser.objects.create_user(
            username='outlook-export-alias',
            email='export.person+1@outlook.com',
            password='Password123!',
            first_name='Export',
            last_name='Person',
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

        self.assertEqual(response.status_code, 200, response.content)
        recipients = response.json()['recipients']
        grouped = next(item for item in recipients if item['email'] == base.email)
        self.assertEqual(
            set(grouped['account_emails']),
            {base.email, alias.email},
        )
        self.assertEqual(
            sum(item['email'] == base.email for item in recipients),
            1,
        )


@override_settings(BOT_SERVICE_KEY='test-bot-service-key')
class CampaignAccountExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.first = CustomUser.objects.create_user(
            username='target-export-first',
            email='target@example.com',
            password='Password123!',
            first_name='Target',
            last_name='First',
        )
        self.second = CustomUser.objects.create_user(
            username='target-export-second',
            email='target+second@example.com',
            password='Password123!',
            first_name='Target',
            last_name='Second',
        )

    def signed_export(self, campaign_ref, payload):
        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        signature = hmac.new(
            b'test-bot-service-key',
            body,
            hashlib.sha256,
        ).hexdigest()
        return self.client.post(
            f'/api/internal/campaigns/{campaign_ref}/accounts/export/',
            data=body,
            content_type='application/json',
            HTTP_X_BOT_SIGNATURE=signature,
        )

    def test_signed_export_lists_individual_accounts_without_creating_access_links(self):
        response = self.signed_export('targeted-directory', {})

        self.assertEqual(response.status_code, 200, response.content)
        accounts = response.json()['accounts']
        self.assertEqual(
            {account['external_user_id'] for account in accounts},
            {str(self.first.pk), str(self.second.pk)},
        )
        self.assertEqual(
            {account['email'] for account in accounts},
            {self.first.email, self.second.email},
        )
        self.assertTrue(all('dashboard_url' not in account for account in accounts))
        self.assertFalse(CampaignAccessToken.objects.exists())

    def test_signed_export_returns_only_selected_account_with_access_link(self):
        response = self.signed_export(
            'targeted-campaign-42',
            {'user_ids': [self.second.pk]},
        )

        self.assertEqual(response.status_code, 200, response.content)
        accounts = response.json()['accounts']
        self.assertEqual(len(accounts), 1)
        self.assertEqual(accounts[0]['external_user_id'], str(self.second.pk))
        self.assertEqual(accounts[0]['email'], self.second.email)
        self.assertIn('/auth/campaign-access?token=', accounts[0]['dashboard_url'])
        token = CampaignAccessToken.objects.get(user=self.second)
        self.assertEqual(token.campaign_ref, 'targeted-campaign-42')
        self.assertFalse(CampaignAccessToken.objects.filter(user=self.first).exists())

    def test_signed_export_rejects_empty_or_invalid_account_selection(self):
        for user_ids in ([], [0], ['not-an-id']):
            with self.subTest(user_ids=user_ids):
                response = self.signed_export('targeted-campaign-42', {'user_ids': user_ids})
                self.assertEqual(response.status_code, 400, response.content)

    def test_signed_export_does_not_issue_links_for_inactive_or_unknown_selection(self):
        response = self.signed_export(
            'targeted-campaign-42',
            {'user_ids': [self.first.pk, 999999]},
        )

        self.assertEqual(response.status_code, 409, response.content)
        self.assertFalse(CampaignAccessToken.objects.exists())
