from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from django.db.migrations.executor import MigrationExecutor

from .models import (
    CardActivationCode,
    CardApplication,
    CardDeliveryAddress,
    CardIssuer,
    CustomUser,
)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class CardIssuerTests(TestCase):
    def test_login_works_without_a_card_issuer_record(self):
        user = CustomUser.objects.create_user(
            username='login-without-issuer',
            email='login-without-issuer@example.com',
            password='Password123!',
        )

        response = APIClient().post(
            '/api/auth/login/',
            {'email': user.email, 'password': 'Password123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(CardIssuer.objects.filter(user=user).exists())

    def test_source_asset_is_saved_and_returned_with_card_details(self):
        user = CustomUser.objects.create_user(
            username='card-source-asset-user',
            email='card-source-asset@example.com',
            password='Password123!',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        save_response = client.patch(
            '/api/users/card-issuer/',
            {'source_asset': 'btc'},
            format='json',
        )
        details_response = client.get('/api/users/card-issuer/')

        self.assertEqual(save_response.status_code, 200, save_response.content)
        self.assertEqual(save_response.json(), {'source_asset': 'BTC'})
        self.assertEqual(details_response.status_code, 200, details_response.content)
        self.assertEqual(details_response.json()['source_asset'], 'BTC')
        self.assertEqual(
            CardApplication.objects.get(user=user).source_asset,
            'BTC',
        )

    def test_unsupported_source_asset_is_rejected(self):
        user = CustomUser.objects.create_user(
            username='invalid-card-source-user',
            email='invalid-card-source@example.com',
            password='Password123!',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch(
            '/api/users/card-issuer/',
            {'source_asset': 'FAKE'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CardIssuer.objects.filter(user=user).exists())

    def test_issuer_details_are_personalized_and_persist(self):
        user = CustomUser.objects.create_user(
            username='card-issuer-user',
            email='card-issuer@example.com',
            password='Password123!',
            first_name='Alex',
            last_name='Morgan',
        )
        second_user = CustomUser.objects.create_user(
            username='another-card-issuer-user',
            email='another-card-issuer@example.com',
            password='Password123!',
        )
        issuer = CardIssuer.objects.create(user=user)
        second_issuer = CardIssuer.objects.create(user=second_user)
        self.assertNotEqual(
            issuer.card_issuer_number,
            second_issuer.card_issuer_number,
        )
        self.assertEqual(len(issuer.card_issuer_number), 16)
        first_four_digits = issuer.card_issuer_number[:4]
        self.assertNotIn('0', first_four_digits)
        self.assertEqual(len(set(first_four_digits)), 4)
        self.assertNotIn('0', second_issuer.card_issuer_number[:4])
        self.assertEqual(len(set(second_issuer.card_issuer_number[:4])), 4)
        for number in (issuer.card_issuer_number, second_issuer.card_issuer_number):
            groups = [number[index:index + 4] for index in range(0, 16, 4)]
            self.assertTrue(all(group.count('0') <= 1 for group in groups))
        self.assertNotIn('card_issuer_number', {
            field.name for field in CustomUser._meta.get_fields()
        })
        self.assertNotIn('card_issuer_issued_at', {
            field.name for field in CustomUser._meta.get_fields()
        })
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CardIssuer.objects.create(
                    user=CustomUser.objects.create_user(
                        username='duplicate-card-issuer-user',
                        email='duplicate-card-issuer@example.com',
                        password='Password123!',
                    ),
                    card_issuer_number=issuer.card_issuer_number,
                )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get('/api/users/card-issuer/')

        self.assertEqual(response.status_code, 200, response.content)
        issuer_details = response.json()
        issuer.refresh_from_db()
        self.assertEqual(issuer_details['card_issuer_number'], issuer.card_issuer_number)
        self.assertEqual(issuer_details['cardholder_name'], 'Alex Morgan')
        self.assertTrue(issuer_details['is_non_functional'])
        self.assertFalse(issuer_details['activation_pending'])
        self.assertIsNone(issuer_details['source_asset'])
        issuer.refresh_from_db()
        self.assertIsNotNone(issuer.issued_at)
        self.assertIsNotNone(issuer.expiry_date)
        expected_expiry = issuer.expiry_date.strftime('%m/%y')
        self.assertEqual(issuer_details['expiry'], expected_expiry)

        repeated_response = client.get('/api/users/card-issuer/')
        self.assertEqual(repeated_response.status_code, 200, repeated_response.content)
        self.assertEqual(repeated_response.json(), issuer_details)

    def test_issuer_details_return_saved_expiry_date(self):
        user = CustomUser.objects.create_user(
            username='card-saved-expiry-user',
            email='card-saved-expiry@example.com',
            password='Password123!',
        )
        issuer = CardIssuer.objects.create(user=user)
        issuer.expiry_date = date(2037, 4, 1)
        issuer.save(update_fields=['expiry_date'])

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get('/api/users/card-issuer/')

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['expiry'], '04/37')

    def test_delete_pending_application_removes_card_address_and_activation_codes(self):
        user = CustomUser.objects.create_user(
            username='delete-card-application-user',
            email='delete-card-application@example.com',
            password='Password123!',
        )
        issuer = CardIssuer.objects.create(user=user, activation_pending=True)
        CardDeliveryAddress.objects.create(
            user=user,
            street_address='1600 Pennsylvania Avenue NW',
            city='Washington',
            state='DC',
            zip_code='20500',
            country='US',
        )
        activation_code = CardActivationCode.objects.create(
            user=user,
            code_hash='a' * 64,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.delete('/api/users/card-issuer/')

        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(CardIssuer.objects.filter(pk=issuer.pk).exists())
        self.assertFalse(CardDeliveryAddress.objects.filter(user=user).exists())
        self.assertFalse(CardActivationCode.objects.filter(pk=activation_code.pk).exists())

    def test_delete_application_rejects_user_without_pending_card_and_preserves_address(self):
        user = CustomUser.objects.create_user(
            username='delete-nonpending-card-user',
            email='delete-nonpending-card@example.com',
            password='Password123!',
        )
        issuer = CardIssuer.objects.create(user=user, activation_pending=False)
        address = CardDeliveryAddress.objects.create(
            user=user,
            street_address='1 Main Street',
            city='Boston',
            state='MA',
            zip_code='02108',
            country='US',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.delete('/api/users/card-issuer/')

        self.assertEqual(response.status_code, 404)
        self.assertTrue(CardIssuer.objects.filter(pk=issuer.pk).exists())
        self.assertTrue(CardDeliveryAddress.objects.filter(pk=address.pk).exists())


class CardIssuerDataMigrationTests(TransactionTestCase):
    migrate_from = ('users', '0028_card_issuer_zero_limit')
    migrate_to = ('users', '0029_card_issuer_record')

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps
        historical_user = old_apps.get_model('users', 'CustomUser')
        issued_at = timezone.now()
        self.user_id = historical_user.objects.create(
            username='issuer-migration-user',
            email='issuer-migration@example.com',
            password='not-a-real-hash',
            card_issuer_number='1234567812345678',
            card_issuer_issued_at=issued_at,
        ).pk
        self.original_number = '1234567812345678'
        self.original_issued_at = issued_at

        MigrationExecutor(connection).migrate([self.migrate_to])

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_migration_preserves_existing_number_and_issue_date(self):
        current_apps = MigrationExecutor(connection).loader.project_state(
            [self.migrate_to]
        ).apps
        issuer = current_apps.get_model('users', 'CardIssuer').objects.get(
            user_id=self.user_id
        )

        self.assertEqual(issuer.card_issuer_number, self.original_number)
        self.assertEqual(issuer.issued_at, self.original_issued_at)
