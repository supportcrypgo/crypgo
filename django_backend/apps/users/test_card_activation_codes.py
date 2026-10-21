import re
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    CardActivationCode,
    CardApplication,
    CardDeliveryAddress,
    CustomUser,
)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class CardActivationCodeAPITests(TestCase):
    request_endpoint = '/api/users/card-activation-code/request/'
    verify_endpoint = '/api/users/card-activation-code/verify/'
    processing_access_endpoint = '/api/users/card-activation-code/processing-access/'

    def setUp(self):
        cache.clear()
        mail.outbox = []
        self.client = APIClient()
        self.user = self.create_user('activation-one')
        self.other_user = self.create_user('activation-two')

    def create_user(self, username):
        user = CustomUser.objects.create_user(
            username=username,
            email=f'{username}@example.com',
            password='Password123!',
        )
        CardDeliveryAddress.objects.create(
            user=user,
            street_address='123 Main Street',
            city='San Francisco',
            state='CA',
            zip_code='94105',
            country='US',
        )
        return user

    def request_code(self, user=None):
        self.client.force_authenticate(user=user or self.user)
        return self.client.post(self.request_endpoint, {}, format='json')

    @staticmethod
    def code_from_email(message):
        match = re.search(
            r'verification code on the activation screen:\s*(\d{6})',
            message.body,
        )
        if match is None:
            raise AssertionError('Six-digit activation code was not present in the email body.')
        return match.group(1)

    def test_request_emails_unique_six_digit_code_that_expires_in_fifteen_minutes(self):
        before_request = timezone.now()

        response = self.request_code()

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['sent'])
        self.assertEqual(response.json()['detail'], 'Please check your email.')
        self.assertEqual(response.json()['resend_available_in'], 30)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Complete your card activation')
        self.assertEqual(message.to, [self.user.email])
        self.assertEqual(
            message.from_email,
            'info@crypgo.us.ci',
        )
        self.assertIn(f'Hi {self.user.username},', message.body)
        self.assertIn(
            'To complete your Crypgo card activation, enter this verification code',
            message.body,
        )
        self.assertIn('This code expires in 15 minutes.', message.body)
        self.assertIn(
            'If you didn’t request this card activation code, you can ignore this email.',
            message.body,
        )
        self.assertIn('https://crypgo.us.ci/ and change your password.', message.body)
        self.assertTrue(message.body.endswith('Thanks,\nCrypgo'))

        code = self.code_from_email(message)
        token = CardActivationCode.objects.get(user=self.user)
        self.assertRegex(code, r'^\d{6}$')
        self.assertNotEqual(token.code_hash, code)
        self.assertGreaterEqual(token.expires_at, before_request + timedelta(minutes=15))
        self.assertLessEqual(token.expires_at, timezone.now() + timedelta(minutes=15))

    def test_existing_active_code_is_not_resent_on_page_reentry(self):
        first_response = self.request_code()
        repeat_responses = [self.request_code() for _ in range(4)]

        self.assertEqual(first_response.status_code, 200)
        self.assertTrue(all(response.status_code == 200 for response in repeat_responses))
        self.assertFalse(any(response.json()['sent'] for response in repeat_responses))
        self.assertTrue(all(response.json()['detail'] == 'Please check your email.' for response in repeat_responses))
        self.assertTrue(all(response.json()['resend_available_in'] == 30 for response in repeat_responses))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(CardActivationCode.objects.filter(user=self.user).count(), 1)

    def test_resend_is_rejected_until_thirty_second_cooldown_expires(self):
        first_response = self.request_code()

        response = self.client.post(
            self.request_endpoint,
            {'resend': True},
            format='json',
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()['detail'], 'Please wait before requesting another code.')
        self.assertGreater(response.json()['resend_available_in'], 0)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(CardActivationCode.objects.filter(user=self.user).count(), 1)

    def test_resend_invalidates_previous_code(self):
        self.request_code()
        old_code = self.code_from_email(mail.outbox[0])
        CardActivationCode.objects.filter(user=self.user).update(
            issued_at=timezone.now() - timedelta(seconds=31),
        )

        response = self.client.post(
            self.request_endpoint,
            {'resend': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['sent'])
        self.assertEqual(len(mail.outbox), 2)
        new_code = self.code_from_email(mail.outbox[1])
        self.assertNotEqual(old_code, new_code)

        old_code_response = self.client.post(
            self.verify_endpoint,
            {'code': old_code},
            format='json',
        )
        new_code_response = self.client.post(
            self.verify_endpoint,
            {'code': new_code},
            format='json',
        )

        self.assertEqual(old_code_response.status_code, 400)
        self.assertEqual(new_code_response.status_code, 200)

    def test_activation_code_is_account_bound_and_can_only_be_consumed_once(self):
        self.request_code()
        code = self.code_from_email(mail.outbox[0])
        before_verification = timezone.now()

        self.client.force_authenticate(user=self.other_user)
        other_user_response = self.client.post(
            self.verify_endpoint,
            {'code': code},
            format='json',
        )
        self.assertEqual(other_user_response.status_code, 400)

        self.client.force_authenticate(user=self.user)
        first_use = self.client.post(self.verify_endpoint, {'code': code}, format='json')
        second_use = self.client.post(self.verify_endpoint, {'code': code}, format='json')

        self.assertEqual(first_use.status_code, 200)
        self.assertTrue(first_use.json()['verified'])
        self.assertTrue(first_use.json()['processing_ticket'])
        self.assertEqual(
            CardApplication.objects.get(user=self.user).status,
            CardApplication.STATUS_ACTIVATION_PENDING,
        )
        application = CardApplication.objects.get(user=self.user)
        self.assertGreaterEqual(
            application.cancellation_due_at,
            before_verification + timedelta(hours=23),
        )
        self.assertLessEqual(
            application.cancellation_due_at,
            timezone.now() + timedelta(hours=23),
        )
        self.assertEqual(second_use.status_code, 400)

    def test_activation_code_is_bound_to_the_selected_application(self):
        self.client.force_authenticate(user=self.user)
        first_application = self.client.post(
            '/api/users/card-applications/',
            {},
            format='json',
        ).json()
        second_application = self.client.post(
            '/api/users/card-applications/',
            {},
            format='json',
        ).json()
        for application in (first_application, second_application):
            CardDeliveryAddress.objects.create(
                user=self.user,
                application_id=application['id'],
                street_address='123 Main Street',
                city='San Francisco',
                state='CA',
                zip_code='94105',
                country='US',
            )

        request_response = self.client.post(
            self.request_endpoint,
            {'application_id': first_application['id']},
            format='json',
        )
        code = self.code_from_email(mail.outbox[0])
        wrong_application = self.client.post(
            self.verify_endpoint,
            {'code': code, 'application_id': second_application['id']},
            format='json',
        )
        correct_application = self.client.post(
            self.verify_endpoint,
            {'code': code, 'application_id': first_application['id']},
            format='json',
        )

        self.assertEqual(request_response.status_code, 200)
        self.assertEqual(wrong_application.status_code, 400)
        self.assertEqual(correct_application.status_code, 200)
        self.assertEqual(
            CardApplication.objects.get(pk=first_application['id']).status,
            CardApplication.STATUS_ACTIVATION_PENDING,
        )
        self.assertEqual(
            CardApplication.objects.get(pk=second_application['id']).status,
            CardApplication.STATUS_DRAFT,
        )

    def test_processing_page_requires_a_valid_ticket_from_email_code_verification(self):
        self.request_code()
        code = self.code_from_email(mail.outbox[0])
        verification = self.client.post(
            self.verify_endpoint,
            {'code': code},
            format='json',
        )
        ticket = verification.json()['processing_ticket']

        authorized = self.client.post(
            self.processing_access_endpoint,
            {'ticket': ticket},
            format='json',
        )
        missing_ticket = self.client.post(
            self.processing_access_endpoint,
            {},
            format='json',
        )
        forged_ticket = self.client.post(
            self.processing_access_endpoint,
            {'ticket': 'not-a-valid-ticket'},
            format='json',
        )

        self.assertEqual(verification.status_code, 200)
        self.assertEqual(authorized.status_code, 200)
        self.assertEqual(authorized.json(), {'authorized': True})
        self.assertEqual(missing_ticket.status_code, 400)
        self.assertEqual(forged_ticket.status_code, 400)

    def test_processing_ticket_is_bound_to_the_account_that_verified_the_code(self):
        self.request_code()
        code = self.code_from_email(mail.outbox[0])
        verification = self.client.post(
            self.verify_endpoint,
            {'code': code},
            format='json',
        )

        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(
            self.processing_access_endpoint,
            {'ticket': verification.json()['processing_ticket']},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_expired_code_is_rejected(self):
        self.request_code()
        code = self.code_from_email(mail.outbox[0])
        CardActivationCode.objects.filter(user=self.user).update(
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.post(
            self.verify_endpoint,
            {'code': code},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_alphanumeric_code_is_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.verify_endpoint,
            {'code': '12A456'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_code_is_not_issued_without_saved_delivery_address(self):
        user_without_address = CustomUser.objects.create_user(
            username='no-card-address',
            email='no-card-address@example.com',
            password='Password123!',
        )

        response = self.request_code(user_without_address)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_code_values_never_repeat_between_users(self):
        with patch(
            'apps.users.views.get_random_string',
            side_effect=['123456', '123456', '654321'],
        ):
            first_response = self.request_code(self.user)
            second_response = self.request_code(self.other_user)

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        first_code = self.code_from_email(mail.outbox[0])
        second_code = self.code_from_email(mail.outbox[1])
        self.assertEqual(first_code, '123456')
        self.assertEqual(second_code, '654321')
        self.assertEqual(CardActivationCode.objects.values('code_hash').distinct().count(), 2)
