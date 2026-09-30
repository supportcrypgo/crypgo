from datetime import datetime, time as dt_time, timedelta
import subprocess
import base64
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.campaigns.models import Campaign
from apps.campaigns.models import CampaignLead
from apps.email_engine.models import Bounce, EmailLog
from apps.email_engine.sender import EmailSender
from apps.email_engine.throttler import Throttler
from apps.leads.models import BlacklistedLead
from apps.templates.models import EmailTemplate
from apps.core.management.commands.send_campaign import Command


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='support.crypgo@gmail.com',
    SITE_URL='http://testserver',
)
class EmailSenderDeliverabilityTest(TestCase):
    def setUp(self):
        self.template = EmailTemplate.objects.create(
            name='Deliverability Template',
            subject='Hello {{ greeting }}',
            html_content='<p>Hello {{ greeting }},</p><p><a href="{{ unsubscribe_url }}">Unsubscribe</a></p>',
            plain_text='Hello {{ greeting }},',
            is_active=True,
        )
        self.campaign = Campaign.objects.create(
            name='Deliverability Campaign',
            subject='Hello {{ greeting }}',
            status='draft',
        )
        self.sender = EmailSender()

    def test_sender_formats_display_name_and_greeting(self):
        start_len = len(mail.outbox)

        result = self.sender.send_with_tracking(
            recipient_email='john.doe@example.com',
            subject='Hello John Doe',
            html_body='<p>Hello John Doe</p>',
            plain_text='Hello John Doe',
            campaign=self.campaign,
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(mail.outbox), start_len + 1)
        sent_message = mail.outbox[-1]
        self.assertEqual(sent_message.from_email, 'Crypgo <support.crypgo@gmail.com>')
        self.assertIn('Hello John Doe', sent_message.subject)
        self.assertIn('Hello John Doe', sent_message.body)
        self.assertIn('List-Unsubscribe', sent_message.extra_headers)
        self.assertIn('Message-ID', sent_message.extra_headers)

    def test_sender_falls_back_to_there_for_unusable_local_part(self):
        start_len = len(mail.outbox)

        result = self.sender.send_with_tracking(
            recipient_email='12345@example.com',
            subject='Hello there',
            html_body='<p>Hello there</p>',
            plain_text='Hello there',
            campaign=self.campaign,
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(mail.outbox), start_len + 1)
        self.assertIn('Hello there', mail.outbox[-1].subject)

    def test_sender_uses_valid_host_user_when_default_from_is_invalid(self):
        with self.settings(
            DEFAULT_FROM_EMAIL='not-an-email',
            EMAIL_HOST_USER='verified@example.com',
        ):
            from_email = self.sender._resolve_from_email()

        self.assertEqual(from_email, 'Crypgo <verified@example.com>')

    def test_sender_uses_valid_fallback_when_configured_addresses_are_empty(self):
        with self.settings(DEFAULT_FROM_EMAIL=None, EMAIL_HOST_USER=None):
            from_email = self.sender._resolve_from_email()

        self.assertEqual(from_email, 'Crypgo <noreply@crypgo.com>')

    def test_sender_attaches_pdf_payloads(self):
        start_len = len(mail.outbox)

        result = self.sender.send_with_tracking(
            recipient_email='pdf@example.com',
            subject='Hello PDF',
            html_body='<p>Hello PDF</p>',
            plain_text='Hello PDF',
            campaign=self.campaign,
            attachments=[('report.pdf', b'%PDF-1.4', 'application/pdf')],
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(mail.outbox), start_len + 1)
        self.assertEqual(len(mail.outbox[-1].attachments), 1)
        self.assertEqual(mail.outbox[-1].attachments[0][0], 'report.pdf')
        self.assertEqual(mail.outbox[-1].attachments[0][1], b'%PDF-1.4')

    def test_failed_send_creates_bounce_record(self):
        with patch('apps.email_engine.sender.EmailMultiAlternatives.send', side_effect=Exception('mailbox full')):
            email_log = self.sender.send_with_tracking(
                recipient_email='bounce@example.com',
                subject='Hello Bounce',
                html_body='<p>Hello Bounce</p>',
                plain_text='Hello Bounce',
                campaign=self.campaign,
            )

        self.assertIsNotNone(email_log)
        self.assertTrue(Bounce.objects.filter(
            email='bounce@example.com',
            bounce_type='soft',
            reason='mailbox full',
        ).exists())
        self.assertEqual(
            EmailLog.objects.get(pk=email_log.pk).status,
            'bounced',
        )

    def test_internal_type_error_is_logged_as_failure_not_bounce(self):
        with patch(
            'apps.email_engine.sender.EmailMultiAlternatives.attach',
            side_effect=TypeError("can only concatenate str (not 'NoneType') to str"),
        ):
            email_log = self.sender.send_with_tracking(
                recipient_email='internal-error@example.com',
                subject='Internal failure',
                html_body='<p>Test</p>',
                campaign=self.campaign,
                attachments=[('report.pdf', b'%PDF', 'application/pdf')],
            )

        self.assertIsNotNone(email_log)
        self.assertEqual(email_log.status, 'failed')
        self.assertFalse(Bounce.objects.filter(email='internal-error@example.com').exists())
        self.assertFalse(BlacklistedLead.objects.filter(email='internal-error@example.com').exists())

    def test_throttler_waits_around_90_seconds_between_campaign_sends(self):
        EmailLog.objects.create(
            campaign=self.campaign,
            recipient_email='first@example.com',
            subject='Test',
            tracking_id='throttle-wait-test-1',
            status='sent',
            sent_at=timezone.now() - timedelta(seconds=30),
        )

        throttler = Throttler()
        wait_time = throttler.wait_for_next_slot(self.campaign)

        self.assertGreater(wait_time, 0)
        self.assertAlmostEqual(wait_time, 60, delta=5)
        self.assertFalse(throttler.can_send_campaign(self.campaign))

    def test_throttler_blocks_after_40_sends_in_a_hour(self):
        sent_at = timezone.now() - timedelta(minutes=10)
        EmailLog.objects.bulk_create([
            EmailLog(
                campaign=self.campaign,
                recipient_email=f'hour-{idx}@example.com',
                subject='Test',
                tracking_id=f'hour-throttle-test-{idx}',
                status='sent',
                sent_at=sent_at,
            )
            for idx in range(40)
        ])

        throttler = Throttler()

        self.assertEqual(throttler.get_remaining_hour(self.campaign), 0)
        self.assertFalse(throttler.can_send_campaign(self.campaign))

    def test_throttler_leaves_one_send_after_69_sends_in_a_day(self):
        sent_at = timezone.now() - timedelta(hours=2)
        EmailLog.objects.bulk_create([
            EmailLog(
                campaign=self.campaign,
                recipient_email=f'day-{idx}@example.com',
                subject='Test',
                tracking_id=f'day-throttle-test-{idx}',
                status='sent',
                sent_at=sent_at,
            )
            for idx in range(69)
        ])

        throttler = Throttler()

        self.assertEqual(throttler.get_remaining_day(self.campaign), 1)

    def test_throttler_blocks_after_70_sends_in_a_day(self):
        sent_at = timezone.now() - timedelta(hours=2)
        EmailLog.objects.bulk_create([
            EmailLog(
                campaign=self.campaign,
                recipient_email=f'day-cap-{idx}@example.com',
                subject='Test',
                tracking_id=f'day-cap-test-{idx}',
                status='sent',
                sent_at=sent_at,
            )
            for idx in range(70)
        ])

        throttler = Throttler()

        self.assertEqual(throttler.get_remaining_day(self.campaign), 0)
        self.assertFalse(throttler.can_send_campaign(self.campaign))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='support.crypgo@gmail.com',
    SITE_URL='http://testserver',
)
class CrypgoCampaignRecipientDeliveryTest(TestCase):
    def test_report_subprocess_pythonpath_handles_none(self):
        environment = {'PYTHONPATH': None}

        with (
            patch('apps.core.management.commands.send_campaign.os.environ.copy', return_value=environment),
            patch('apps.core.management.commands.send_campaign.subprocess.run') as run_report,
        ):
            run_report.return_value.returncode = 0
            run_report.return_value.stdout = base64.b64encode(b'%PDF-report').decode('ascii')
            run_report.return_value.stderr = ''

            attachments = Command()._build_recipient_pdf_attachment(
                CampaignLead(recipient_email='pythonpath@example.com', pk=1)
            )

        self.assertTrue(environment['PYTHONPATH'])
        self.assertNotIn('None', environment['PYTHONPATH'])
        self.assertTrue(run_report.call_args.kwargs['capture_output'])
        self.assertTrue(run_report.call_args.kwargs['text'])
        self.assertIn('--stdout-base64', run_report.call_args.args[0])
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0][1], b'%PDF-report')

    def test_report_subprocess_failure_logs_exit_code_and_stderr(self):
        completed = subprocess.CompletedProcess(
            args=['generate_user_report.py'],
            returncode=2,
            stdout='',
            stderr='report generation failed',
        )
        with patch(
            'apps.core.management.commands.send_campaign.subprocess.run',
            return_value=completed,
        ) as run_report, self.assertLogs('email_bot', level='ERROR') as logs:
            attachments = Command()._build_recipient_pdf_attachment(
                CampaignLead(recipient_email='failed-report@example.com', pk=3)
            )

        self.assertEqual(attachments, [])
        self.assertEqual(run_report.call_args.kwargs['timeout'], 30)
        self.assertTrue(any('exit=2' in message and 'report generation failed' in message for message in logs.output))

    def test_report_subprocess_timeout_is_bounded_and_logged(self):
        timeout_error = subprocess.TimeoutExpired(
            cmd=['generate_user_report.py'],
            timeout=30,
            stderr=b'report database query timed out',
        )
        recipient = CampaignLead(recipient_email='slow-report@example.com', pk=2)

        with patch(
            'apps.core.management.commands.send_campaign.subprocess.run',
            side_effect=timeout_error,
        ) as run_report, self.assertLogs('email_bot', level='ERROR') as logs:
            attachments = Command()._build_recipient_pdf_attachment(recipient)

        self.assertEqual(attachments, [])
        self.assertEqual(run_report.call_args.kwargs['timeout'], 30)
        self.assertTrue(any('timed out' in message and 'database query timed out' in message for message in logs.output))

    def test_recipient_gets_personalized_dashboard_link(self):
        template = EmailTemplate.objects.create(
            name='Crypgo User Campaign Template',
            subject='Account update',
            html_content='<p>Hi {{ first_name }} {{ last_name }}</p><a href="{{ dashboard_url }}">Go to dashboard</a>',
            plain_text='Hi {{ first_name }} {{ last_name }}: {{ dashboard_url }}',
            is_active=True,
        )
        campaign = Campaign.objects.create(
            name='Crypgo User Campaign',
            subject='Account update',
            template=template,
        )
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='crypgo-1',
            recipient_email='user@example.com',
            recipient_first_name='James',
            recipient_last_name='Borunda',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=one',
        )

        Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        recipient.refresh_from_db()
        self.assertEqual(recipient.status, 'sent')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Hi James Borunda', mail.outbox[0].body)
        self.assertIn('https://app.crypgo.com/auth/campaign-access?token=one', mail.outbox[0].body)

    def test_escaped_type_error_is_traceback_logged_without_bounce(self):
        template = EmailTemplate.objects.create(
            name='Crypgo TypeError Campaign Template',
            subject='Account update',
            html_content='<p>Hello {{ first_name }}</p>',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Crypgo TypeError Campaign', template=template)
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            recipient_email='internal-error@example.com',
            recipient_first_name='Casey',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=internal-error',
        )

        with patch.object(
            EmailSender,
            'send_with_tracking',
            side_effect=TypeError('internal rendering failure'),
        ), self.assertLogs('email_bot', level='ERROR') as logs:
            Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        recipient.refresh_from_db()
        self.assertEqual(recipient.status, 'failed')
        self.assertIn('TypeError:', recipient.error_message)
        self.assertTrue(any('Traceback (most recent call last)' in message for message in logs.output))
        self.assertFalse(Bounce.objects.filter(email=recipient.recipient_email).exists())

    def test_live_campaign_attaches_personalized_account_report(self):
        template = EmailTemplate.objects.create(
            name='Crypgo Campaign With Attachments',
            subject='Account update',
            html_content='<p>Hi {{ first_name }}</p>',
            is_active=True,
            include_account_report_attachment=True,
        )
        campaign = Campaign.objects.create(
            name='Crypgo Campaign With Attachments',
            subject='Account update',
            template=template,
        )
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='crypgo-attachments',
            recipient_email='attachments@example.com',
            recipient_first_name='Casey',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=attachments',
        )

        with patch.object(Command, '_build_recipient_pdf_attachment', return_value=[
            ('account-report.pdf', b'%PDF-report', 'application/pdf'),
        ]):
            Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].attachments, [
            ('account-report.pdf', b'%PDF-report', 'application/pdf'),
        ])
        recipient.refresh_from_db()
        self.assertEqual(recipient.status, 'sent')

    def test_test_send_attaches_personalized_account_report(self):
        template = EmailTemplate.objects.create(
            name='Crypgo Test Campaign With Attachments',
            subject='Account update',
            html_content='<p>Hi {{ first_name }}</p>',
            is_active=True,
            include_account_report_attachment=True,
        )
        campaign = Campaign.objects.create(
            name='Crypgo Test Campaign With Attachments',
            subject='Account update',
            template=template,
        )
        CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='crypgo-test-attachments',
            recipient_email='test-attachments@example.com',
            recipient_first_name='Casey',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=test-attachments',
        )

        with (
            patch.object(Command, 'refresh_crypgo_links', return_value=True),
            patch.object(Command, '_build_recipient_pdf_attachment', return_value=[
                ('account-report.pdf', b'%PDF-report', 'application/pdf'),
            ]),
        ):
            Command().send_test_email(campaign, 'test-attachments@example.com')

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].attachments, [
            ('account-report.pdf', b'%PDF-report', 'application/pdf'),
        ])

    def test_recipient_does_not_attach_pdf_when_template_flag_is_off(self):
        template = EmailTemplate.objects.create(
            name='Crypgo User Campaign Template Without PDF',
            subject='Account update',
            html_content='<p>Hi {{ first_name }} {{ last_name }}</p><a href="{{ dashboard_url }}">Go to dashboard</a>',
            plain_text='Hi {{ first_name }} {{ last_name }}: {{ dashboard_url }}',
            is_active=True,
            include_account_report_attachment=False,
        )
        campaign = Campaign.objects.create(
            name='Crypgo User Campaign No PDF',
            subject='Account update',
            template=template,
        )
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='crypgo-2',
            recipient_email='user2@example.com',
            recipient_first_name='James',
            recipient_last_name='Borunda',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=two',
        )

        Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        recipient.refresh_from_db()
        self.assertEqual(recipient.status, 'sent')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(len(mail.outbox[0].attachments), 0)

    @override_settings(
        SITE_URL='https://backend.example.com',
        FRONTEND_URL='https://public.example.com',
    )
    def test_unsubscribe_link_uses_frontend_url(self):
        sender = EmailSender()
        html = '<p>Hello there</p>'

        updated = sender._inject_unsubscribe_link(html, 'friend@example.com')

        self.assertIn('https://public.example.com/unsubscribe/?email=friend%40example.com', updated)
        self.assertNotIn('https://backend.example.com/unsubscribe/?email=friend%40example.com', updated)

    @override_settings(
        SITE_URL='https://public.example.com',
        FRONTEND_URL='https://public.example.com',
    )
    def test_click_tracking_encodes_target_url(self):
        sender = EmailSender()
        html = '<a href="https://dashboard.example.com/auth/campaign-access?token=abc&next=%2Fdashboard">Open</a>'

        tracked = sender._wrap_click_links(html, 'tracking-123')

        self.assertIn('https://public.example.com/track/click/tracking-123/?url=https%3A%2F%2Fdashboard.example.com%2Fauth%2Fcampaign-access%3Ftoken%3Dabc%26next%3D%252Fdashboard', tracked)

    def test_open_tracking_uses_forwarded_ip_when_present(self):
        email_log = EmailLog.objects.create(
            tracking_id='forwarded-ip-123',
            recipient_email='user@example.com',
            subject='Test',
            status='sent',
            sent_at=timezone.now(),
        )

        response = self.client.get(
            '/track/open/forwarded-ip-123/',
            HTTP_X_FORWARDED_FOR='203.0.113.10, 10.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        email_log.refresh_from_db()
        self.assertEqual(email_log.ip_address, '203.0.113.10')
        self.assertEqual(email_log.tracking_events.get().ip_address, '203.0.113.10')

    @override_settings(
        SITE_URL='https://public.example.com',
        FRONTEND_URL='https://public.example.com',
    )
    def test_click_tracking_falls_back_when_url_missing(self):
        EmailLog.objects.create(
            tracking_id='missing-target-123',
            recipient_email='user@example.com',
            subject='Test',
            status='sent',
            sent_at=timezone.now(),
        )

        response = self.client.get('/track/click/missing-target-123/')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, 'https://public.example.com/')
