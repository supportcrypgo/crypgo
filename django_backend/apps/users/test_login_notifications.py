from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import CustomUser, MagicLinkToken, SharedInboxGroup


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='info@crypgo.us.ci',
    EMAIL_FROM_NAME='info@crypgo.us.ci',
)
class LoginNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='login-notification-user',
            email='login-notification@example.com',
            password='Password123!',
            first_name='Matt',
            last_name='Frewer',
        )
        mail.outbox = []

    def assert_login_notification(self, recipient):
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Crypgo Login Notification')
        self.assertEqual(message.to, [recipient])
        self.assertEqual(
            message.from_email,
            'Crypgo <info@crypgo.us.ci>',
        )
        self.assertIn('Hi Matt Frewer,', message.body)
        self.assertRegex(
            message.body,
            r'Your Crypgo account was accessed on .+ at .+ UTC\.',
        )
        self.assertIn('https://crypgo.us.ci/ to change your password.', message.body)
        self.assertIn('support@crypgo.us.ci', message.body)
        self.assertIn('select Help & Support in the app.', message.body)
        self.assertTrue(message.body.endswith('Thanks,\nCrypgo'))

    def test_password_login_sends_notification_but_refresh_does_not(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'Password123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assert_login_notification(self.user.email)

        refresh_response = self.client.post('/api/auth/refresh/')

        self.assertEqual(refresh_response.status_code, 200, refresh_response.content)
        self.assertEqual(len(mail.outbox), 1)

    def test_failed_password_login_does_not_send_notification(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'WrongPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(len(mail.outbox), 0)

    def test_magic_link_login_sends_notification(self):
        _, raw_token = MagicLinkToken.generate_token(self.user)

        response = self.client.post(
            '/api/auth/magic-link/consume/',
            {'token': raw_token},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assert_login_notification(self.user.email)

    def test_account_selection_sends_notification_to_selected_account(self):
        second_user = CustomUser.objects.create_user(
            username='login-notification-alias',
            email='login-notification+1@example.com',
            password='Password123!',
        )
        group = SharedInboxGroup.objects.create(inbox_email=self.user.email)
        group.users.add(self.user, second_user)

        login_response = self.client.post(
            '/api/auth/login/',
            {'email': self.user.email, 'password': 'Password123!'},
            format='json',
        )
        self.assertTrue(login_response.json()['requires_account_selection'])
        self.assertEqual(len(mail.outbox), 0)

        selection_response = self.client.post(
            '/api/auth/login/select-account/',
            {
                'selection_token': login_response.json()['selection_token'],
                'account_id': self.user.pk,
            },
            format='json',
        )

        self.assertEqual(selection_response.status_code, 200, selection_response.content)
        self.assert_login_notification(self.user.email)

    def test_notification_delivery_failure_does_not_block_login(self):
        from unittest.mock import patch

        with patch('apps.users.views.send_mail', side_effect=OSError('SMTP unavailable')) as send_mail:
            response = self.client.post(
                '/api/auth/login/',
                {'email': self.user.email, 'password': 'Password123!'},
                format='json',
            )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.cookies.get('access_token'))
        send_mail.assert_called_once()
