from datetime import date, timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TestCase, TransactionTestCase
from django.test.utils import override_settings
from django.utils import timezone
from django.contrib import admin
from django.contrib.auth.hashers import make_password
from django.test import RequestFactory
from django.core.management import call_command
from django.core import signing
from rest_framework.test import APIClient
from unittest.mock import Mock, patch

from .admin import CardApplicationAdmin
from .models import (
    CardApplication,
    CardApplicationAsset,
    CardDeliveryAddress,
    CardApplicationNumber,
    CustomUser,
)
from .services import (
    send_card_application_approval_email,
    send_card_application_cancellation_email,
)


class CardApplicationsAPITests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='multi-card-user',
            email='multi-card@example.com',
            password='Password123!',
        )
        self.other_user = CustomUser.objects.create_user(
            username='other-multi-card-user',
            email='other-multi-card@example.com',
            password='Password123!',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def create_application(self):
        response = self.client.post(
            '/api/users/card-applications/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def save_asset(self, application_id, ticker):
        return self.client.patch(
            '/api/users/card-issuer/',
            {'application_id': application_id, 'source_asset': ticker},
            format='json',
        )

    def test_approved_application_includes_pending_approval_notice(self):
        application = self.create_application()
        CardApplication.objects.filter(pk=application['id']).update(
            status=CardApplication.STATUS_APPROVED,
        )

        response = self.client.get('/api/users/card-applications/')

        self.assertEqual(response.status_code, 200, response.content)
        approved_application = next(
            item for item in response.json()['applications']
            if item['id'] == application['id']
        )
        self.assertTrue(approved_application['approval_notice_pending'])

    def test_owner_can_dismiss_approval_notice_idempotently(self):
        application = self.create_application()
        CardApplication.objects.filter(pk=application['id']).update(
            status=CardApplication.STATUS_APPROVED,
        )
        url = (
            f"/api/users/card-applications/{application['id']}"
            '/dismiss-approval-notice/'
        )

        first_response = self.client.post(url)
        second_response = self.client.post(url)

        self.assertEqual(first_response.status_code, 204, first_response.content)
        self.assertEqual(second_response.status_code, 204, second_response.content)
        listing = self.client.get('/api/users/card-applications/').json()
        dismissed_application = next(
            item for item in listing['applications']
            if item['id'] == application['id']
        )
        self.assertFalse(dismissed_application['approval_notice_pending'])
        self.assertIsNotNone(
            CardApplication.objects.get(pk=application['id']).approval_notice_dismissed_at,
        )

    def test_approval_notice_cannot_be_dismissed_for_unapproved_or_other_users(self):
        unapproved_application = self.create_application()
        unapproved_response = self.client.post(
            f"/api/users/card-applications/{unapproved_application['id']}"
            '/dismiss-approval-notice/',
        )
        self.assertEqual(unapproved_response.status_code, 404)

        approved_application = self.create_application()
        CardApplication.objects.filter(pk=approved_application['id']).update(
            status=CardApplication.STATUS_APPROVED,
        )
        self.client.force_authenticate(user=self.other_user)
        other_user_response = self.client.post(
            f"/api/users/card-applications/{approved_application['id']}"
            '/dismiss-approval-notice/',
        )

        self.assertEqual(other_user_response.status_code, 404)
        self.assertIsNone(
            CardApplication.objects.get(pk=approved_application['id']).approval_notice_dismissed_at,
        )

    def test_user_can_create_multiple_applications_with_distinct_card_numbers(self):
        first = self.create_application()
        second = self.create_application()

        self.assertNotEqual(first['id'], second['id'])
        self.assertNotEqual(first['card_number'], second['card_number'])
        self.assertEqual(CardApplication.objects.filter(user=self.user).count(), 2)

    def test_deleting_application_releases_asset_for_future_applications(self):
        first = self.create_application()
        second = self.create_application()

        first_asset = self.save_asset(first['id'], 'BTC')
        duplicate_asset = self.save_asset(second['id'], 'BTC')
        second_asset = self.save_asset(second['id'], 'ETH')

        self.assertEqual(first_asset.status_code, 200, first_asset.content)
        self.assertEqual(duplicate_asset.status_code, 409)
        self.assertEqual(second_asset.status_code, 200, second_asset.content)

        self.client.delete(f"/api/users/card-applications/{first['id']}/")
        application_list = self.client.get('/api/users/card-applications/').json()

        self.assertIn('BTC', application_list['available_source_assets'])
        self.assertNotIn('ETH', application_list['available_source_assets'])
        self.assertFalse(CardApplicationAsset.objects.filter(user=self.user, ticker='BTC').exists())

        retry = self.create_application()
        retry_asset = self.save_asset(retry['id'], 'BTC')
        self.assertEqual(retry_asset.status_code, 200, retry_asset.content)

    def test_pending_application_asset_conflict_returns_specific_message_and_code(self):
        first = self.create_application()
        self.assertEqual(self.save_asset(first['id'], 'BTC').status_code, 200)
        CardApplication.objects.filter(pk=first['id']).update(
            status=CardApplication.STATUS_ACTIVATION_PENDING,
        )
        second = self.create_application()

        response = self.save_asset(second['id'], 'BTC')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()['error'],
            'You already have a pending card application. Choose a different asset.',
        )
        self.assertEqual(response.json()['code'], 'CARD_APPLICATION_ALREADY_PENDING')

    def test_card_numbers_remain_reserved_after_application_deletion(self):
        first = self.create_application()
        self.assertEqual(self.save_asset(first['id'], 'BTC').status_code, 200)
        number_record = CardApplicationNumber.objects.get(
            application_id=first['id'],
        )

        response = self.client.delete(
            f"/api/users/card-applications/{first['id']}/",
        )

        self.assertEqual(response.status_code, 204)
        number_record.refresh_from_db()
        self.assertIsNone(number_record.application_id)
        self.assertEqual(number_record.number, first['card_number'])

        next_application = self.create_application()
        self.assertNotEqual(next_application['card_number'], first['card_number'])
        self.assertEqual(
            CardApplicationNumber.objects.filter(number=first['card_number']).count(),
            1,
        )

    def test_deleting_pending_application_before_deadline_removes_it(self):
        application = self.create_application()
        self.assertEqual(self.save_asset(application['id'], 'BTC').status_code, 200)
        CardApplication.objects.filter(pk=application['id']).update(
            status=CardApplication.STATUS_ACTIVATION_PENDING,
            cancellation_due_at=timezone.now() + timedelta(hours=23),
        )
        number_record = CardApplicationNumber.objects.get(
            application_id=application['id'],
        )

        response = self.client.delete(
            f"/api/users/card-applications/{application['id']}/",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(CardApplication.objects.filter(pk=application['id']).exists())
        self.assertFalse(
            CardApplication.objects.filter(status=CardApplication.STATUS_CANCELED).exists(),
        )
        self.assertFalse(
            CardApplicationAsset.objects.filter(user=self.user, ticker='BTC').exists(),
        )
        number_record.refresh_from_db()
        self.assertIsNone(number_record.application_id)

    def test_application_details_are_private_to_the_owner(self):
        application = self.create_application()
        self.client.force_authenticate(user=self.other_user)

        response = self.client.get(
            f"/api/users/card-applications/{application['id']}/",
        )
        issuer_response = self.client.get(
            '/api/users/card-issuer/',
            {'application_id': application['id']},
        )
        address_response = self.client.get(
            '/api/users/card-delivery-address/',
            {'application_id': application['id']},
        )
        delete_response = self.client.delete(
            f"/api/users/card-applications/{application['id']}/",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(issuer_response.status_code, 404)
        self.assertEqual(address_response.status_code, 404)
        self.assertEqual(delete_response.status_code, 404)
        self.assertTrue(CardApplication.objects.filter(pk=application['id'], user=self.user).exists())

    def test_application_list_and_available_assets_are_scoped_to_the_owner(self):
        own_application = self.create_application()
        self.assertEqual(self.save_asset(own_application['id'], 'BTC').status_code, 200)

        self.client.force_authenticate(user=self.other_user)
        other_application_response = self.client.post(
            '/api/users/card-applications/',
            {},
            format='json',
        )
        self.assertEqual(other_application_response.status_code, 201)
        other_application = other_application_response.json()
        self.assertEqual(self.save_asset(other_application['id'], 'ETH').status_code, 200)

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/users/card-applications/')

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(
            [application['id'] for application in payload['applications']],
            [own_application['id']],
        )
        self.assertNotIn('BTC', payload['available_source_assets'])
        self.assertIn('ETH', payload['available_source_assets'])


class CardApplicationCancellationTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='card-cancellation-user',
            email='card-cancellation@example.com',
            password='Password123!',
            first_name='Jordan',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.application = CardApplication.objects.create(
            user=self.user,
            status=CardApplication.STATUS_ACTIVATION_PENDING,
            source_asset='BTC',
        )
        CardApplicationAsset.objects.create(
            user=self.user,
            ticker='BTC',
            application=self.application,
        )
        self.number_record = CardApplicationNumber.objects.create(
            application=self.application,
        )

    @patch('apps.users.services.send_mail', return_value=1)
    def test_approval_email_uses_requested_copy_and_card_number(self, send_mail):
        sent = send_card_application_approval_email(self.application)

        self.assertTrue(sent)
        self.assertEqual(send_mail.call_args.kwargs['subject'], 'Your Card Request Has Been Approved')
        self.assertEqual(send_mail.call_args.kwargs['from_email'], 'info@crypgo.us.ci')
        self.assertEqual(send_mail.call_args.kwargs['recipient_list'], [self.user.email])
        message = send_mail.call_args.kwargs['message']
        self.assertIn('Dear Jordan,', message)
        self.assertIn(f'- Card Number: {self.number_record.number}', message)
        self.assertIn('- Card Type: Classic®', message)
        self.assertIn('- Status: Out for delivery', message)
        self.assertIn(
            'You will receive an email once it has arrived at your registered delivery address.',
            message,
        )
        self.assertIn('Freeze or unfreeze your card instantly if needed', message)

    @override_settings(DEFAULT_FROM_EMAIL='info@crypgo.us.ci')
    @patch('apps.users.services.send_mail', return_value=1)
    def test_cancellation_email_uses_provided_copy_and_configured_sender(self, send_mail):
        sent = send_card_application_cancellation_email(self.user)

        self.assertTrue(sent)
        self.assertEqual(send_mail.call_args.kwargs['subject'], 'Update regarding your Crypgo Card Application')
        self.assertEqual(send_mail.call_args.kwargs['from_email'], 'info@crypgo.us.ci')
        self.assertEqual(send_mail.call_args.kwargs['recipient_list'], [self.user.email])
        self.assertIn('Dear Jordan,', send_mail.call_args.kwargs['message'])
        self.assertIn('- Inability to verify your identity information', send_mail.call_args.kwargs['message'])

    def test_scheduler_emails_and_hides_only_applications_past_deadline(self):
        self.application.cancellation_due_at = timezone.now() - timedelta(minutes=1)
        self.application.save(update_fields=['cancellation_due_at'])
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as send_email:
            call_command('process_due_card_cancellations')

        send_email.assert_called_once_with(self.user)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_CANCELED)
        self.assertIsNone(self.application.cancellation_due_at)
        self.assertIsNotNone(self.application.cancellation_email_sent_at)
        self.assertFalse(CardApplicationAsset.objects.filter(user=self.user, ticker='BTC').exists())
        self.number_record.refresh_from_db()
        self.assertEqual(self.number_record.application_id, self.application.pk)

    def test_scheduler_keeps_application_before_deadline(self):
        self.application.cancellation_due_at = timezone.now() + timedelta(minutes=1)
        self.application.save(update_fields=['cancellation_due_at'])
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as send_email:
            call_command('process_due_card_cancellations')

        send_email.assert_not_called()
        self.assertTrue(CardApplication.objects.filter(pk=self.application.pk).exists())

    def test_scheduler_keeps_application_when_email_fails(self):
        self.application.cancellation_due_at = timezone.now() - timedelta(minutes=1)
        self.application.save(update_fields=['cancellation_due_at'])
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=False,
        ) as send_email:
            call_command('process_due_card_cancellations')

        send_email.assert_called_once_with(self.user)
        self.assertTrue(CardApplication.objects.filter(pk=self.application.pk).exists())
        self.assertTrue(CardApplicationAsset.objects.filter(user=self.user, ticker='BTC').exists())

    def test_scheduler_does_not_resend_email_after_recording_success(self):
        self.application.cancellation_due_at = timezone.now() - timedelta(minutes=1)
        self.application.cancellation_email_sent_at = timezone.now()
        self.application.save(
            update_fields=['cancellation_due_at', 'cancellation_email_sent_at'],
        )
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as send_email:
            call_command('process_due_card_cancellations')

        send_email.assert_not_called()
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_CANCELED)

    def test_user_deletion_before_deadline_prevents_cancellation_email(self):
        self.application.cancellation_due_at = timezone.now() + timedelta(hours=1)
        self.application.save(update_fields=['cancellation_due_at'])
        response = self.client.delete(
            f'/api/users/card-applications/{self.application.pk}/',
        )
        self.assertEqual(response.status_code, 204)

        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as send_email:
            call_command('process_due_card_cancellations')

        send_email.assert_not_called()

    def test_canceled_applications_are_hidden_from_the_customer_api(self):
        self.application.status = CardApplication.STATUS_CANCELED
        self.application.save(update_fields=['status'])

        listing = self.client.get('/api/users/card-applications/')
        details = self.client.get(f'/api/users/card-applications/{self.application.pk}/')

        self.assertEqual(listing.status_code, 200)
        self.assertNotIn(
            self.application.pk,
            [item['id'] for item in listing.json()['applications']],
        )
        self.assertEqual(details.status_code, 404)

    def test_admin_approval_stops_scheduled_cancellation(self):
        self.application.cancellation_due_at = timezone.now() - timedelta(minutes=1)
        self.application.save(update_fields=['cancellation_due_at'])
        admin_user = CustomUser.objects.create_superuser(
            username='card-approval-admin',
            email='card-approval-admin@example.com',
            password='Password123!',
        )
        request = RequestFactory().post('/admin/users/cardapplication/')
        request.user = admin_user
        card_admin = CardApplicationAdmin(CardApplication, admin.site)
        card_admin.message_user = Mock()

        card_admin.approve_applications(
            request,
            CardApplication.objects.filter(pk=self.application.pk),
        )

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_APPROVED)
        self.assertIsNone(self.application.cancellation_due_at)
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as send_email:
            call_command('process_due_card_cancellations')
        send_email.assert_not_called()


class CardReviewAPITests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='review-customer',
            email='review-customer@example.com',
            password='Password123!',
            first_name='Jordan',
        )
        self.application = CardApplication.objects.create(
            user=self.user,
            status=CardApplication.STATUS_CANCELED,
            source_asset='BTC',
            cancellation_email_sent_at=timezone.now(),
        )
        self.number_record = CardApplicationNumber.objects.create(
            application=self.application,
        )
        self.client = APIClient()

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    def test_correct_access_code_issues_a_review_token_and_invalid_code_is_rejected(self):
        invalid = self.client.post(
            '/api/card-review/login/',
            {'code': 'incorrect'},
            format='json',
        )
        valid = self.client.post(
            '/api/card-review/login/',
            {'code': 'review-test-code'},
            format='json',
        )

        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(valid.status_code, 200)
        self.assertTrue(valid.json()['token'])

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    @patch('apps.users.views.send_card_application_approval_email', return_value=True)
    def test_review_admin_can_approve_hidden_application_and_restore_it(self, send_email):
        token = signing.dumps(
            {'scope': 'card-review-admin'},
            salt='apps.users.card-review-admin',
        )
        headers = {'HTTP_AUTHORIZATION': f'CardReview {token}'}

        listing = self.client.get('/api/card-review/applications/', **headers)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([row['id'] for row in listing.json()['applications']], [self.application.pk])

        response = self.client.post(
            f'/api/card-review/applications/{self.application.pk}/approve/',
            {},
            format='json',
            **headers,
        )

        self.assertEqual(response.status_code, 200, response.content)
        send_email.assert_called_once_with(self.application)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_APPROVED)
        self.assertIsNotNone(self.application.approval_email_sent_at)
        self.assertTrue(CardApplicationAsset.objects.filter(
            user=self.user,
            ticker='BTC',
            application=self.application,
        ).exists())
        self.number_record.refresh_from_db()
        self.assertEqual(self.number_record.application_id, self.application.pk)
        customer_cards = self.client.get(
            '/api/users/card-applications/',
            HTTP_AUTHORIZATION=f'Bearer {self._customer_access_token()}',
        )
        self.assertIn(
            self.application.pk,
            [row['id'] for row in customer_cards.json()['applications']],
        )
        self.client.force_authenticate(user=self.user)
        customer_details = self.client.get(
            f'/api/users/card-applications/{self.application.pk}/',
            HTTP_AUTHORIZATION=f'Bearer {self._customer_access_token()}',
        )
        self.assertEqual(customer_details.status_code, 200, customer_details.content)
        self.assertEqual(customer_details.json()['status'], CardApplication.STATUS_APPROVED)

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    @patch('apps.users.views.send_card_application_approval_email', return_value=True)
    def test_review_admin_can_approve_before_cancellation_deadline(self, send_email):
        self.application.status = CardApplication.STATUS_ACTIVATION_PENDING
        self.application.cancellation_due_at = timezone.now() + timedelta(hours=1)
        self.application.save(update_fields=['status', 'cancellation_due_at'])
        token = self.client.post(
            '/api/card-review/login/',
            {'code': 'review-test-code'},
            format='json',
        ).json()['token']
        headers = {'HTTP_AUTHORIZATION': f'CardReview {token}'}

        listing = self.client.get('/api/card-review/applications/', **headers)
        row = next(
            item for item in listing.json()['applications']
            if item['id'] == self.application.pk
        )
        self.assertEqual(row['status'], CardApplication.STATUS_ACTIVATION_PENDING)

        response = self.client.post(
            f'/api/card-review/applications/{self.application.pk}/approve/',
            {},
            format='json',
            **headers,
        )

        self.assertEqual(response.status_code, 200, response.content)
        send_email.assert_called_once_with(self.application)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_APPROVED)
        self.assertIsNone(self.application.cancellation_due_at)
        with patch(
            'apps.users.management.commands.process_due_card_cancellations.send_card_application_cancellation_email',
            return_value=True,
        ) as cancellation_email:
            call_command('process_due_card_cancellations')
        cancellation_email.assert_not_called()

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    @patch('apps.users.views.send_card_application_approval_email')
    def test_review_admin_cannot_approve_pending_application_after_deadline(self, send_email):
        self.application.status = CardApplication.STATUS_ACTIVATION_PENDING
        self.application.cancellation_due_at = timezone.now() - timedelta(seconds=1)
        self.application.save(update_fields=['status', 'cancellation_due_at'])
        token = signing.dumps(
            {'scope': 'card-review-admin'},
            salt='apps.users.card-review-admin',
        )
        headers = {'HTTP_AUTHORIZATION': f'CardReview {token}'}

        response = self.client.post(
            f'/api/card-review/applications/{self.application.pk}/approve/',
            {},
            format='json',
            **headers,
        )

        self.assertEqual(response.status_code, 409, response.content)
        send_email.assert_not_called()
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_ACTIVATION_PENDING)

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    def test_review_list_returns_four_customer_cards_per_page_with_customer_data(self):
        address = CardDeliveryAddress.objects.create(
            user=self.user,
            application=self.application,
            street_address='12 Example Road',
            city='London',
            state='London',
            zip_code='SW1A 1AA',
            country='GB',
        )
        additional_ids = []
        for index in range(5):
            customer = CustomUser.objects.create_user(
                username=f'review-customer-{index}',
                email=f'review-customer-{index}@example.com',
                password='Password123!',
                first_name=f'Customer {index}',
            )
            application = CardApplication.objects.create(
                user=customer,
                status=CardApplication.STATUS_CANCELED,
                source_asset='ETH',
                cancellation_email_sent_at=timezone.now(),
            )
            CardApplicationNumber.objects.create(application=application)
            additional_ids.append(application.pk)

        token = self.client.post(
            '/api/card-review/login/',
            {'code': 'review-test-code'},
            format='json',
        ).json()['token']
        headers = {'HTTP_AUTHORIZATION': f'CardReview {token}'}
        first_page = self.client.get('/api/card-review/applications/?page=1', **headers)
        second_page = self.client.get('/api/card-review/applications/?page=2', **headers)

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(first_page.json()['count'], 6)
        self.assertEqual(first_page.json()['page_size'], 4)
        self.assertEqual(first_page.json()['page_count'], 2)
        self.assertEqual(len(first_page.json()['applications']), 4)
        self.assertEqual(len(second_page.json()['applications']), 2)
        first_ids = {item['id'] for item in first_page.json()['applications']}
        second_ids = {item['id'] for item in second_page.json()['applications']}
        self.assertFalse(first_ids & second_ids)
        customer_card = next(
            item for item in (
                first_page.json()['applications'] + second_page.json()['applications']
            )
            if item['id'] == self.application.pk
        )
        self.assertEqual(customer_card['cardholder_name'], 'Jordan')
        self.assertEqual(customer_card['address']['street_address'], address.street_address)
        self.assertEqual(customer_card['card_number'], self.number_record.number)
        self.assertEqual(customer_card['expiry'], self.application.expiry_date.strftime('%m/%y'))

    @staticmethod
    def _customer_access_token():
        from rest_framework_simplejwt.tokens import AccessToken

        user = CustomUser.objects.get(email='review-customer@example.com')
        return str(AccessToken.for_user(user))

    @override_settings(CARD_REVIEW_ACCESS_CODE_HASH=make_password('review-test-code'))
    @patch('apps.users.views.send_card_application_approval_email', return_value=False)
    def test_failed_approval_email_keeps_application_hidden_and_canceled(self, send_email):
        token = self.client.post(
            '/api/card-review/login/',
            {'code': 'review-test-code'},
            format='json',
        ).json()['token']

        response = self.client.post(
            f'/api/card-review/applications/{self.application.pk}/approve/',
            {},
            format='json',
            HTTP_AUTHORIZATION=f'CardReview {token}',
        )

        self.assertEqual(response.status_code, 503)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, CardApplication.STATUS_CANCELED)
        self.assertIsNone(self.application.approval_email_sent_at)
        self.assertFalse(CardApplicationAsset.objects.filter(application=self.application).exists())

class CardApplicationsDataMigrationTests(TransactionTestCase):
    migrate_from = ('users', '0034_cardissuer_expiry_date')
    migrate_to = ('users', '0035_card_applications')

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps
        User = old_apps.get_model('users', 'CustomUser')
        CardIssuer = old_apps.get_model('users', 'CardIssuer')
        CardDeliveryAddress = old_apps.get_model('users', 'CardDeliveryAddress')
        CardActivationCode = old_apps.get_model('users', 'CardActivationCode')

        self.user_id = User.objects.create(
            username='legacy-card-user',
            email='legacy-card@example.com',
            password='not-a-real-hash',
        ).pk
        orphan_user_id = User.objects.create(
            username='legacy-address-only-user',
            email='legacy-address-only@example.com',
            password='not-a-real-hash',
        ).pk
        self.orphan_user_id = orphan_user_id
        issued_at = timezone.now()
        self.card_number = '1234567812345678'
        CardIssuer.objects.create(
            user_id=self.user_id,
            card_issuer_number=self.card_number,
            issued_at=issued_at,
            expiry_date=date(issued_at.year + 5, issued_at.month, 1),
            activation_pending=True,
            source_asset='BTC',
        )
        CardDeliveryAddress.objects.create(
            user_id=self.user_id,
            street_address='1 Main Street',
            city='Boston',
            state='MA',
            zip_code='02108',
            country='US',
        )
        CardActivationCode.objects.create(
            user_id=self.user_id,
            code_hash='c' * 64,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        CardDeliveryAddress.objects.create(
            user_id=orphan_user_id,
            street_address='2 Main Street',
            city='Boston',
            state='MA',
            zip_code='02108',
            country='US',
        )
        CardActivationCode.objects.create(
            user_id=orphan_user_id,
            code_hash='d' * 64,
            expires_at=timezone.now() + timedelta(minutes=15),
        )

        MigrationExecutor(connection).migrate([self.migrate_to])

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_migration_preserves_card_details_and_links_related_records(self):
        current_apps = MigrationExecutor(connection).loader.project_state(
            [self.migrate_to]
        ).apps
        CardApplication = current_apps.get_model('users', 'CardApplication')
        CardApplicationAsset = current_apps.get_model('users', 'CardApplicationAsset')
        CardApplicationNumber = current_apps.get_model('users', 'CardApplicationNumber')
        CardActivationCode = current_apps.get_model('users', 'CardActivationCode')
        CardDeliveryAddress = current_apps.get_model('users', 'CardDeliveryAddress')

        application = CardApplication.objects.get(user_id=self.user_id)
        self.assertEqual(application.status, 'activation_pending')
        self.assertEqual(application.source_asset, 'BTC')
        self.assertEqual(
            CardApplicationNumber.objects.get(application_id=application.pk).number,
            self.card_number,
        )
        self.assertTrue(
            CardApplicationAsset.objects.filter(
                user_id=self.user_id,
                ticker='BTC',
                application_id=application.pk,
            ).exists()
        )
        self.assertTrue(
            CardDeliveryAddress.objects.filter(
                user_id=self.user_id,
                application_id=application.pk,
            ).exists()
        )
        self.assertTrue(
            CardActivationCode.objects.filter(
                user_id=self.user_id,
                application_id=application.pk,
            ).exists()
        )
        self.assertFalse(
            CardApplication.objects.filter(user_id=self.orphan_user_id).exists()
        )
        self.assertTrue(
            CardDeliveryAddress.objects.filter(
                user_id=self.orphan_user_id,
                application__isnull=True,
            ).exists()
        )


class FalseLegacyCardApplicationCleanupMigrationTests(TransactionTestCase):
    migrate_from = ('users', '0035_card_applications')
    migrate_to = ('users', '0036_remove_false_legacy_card_applications')

    def setUp(self):
        super().setUp()
        MigrationExecutor(connection).migrate([self.migrate_from])
        current_apps = MigrationExecutor(connection).loader.project_state(
            [self.migrate_from]
        ).apps
        User = current_apps.get_model('users', 'CustomUser')
        CardApplication = current_apps.get_model('users', 'CardApplication')
        CardApplicationNumber = current_apps.get_model('users', 'CardApplicationNumber')
        CardDeliveryAddress = current_apps.get_model('users', 'CardDeliveryAddress')
        CardActivationCode = current_apps.get_model('users', 'CardActivationCode')

        self.legacy_user_id = User.objects.create(
            username='false-legacy-card-user',
            email='false-legacy-card@example.com',
            password='not-a-real-hash',
        ).pk
        migration_applied_at = MigrationRecorder(connection).migration_qs.get(
            app='users',
            name='0035_card_applications',
        ).applied
        phantom_application = CardApplication.objects.create(
            user_id=self.legacy_user_id,
            source_asset='',
            status='draft',
        )
        CardApplication.objects.filter(pk=phantom_application.pk).update(
            created_at=migration_applied_at,
        )
        self.card_number = '8765432187654321'
        CardApplicationNumber.objects.create(
            number=self.card_number,
            application_id=phantom_application.pk,
        )
        CardDeliveryAddress.objects.create(
            user_id=self.legacy_user_id,
            application_id=phantom_application.pk,
            street_address='3 Main Street',
            city='Boston',
            state='MA',
            zip_code='02108',
            country='US',
        )
        CardActivationCode.objects.create(
            user_id=self.legacy_user_id,
            application_id=phantom_application.pk,
            code_hash='e' * 64,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        self.phantom_application_id = phantom_application.pk

        self.current_user_id = User.objects.create(
            username='current-card-user',
            email='current-card@example.com',
            password='not-a-real-hash',
        ).pk
        current_application = CardApplication.objects.create(
            user_id=self.current_user_id,
            source_asset='',
            status='draft',
        )
        self.current_application_id = current_application.pk
        CardApplicationNumber.objects.create(
            number='7654321876543210',
            application_id=current_application.pk,
        )

        MigrationExecutor(connection).migrate([self.migrate_to])

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_cleanup_removes_false_legacy_data_and_preserves_new_card_numbers(self):
        current_apps = MigrationExecutor(connection).loader.project_state(
            [self.migrate_to]
        ).apps
        CardApplication = current_apps.get_model('users', 'CardApplication')
        CardApplicationNumber = current_apps.get_model('users', 'CardApplicationNumber')
        CardDeliveryAddress = current_apps.get_model('users', 'CardDeliveryAddress')
        CardActivationCode = current_apps.get_model('users', 'CardActivationCode')

        self.assertFalse(
            CardApplication.objects.filter(pk=self.phantom_application_id).exists()
        )
        self.assertTrue(
            CardApplication.objects.filter(pk=self.current_application_id).exists()
        )
        current_number_record = CardApplicationNumber.objects.get(
            number='7654321876543210',
        )
        self.assertEqual(current_number_record.application_id, self.current_application_id)
        number_record = CardApplicationNumber.objects.get(number=self.card_number)
        self.assertIsNone(number_record.application_id)
        self.assertFalse(
            CardDeliveryAddress.objects.filter(user_id=self.legacy_user_id).exists()
        )
        self.assertFalse(
            CardActivationCode.objects.filter(user_id=self.legacy_user_id).exists()
        )
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        client = APIClient()
        client.force_authenticate(user=CustomUser.objects.get(pk=self.legacy_user_id))
        response = client.get('/api/users/card-applications/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['applications'], [])
