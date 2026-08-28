from datetime import datetime, time as dt_time, timedelta

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.campaigns.models import Campaign
from apps.campaigns.models import CampaignLead
from apps.email_engine.models import EmailLog
from apps.email_engine.sender import EmailSender
from apps.email_engine.throttler import Throttler
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

    def test_throttler_blocks_after_350_sends_in_a_day(self):
        sent_at = datetime.combine(timezone.now().date(), dt_time(12, 0))
        EmailLog.objects.bulk_create([
            EmailLog(
                campaign=self.campaign,
                recipient_email=f'day-{idx}@example.com',
                subject='Test',
                tracking_id=f'day-throttle-test-{idx}',
                status='sent',
                sent_at=sent_at,
            )
            for idx in range(350)
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

    @override_settings(
        SITE_URL='https://public.example.com',
        FRONTEND_URL='https://public.example.com',
    )
    def test_click_tracking_encodes_target_url(self):
        sender = EmailSender()
        html = '<a href="https://dashboard.example.com/auth/campaign-access?token=abc&next=%2Fdashboard">Open</a>'

        tracked = sender._wrap_click_links(html, 'tracking-123')

        self.assertIn('https://public.example.com/track/click/tracking-123/?url=https%3A%2F%2Fdashboard.example.com%2Fauth%2Fcampaign-access%3Ftoken%3Dabc%26next%3D%252Fdashboard', tracked)

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
