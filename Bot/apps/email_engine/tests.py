from datetime import datetime, time as dt_time, timedelta
from pathlib import Path
import subprocess
import base64
from unittest.mock import Mock, patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.campaigns.models import Campaign, CampaignLead, CampaignRun
from apps.email_engine.models import Bounce, EmailLog, Tracking
from apps.email_engine.sender import EmailSender
from apps.email_engine.throttler import Throttler
from apps.leads.models import BlacklistedLead
from apps.unsubscribes.models import UnsubscribedLead
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

        self.assertEqual(from_email, 'Crypgo <support.crypgo@gmail.com>')

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

    def test_throttler_history_is_campaign_scoped(self):
        other_campaign = Campaign.objects.create(name='Other Throttle Campaign', subject='Test')
        EmailLog.objects.bulk_create([
            EmailLog(
                campaign=other_campaign,
                recipient_email=f'other-{idx}@example.com',
                subject='Test',
                tracking_id=f'other-campaign-throttle-{idx}',
                status='sent',
            )
            for idx in range(70)
        ])

        self.assertEqual(Throttler().get_remaining_day(self.campaign), 70)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='support.crypgo@gmail.com',
    SITE_URL='http://testserver',
)
class CrypgoCampaignRecipientDeliveryTest(TestCase):
    def setUp(self):
        self.market_snapshot_patcher = patch.object(
            Command,
            '_refresh_report_market_prices',
            return_value=True,
        )
        self.market_snapshot_patcher.start()
        self.addCleanup(self.market_snapshot_patcher.stop)

    @override_settings(
        CRYPGO_REPORT_PRICE_CACHE='C:/test-data/report-prices.json',
    )
    def test_report_subprocess_pythonpath_handles_none(self):
        environment = {
            'PYTHONPATH': None,
            'CRYPGO_REPORT_PRICE_URL': 'https://prices.example/report-prices',
            'CRYPGO_REPORT_PRICE_SERVICE_KEY': 'unused-secret',
        }

        with (
            patch('apps.core.management.commands.send_campaign.os.environ.copy', return_value=environment),
            patch('apps.core.management.commands.send_campaign.subprocess.run') as run_report,
        ):
            run_report.side_effect = [
                subprocess.CompletedProcess(
                    args=['generate_user_report.py'],
                    returncode=0,
                    stdout=base64.b64encode(b'%PDF-report').decode('ascii') + '\n',
                    stderr='',
                ),
                subprocess.CompletedProcess(
                    args=['generate_user_report.py'],
                    returncode=0,
                    stdout='',
                    stderr='',
                ),
            ]

            attachments = Command()._build_recipient_pdf_attachment(
                CampaignLead(recipient_email='pythonpath@gmail.com', pk=1)
            )

        self.assertTrue(environment['PYTHONPATH'])
        self.assertNotIn('None', environment['PYTHONPATH'])
        self.assertTrue(run_report.call_args.kwargs['capture_output'])
        self.assertTrue(run_report.call_args.kwargs['text'])
        self.assertEqual(
            run_report.call_args.kwargs['env']['CRYPGO_REPORT_PRICE_CACHE'],
            'C:/test-data/report-prices.json',
        )
        self.assertNotIn('CRYPGO_REPORT_PRICE_URL', run_report.call_args.kwargs['env'])
        self.assertNotIn('CRYPGO_REPORT_PRICE_SERVICE_KEY', run_report.call_args.kwargs['env'])
        self.assertNotIn('CAMPAIGN_REPORT_COINGECKO_API_KEY', run_report.call_args.kwargs['env'])
        self.assertNotIn('CAMPAIGN_REPORT_COINGECKO_API_KEY_TIER', run_report.call_args.kwargs['env'])
        self.assertIn('--stdout-base64', run_report.call_args_list[0].args[0])
        self.assertEqual(run_report.call_args_list[0].args[0][3], 'pythonpath@gmail.com')
        self.assertIn('--allow-missing-user', run_report.call_args_list[1].args[0])
        self.assertEqual(run_report.call_args_list[1].args[0][3], 'pythonpath+1@gmail.com')
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0][1], b'%PDF-report')

    def test_report_subprocess_attaches_matching_gmail_plus_one_account(self):
        with patch(
            'apps.core.management.commands.send_campaign.subprocess.run',
            side_effect=[
                subprocess.CompletedProcess(
                    args=['generate_user_report.py'],
                    returncode=0,
                    stdout=base64.b64encode(b'%PDF-primary').decode('ascii'),
                    stderr='',
                ),
                subprocess.CompletedProcess(
                    args=['generate_user_report.py'],
                    returncode=0,
                    stdout=base64.b64encode(b'%PDF-plus-one').decode('ascii'),
                    stderr='',
                ),
            ],
        ) as run_report:
            attachments = Command()._build_recipient_pdf_attachment(
                CampaignLead(recipient_email='sirmattfrewer@gmail.com', pk=1)
            )

        self.assertEqual(len(attachments), 2)
        self.assertEqual(attachments[0][1], b'%PDF-primary')
        self.assertEqual(attachments[1][1], b'%PDF-plus-one')
        self.assertIn('sirmattfrewer+1@gmail.com', run_report.call_args_list[1].args[0])
        self.assertIn('--allow-missing-user', run_report.call_args_list[1].args[0])

    def test_report_subprocess_does_not_search_plus_one_for_non_gmail_or_tagged_address(self):
        for email in ('user@example.com', 'user+tag@gmail.com'):
            with self.subTest(email=email), patch(
                'apps.core.management.commands.send_campaign.subprocess.run',
                return_value=subprocess.CompletedProcess(
                    args=['generate_user_report.py'],
                    returncode=0,
                    stdout=base64.b64encode(b'%PDF-primary').decode('ascii'),
                    stderr='',
                ),
            ) as run_report:
                attachments = Command()._build_recipient_pdf_attachment(
                    CampaignLead(recipient_email=email, pk=1)
                )

            self.assertEqual(len(attachments), 1)
            run_report.assert_called_once()

    def test_companion_report_failure_prevents_campaign_email_send(self):
        template = EmailTemplate.objects.create(
            name='Crypgo Campaign With Companion Report Failure',
            subject='Account update',
            html_content='<p>Account update</p>',
            is_active=True,
            include_account_report_attachment=True,
        )
        campaign = Campaign.objects.create(
            name='Crypgo Campaign With Companion Report Failure',
            template=template,
        )
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='companion-report-failure',
            recipient_email='companion-failure@gmail.com',
            dashboard_url='https://app.crypgo.com/access/companion-failure',
        )
        sender = Mock()
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0

        with (
            patch(
                'apps.core.management.commands.send_campaign.subprocess.run',
                side_effect=[
                    subprocess.CompletedProcess(
                        args=['generate_user_report.py'],
                        returncode=0,
                        stdout=base64.b64encode(b'%PDF-primary').decode('ascii'),
                        stderr='',
                    ),
                    subprocess.CompletedProcess(
                        args=['generate_user_report.py'],
                        returncode=1,
                        stdout='',
                        stderr='report generation failed',
                    ),
                ],
            ),
        ):
            Command().send_crypgo_recipients(campaign, template, sender, throttler)

        sender.send_with_tracking.assert_not_called()
        recipient.refresh_from_db()
        self.assertEqual(recipient.status, 'failed')
        self.assertIn('account report', recipient.error_message)

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
            with self.assertRaisesRegex(RuntimeError, 'Could not generate account report'):
                Command()._build_recipient_pdf_attachment(
                    CampaignLead(recipient_email='failed-report@example.com', pk=3)
                )

        self.assertEqual(run_report.call_args.kwargs['timeout'], 30)
        self.assertTrue(any('exit=2' in message and 'report generation failed' in message for message in logs.output))

    def test_invalid_pdf_subprocess_output_fails_closed(self):
        completed = subprocess.CompletedProcess(
            args=['generate_user_report.py'],
            returncode=0,
            stdout='not-base64!',
            stderr='',
        )

        with patch(
            'apps.core.management.commands.send_campaign.subprocess.run',
            return_value=completed,
        ), self.assertLogs('email_bot', level='ERROR'):
            with self.assertRaisesRegex(RuntimeError, 'Unexpected error generating account report'):
                Command()._build_recipient_pdf_attachment(
                    CampaignLead(recipient_email='invalid-report@example.com', pk=4)
                )

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
            with self.assertRaisesRegex(RuntimeError, 'Account report generation timed out'):
                Command()._build_recipient_pdf_attachment(recipient)

        self.assertEqual(run_report.call_args.kwargs['timeout'], 30)
        self.assertTrue(any('timed out' in message and 'database query timed out' in message for message in logs.output))

    @override_settings(FRONTEND_URL='https://app.crypgo.com')
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

    @override_settings(FRONTEND_URL='https://crypgo-gamma.vercel.app')
    def test_refreshed_campaign_access_url_uses_frontend_origin(self):
        template = EmailTemplate.objects.create(
            name='Frontend Access URL Template',
            subject='Account update',
            html_content='<a href="{{ dashboard_url }}">Open account</a>',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Frontend Access URL Campaign', template=template)
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='frontend-link-user',
            recipient_email='frontend-link@example.com',
            dashboard_url='https://backend.example.net/auth/campaign-access?token=old',
        )
        response = Mock()
        response.json.return_value = {'recipients': [{
            'external_user_id': recipient.external_user_id,
            'email': recipient.recipient_email,
            'dashboard_url': 'https://backend.example.net/auth/campaign-access?token=fresh',
        }]}

        with (
            patch('apps.core.management.commands.send_campaign.settings.CRYPGO_SERVICE_KEY', 'service-key'),
            patch('apps.core.management.commands.send_campaign.requests.post', return_value=response),
        ):
            self.assertTrue(Command().refresh_crypgo_links(campaign))

        recipient.refresh_from_db()
        self.assertEqual(
            recipient.dashboard_url,
            'https://crypgo-gamma.vercel.app/auth/campaign-access?token=fresh',
        )

    @override_settings(FRONTEND_URL='https://crypgo-gamma.vercel.app')
    def test_stored_backend_campaign_url_is_rewritten_before_email(self):
        template = EmailTemplate.objects.create(
            name='Stale Campaign URL Template',
            subject='Account update',
            html_content='<a href="{{ dashboard_url }}">Open account</a>',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Stale Campaign URL Campaign', template=template)
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='stale-link-user',
            recipient_email='stale-link@example.com',
            dashboard_url='https://backend.example.net/auth/campaign-access?token=stored',
        )

        Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        recipient.refresh_from_db()
        delivered_html = getattr(mail.outbox[0], 'alternatives')[0][0]
        self.assertEqual(
            recipient.dashboard_url,
            'https://crypgo-gamma.vercel.app/auth/campaign-access?token=stored',
        )
        self.assertIn('https%3A%2F%2Fcrypgo-gamma.vercel.app', delivered_html)
        self.assertNotIn('backend.example.net', delivered_html)

    def test_recipient_email_has_clickable_account_action_links(self):
        template = EmailTemplate.objects.create(
            name='Crypgo Account Action Links',
            subject='Account update',
            html_content=(
                '<a href="{{ delete_account_url }}">Close your account permanently</a>'
                '<a href="{{ password_reset_url }}">Reset your password</a>'
            ),
            plain_text='Account update',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Crypgo Account Action Links', template=template)
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='crypgo-actions',
            recipient_email='actions@example.com',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=access-token',
        )
        reset_url = 'https://app.crypgo.com/?resetToken=reset-token'

        with patch.object(Command, 'create_password_reset_link', return_value=reset_url):
            Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        delivered_html = getattr(mail.outbox[0], 'alternatives')[0][0]
        self.assertIn('href="http://testserver/track/click/', delivered_html)
        self.assertIn('token%3Daccess-token%26next%3Ddelete-account', delivered_html)
        self.assertIn('resetToken%3Dreset-token', delivered_html)
        self.assertNotIn('href=""', delivered_html)

    def test_market_snapshot_refreshes_once_before_recipient_loop(self):
        template = EmailTemplate.objects.create(
            name='Campaign Snapshot Template',
            subject='Account update',
            html_content='<p>Account update</p>',
            is_active=True,
            include_account_report_attachment=True,
        )
        campaign = Campaign.objects.create(name='Campaign Snapshot', template=template)
        CampaignLead.objects.bulk_create([
            CampaignLead(
                campaign=campaign,
                source='crypgo_user',
                external_user_id=f'snapshot-{index}',
                recipient_email=f'snapshot-{index}@example.com',
                dashboard_url=f'https://app.crypgo.com/access/{index}',
            )
            for index in range(2)
        ])
        sender = Mock()
        events = []

        def send_email(**kwargs):
            events.append('send')
            return type('SendResult', (), {'status': 'sent'})()

        sender.send_with_tracking.side_effect = send_email
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0

        with (
            patch.object(
                Command,
                '_refresh_report_market_prices',
                side_effect=lambda: events.append('refresh'),
            ) as refresh_snapshot,
            patch.object(Command, '_build_account_report_attachments', return_value=[]),
        ):
            Command().send_crypgo_recipients(campaign, template, sender, throttler)

        refresh_snapshot.assert_called_once_with()
        self.assertEqual(sender.send_with_tracking.call_count, 2)
        self.assertEqual(events, ['refresh', 'send', 'send'])

    def test_campaign_b_can_send_after_campaign_a_and_skips_its_own_sent_rows(self):
        template = EmailTemplate.objects.create(
            name='Campaign Isolation Template',
            subject='Account update',
            html_content='<p>Hello {{ first_name }}</p>',
            is_active=True,
        )
        campaign_a = Campaign.objects.create(name='Campaign A', template=template, status='completed')
        campaign_b = Campaign.objects.create(name='Campaign B', template=template, status='running')
        CampaignLead.objects.create(
            campaign=campaign_a,
            source='crypgo_user',
            external_user_id='shared-user',
            recipient_email='shared@example.com',
            dashboard_url='https://app.crypgo.com/access/a',
            status='sent',
        )
        pending_b = CampaignLead.objects.create(
            campaign=campaign_b,
            source='crypgo_user',
            external_user_id='shared-user',
            recipient_email='shared@example.com',
            dashboard_url='https://app.crypgo.com/access/b',
            status='pending',
        )
        CampaignLead.objects.create(
            campaign=campaign_b,
            source='crypgo_user',
            external_user_id='already-sent-in-b',
            recipient_email='already-sent@example.com',
            dashboard_url='https://app.crypgo.com/access/sent',
            status='sent',
        )
        EmailLog.objects.create(
            campaign=campaign_a,
            recipient_email='shared@example.com',
            subject='Campaign A',
            tracking_id='campaign-a-shared-user',
            status='sent',
        )
        sender = Mock()
        sender.send_with_tracking.return_value = type('SendResult', (), {'status': 'sent'})()
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0

        with patch.object(Command, '_build_account_report_attachments', return_value=[]):
            Command().send_crypgo_recipients(campaign_b, template, sender, throttler)

        sender.send_with_tracking.assert_called_once()
        self.assertEqual(sender.send_with_tracking.call_args.kwargs['recipient_email'], 'shared@example.com')
        pending_b.refresh_from_db()
        self.assertEqual(pending_b.status, 'sent')

    def test_provider_error_is_saved_on_lead_and_campaign_finishes_paused(self):
        template = EmailTemplate.objects.create(
            name='Provider Error Template',
            subject='Account update',
            html_content='<p>Hello {{ first_name }}</p>',
            is_active=True,
        )
        campaign = Campaign.objects.create(
            name='Provider Error Campaign',
            template=template,
            status='running',
        )
        recipient = CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='provider-error-user',
            recipient_email='provider-error@example.com',
            dashboard_url='https://app.crypgo.com/access/provider-error',
        )
        provider_error = '[Errno 101] Network is unreachable'
        email_log = EmailLog.objects.create(
            campaign=campaign,
            recipient_email=recipient.recipient_email,
            subject='Account update',
            tracking_id='provider-error-tracking-id',
            status='failed',
            error_message=provider_error,
        )
        sender = Mock()
        sender.send_with_tracking.return_value = email_log
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0
        command = Command()

        with patch.object(Command, '_build_account_report_attachments', return_value=[]):
            command.send_crypgo_recipients(campaign, template, sender, throttler)
        command._finalize(campaign, 0, 0)

        recipient.refresh_from_db()
        campaign.refresh_from_db()
        self.assertEqual(recipient.status, 'failed')
        self.assertEqual(recipient.error_message, provider_error)
        self.assertEqual(campaign.status, 'paused')
        self.assertTrue(campaign.is_paused)
        self.assertEqual(campaign.failed_count, 1)

    def test_report_remains_attachment_without_inline_card(self):
        template_path = Path(__file__).resolve().parents[2] / 'templates' / 'emails' / 'newemail.html'
        template = EmailTemplate.objects.create(
            name='Closure Email With Report Preview',
            subject='Account closure notice',
            html_content=template_path.read_text(encoding='utf-8'),
            is_active=True,
            include_account_report_attachment=True,
        )
        campaign = Campaign.objects.create(name='Closure With Report', template=template)
        CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='preview-report-user',
            recipient_email='preview-report@gmail.com',
            recipient_first_name='Matt',
            recipient_last_name='Frewer',
            dashboard_url='https://app.crypgo.com/access/preview',
        )
        report_attachment = (
            'Crypgo_Portfolio_Report_preview-report_example_com_2026-10-02.pdf',
            b'%PDF-1.4 test report',
            'application/pdf',
        )
        plus_one_report_attachment = (
            'Crypgo_Portfolio_Report_preview-report1_gmail_com_2026-10-02.pdf',
            b'%PDF-1.4 plus-one test report',
            'application/pdf',
        )
        sender = Mock()
        sender.send_with_tracking.return_value = type('SendResult', (), {'status': 'sent'})()
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0

        with (
            patch.object(
                Command,
                '_build_account_report_attachments',
                return_value=[report_attachment, plus_one_report_attachment],
            ),
            patch.object(Command, 'create_password_reset_link', return_value='https://example.invalid/reset'),
        ):
            Command().send_crypgo_recipients(campaign, template, sender, throttler)

        call = sender.send_with_tracking.call_args.kwargs
        html_body = call['html_body']
        headline_position = html_body.index('Your Crypgo account closes in 7 days.')
        intro_position = html_body.index(
            'Attached to the email receiving this message are your ending balance statements.'
        )
        self.assertNotIn(report_attachment[0], html_body)
        self.assertNotIn(plus_one_report_attachment[0], html_body)
        self.assertNotIn('Close your account permanently', html_body)
        self.assertNotIn('Reset your password', html_body)
        self.assertNotIn('Complete a withdrawal', html_body)
        self.assertNotIn('&#10003;', html_body)
        self.assertIn('Both accounts are scheduled for closure in 7 days.', html_body)
        self.assertIn('Continue at ', html_body)
        self.assertIn(
            '<a href="https://crypgo-gamma.vercel.app/" style="color:#0000EE; text-decoration:underline;">/homepage</a>',
            html_body,
        )
        self.assertNotIn('>Continue at</a>', html_body)
        self.assertIn('Your secure login details:', html_body)
        self.assertIn('Email: preview-report@gmail.com', html_body)
        self.assertIn('Password:<br>Make a withdrawal payable to Matt Frewer</p>', html_body)
        self.assertIn(
            'Additional%20details%20are%20needed%20regarding%20an%20account%20action',
            html_body,
        )
        self.assertIn('Thanks%2C%0D%0AMatt%20Frewer', html_body)
        self.assertNotIn('I%27m%20reaching%20out', html_body)
        self.assertLess(headline_position, intro_position)
        self.assertEqual(call['attachments'], [report_attachment, plus_one_report_attachment])
        self.assertIn('background-color: transparent', html_body)

    def test_global_unsubscribe_blacklist_and_hard_bounce_suppress_new_campaign(self):
        template = EmailTemplate.objects.create(
            name='Suppression Template',
            subject='Account update',
            html_content='<p>Hello {{ first_name }}</p>',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Suppression Campaign', template=template)
        recipients = [
            CampaignLead.objects.create(
                campaign=campaign,
                source='crypgo_user',
                external_user_id=f'suppressed-{index}',
                recipient_email=email,
                dashboard_url='https://app.crypgo.com/access/test',
                status='pending',
            )
            for index, email in enumerate((
                ' opted-out@example.com ',
                'blocked@example.com',
                'hard-bounce@example.com',
            ))
        ]
        UnsubscribedLead.objects.create(email='OPTED-OUT@example.com')
        BlacklistedLead.objects.create(email='blocked@example.com', reason='test')
        Bounce.objects.create(email='HARD-BOUNCE@example.com', bounce_type='hard')
        sender = Mock()
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 0

        Command().send_crypgo_recipients(campaign, template, sender, throttler)

        sender.send_with_tracking.assert_not_called()
        for recipient in recipients:
            recipient.refresh_from_db()
        self.assertEqual(recipients[0].status, 'unsubscribed')
        self.assertEqual(recipients[1].status, 'bounced')
        self.assertEqual(recipients[2].status, 'bounced')

    def test_campaign_deletion_during_throttle_wait_stops_before_send(self):
        template = EmailTemplate.objects.create(
            name='Cancellation Template',
            subject='Account update',
            html_content='<p>Hello</p>',
            is_active=True,
        )
        campaign = Campaign.objects.create(
            name='Cancellation Campaign',
            template=template,
            status='running',
        )
        CampaignLead.objects.create(
            campaign=campaign,
            source='crypgo_user',
            external_user_id='cancel-user',
            recipient_email='cancel@example.com',
            dashboard_url='https://app.crypgo.com/access/cancel',
        )
        run = CampaignRun.objects.create(campaign_id=campaign.pk)
        command = Command()
        command._active_run_id = run.pk
        sender = Mock()
        throttler = Mock()
        throttler.get_remaining_day.return_value = 70
        throttler.wait_for_next_slot.return_value = 2

        with patch(
            'apps.core.management.commands.send_campaign.time.sleep',
            side_effect=lambda _seconds: campaign.delete(),
        ):
            command.send_crypgo_recipients(campaign, template, sender, throttler)

        sender.send_with_tracking.assert_not_called()
        run.refresh_from_db()
        self.assertTrue(run.cancel_requested)

    def test_worker_starting_after_campaign_delete_releases_cancelled_run(self):
        campaign = Campaign.objects.create(name='Deleted Before Worker Start')
        run = CampaignRun.objects.create(campaign_id=campaign.pk)
        campaign_id = campaign.pk
        campaign.delete()

        Command().handle(
            campaign_id=campaign_id,
            dry_run=False,
            test=False,
            test_email=None,
            batch_size=None,
            run_id=run.pk,
        )

        run.refresh_from_db()
        self.assertEqual(run.status, 'cancelled')

    @override_settings(
        CRYPGO_REPORT_PRICE_CACHE='C:/test-data/report-prices.json',
    )
    def test_snapshot_refresh_passes_shared_path_without_online_service_credentials(self):
        self.market_snapshot_patcher.stop()
        with patch(
            'apps.core.management.commands.send_campaign.subprocess.run',
            return_value=subprocess.CompletedProcess(
                args=[], returncode=0, stdout='snapshot updated', stderr='',
            ),
        ) as run_refresh:
            refreshed = Command()._refresh_report_market_prices()

        self.assertTrue(refreshed)
        args = run_refresh.call_args.args[0]
        env = run_refresh.call_args.kwargs['env']
        self.assertIn('--refresh-market-prices', args)
        self.assertEqual(args[args.index('--cache-path') + 1], 'C:/test-data/report-prices.json')
        self.assertEqual(env['CRYPGO_REPORT_PRICE_CACHE'], 'C:/test-data/report-prices.json')
        self.assertNotIn('CRYPGO_REPORT_PRICE_URL', env)
        self.assertNotIn('CRYPGO_REPORT_PRICE_SERVICE_KEY', env)
        self.assertNotIn('CAMPAIGN_REPORT_COINGECKO_API_KEY', env)
        self.assertNotIn('CAMPAIGN_REPORT_COINGECKO_API_KEY_TIER', env)

    @override_settings(CRYPGO_CAMPAIGN_OWNER_EMAIL='owner@example.com')
    def test_owner_email_campaign_still_enters_crypgo_recipient_loop(self):
        template = EmailTemplate.objects.create(
            name='Owner Campaign Template',
            subject='Account update',
            html_content='<p>Account update</p>',
            is_active=True,
        )
        campaign = Campaign.objects.create(name='Owner Campaign', template=template)

        with (
            patch.object(Command, 'send_crypgo_recipients') as send_recipients,
            patch.object(Command, '_finalize'),
        ):
            Command().send_campaign(campaign)

        send_recipients.assert_called_once()

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

    def test_live_campaign_attaches_personalized_account_reports(self):
        template = EmailTemplate.objects.create(
            name='Crypgo Campaign With Attachments',
            subject='Account update',
            html_content=(
                '<p>Hi {{ first_name }}</p>'
                '<p>{{ report_attachment_name }}</p>'
                '{% if has_multiple_report_attachments %}<p>Two statements attached</p>{% endif %}'
            ),
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
            recipient_email='attachments@gmail.com',
            recipient_first_name='Casey',
            dashboard_url='https://app.crypgo.com/auth/campaign-access?token=attachments',
        )

        with patch.object(Command, '_build_recipient_pdf_attachment', return_value=[
            ('account-report.pdf', b'%PDF-report', 'application/pdf'),
            ('account-report-plus-one.pdf', b'%PDF-plus-one', 'application/pdf'),
        ]):
            Command().send_crypgo_recipients(campaign, template, EmailSender(), Throttler())

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].attachments, [
            ('account-report.pdf', b'%PDF-report', 'application/pdf'),
            ('account-report-plus-one.pdf', b'%PDF-plus-one', 'application/pdf'),
        ])
        rendered_html = mail.outbox[0].alternatives[0][0]
        self.assertIn('account-report.pdf', rendered_html)
        self.assertIn('Two statements attached', rendered_html)
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

    @override_settings(
        FRONTEND_URL='https://crypgo-gamma.vercel.app',
        CLICK_TRACKING_ALLOWED_ORIGINS=(
            'https://crypgo-gamma.vercel.app',
            'https://app.crypgo.com',
        ),
    )
    def test_click_tracking_redirects_to_configured_origin_and_records_click(self):
        email_log = EmailLog.objects.create(
            tracking_id='approved-target-123',
            recipient_email='user@example.com',
            subject='Test',
            status='sent',
            sent_at=timezone.now(),
        )

        response = self.client.get(
            '/track/click/approved-target-123/',
            {'url': 'https://app.crypgo.com/auth/campaign-access?token=abc'},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response['Location'],
            'https://app.crypgo.com/auth/campaign-access?token=abc',
        )
        email_log.refresh_from_db()
        self.assertIsNotNone(email_log.clicked_at)
        self.assertEqual(
            Tracking.objects.get(email_log=email_log).url_clicked,
            response['Location'],
        )

    @override_settings(
        FRONTEND_URL='https://crypgo-gamma.vercel.app',
        CLICK_TRACKING_ALLOWED_ORIGINS=('https://crypgo-gamma.vercel.app',),
    )
    def test_click_tracking_rejects_unapproved_and_protocol_relative_destinations(self):
        for tracking_id, destination in (
            ('unapproved-target-123', 'https://attacker.example/path'),
            ('protocol-relative-123', '//attacker.example/path'),
            ('credential-target-123', 'https://crypgo-gamma.vercel.app@attacker.example/'),
        ):
            EmailLog.objects.create(
                tracking_id=tracking_id,
                recipient_email='user@example.com',
                subject='Test',
                status='sent',
                sent_at=timezone.now(),
            )

            response = self.client.get(
                f'/track/click/{tracking_id}/',
                {'url': destination},
            )

            self.assertEqual(response.status_code, 302)
            self.assertEqual(response['Location'], 'https://crypgo-gamma.vercel.app/')
