import logging
import os
import random
import subprocess
import sys
import time
import hashlib
import hmac
from pathlib import Path
import requests
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify
from django.db.models import Count, F
from django.conf import settings
from apps.campaigns.models import Campaign

logger = logging.getLogger('email_bot')


class Command(BaseCommand):
    help = 'Send a specific campaign or all pending campaigns'

    def add_arguments(self, parser):
        parser.add_argument('--campaign-id', type=int, help='Specific campaign ID to send')
        parser.add_argument('--dry-run', action='store_true', help='Simulate sending without actually sending')
        parser.add_argument('--test', action='store_true', help='Test mode - send to test email only')
        parser.add_argument('--test-email', type=str, help='Email address for test mode (requires --test)')
        parser.add_argument('--batch-size', type=int, default=None, help='Override batch size')

    def handle(self, *args, **options):
        campaign_id = options['campaign_id']
        dry_run = options['dry_run']
        test_mode = options.get('test', False)
        test_email = options.get('test_email', None)

        if campaign_id:
            try:
                campaign = Campaign.objects.get(id=campaign_id)
            except Campaign.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Campaign with ID {campaign_id} does not exist.'))
                return
            campaigns = [campaign]
        else:
            campaigns = Campaign.objects.filter(
                status__in=['draft', 'running'],
                scheduled_at__lte=timezone.now()
            )

        if not campaigns:
            self.stdout.write(self.style.WARNING('No campaigns to send.'))
            return

        for campaign in campaigns:
            if campaign.is_paused:
                self.stdout.write(self.style.WARNING(f'Campaign "{campaign.name}" is paused. Skipping.'))
                continue

            if campaign.status == 'completed':
                self.stdout.write(self.style.WARNING(f'Campaign "{campaign.name}" is already completed. Skipping.'))
                continue

            self.stdout.write(f'Starting campaign: {campaign.name} (ID: {campaign.id})')

            if test_mode:
                if not test_email:
                    self.stderr.write('--test-email is required when using --test')
                    return
                self.send_test_email(campaign, test_email)
                continue

            if dry_run:
                from apps.campaigns.models import CampaignLead
                total_leads = CampaignLead.objects.filter(
                    campaign=campaign,
                    source='crypgo_user',
                    status__in=['pending', 'queued'],
                ).count()
                self.stdout.write(f'[DRY RUN] Campaign: {campaign.name}')
                self.stdout.write(f'[DRY RUN] Would send to: {total_leads} leads')
                self.stdout.write(f'[DRY RUN] Template: {campaign.template.name if campaign.template else "None"}')
                continue

            self.send_campaign(campaign)

    def _build_recipient_pdf_attachment(self, recipient):
        """Build a recipient-specific PDF attachment from the API-side user report generator."""
        report_script = Path(__file__).resolve().parents[5] / 'django_backend' / 'generate_user_report.py'
        if not report_script.exists():
            logger.warning('PDF report generator not found at %s', report_script)
            return []

        try:
            if recipient.recipient_email:
                command = [
                    sys.executable,
                    str(report_script),
                    '--email',
                    recipient.recipient_email,
                    '--stdout',
                ]
            elif recipient.external_user_id:
                command = [
                    sys.executable,
                    str(report_script),
                    '--public-id',
                    recipient.external_user_id,
                    '--stdout',
                ]
            else:
                logger.warning('No recipient identifier available for PDF generation.')
                return []

            env = os.environ.copy()
            env['DJANGO_SETTINGS_MODULE'] = 'core.settings'
            env['PYTHONPATH'] = str(report_script.parents[1]) + os.pathsep + env.get('PYTHONPATH', '')

            result = subprocess.run(
                command,
                cwd=report_script.parents[1],
                capture_output=True,
                check=False,
                env=env,
            )

            if result.returncode != 0:
                error_text = result.stderr.decode('utf-8', errors='replace').strip()
                logger.error('Failed to generate PDF report for %s: %s', recipient.recipient_email or recipient.external_user_id, error_text or 'unknown error')
                return []

            report_bytes = result.stdout or b''
            if not report_bytes:
                logger.warning('PDF report generation returned no bytes for %s', recipient.recipient_email or recipient.external_user_id)
                return []

            user_identifier = (
                slugify(recipient.external_user_id or recipient.recipient_email or str(recipient.pk))
                or str(recipient.pk)
            )
            filename = (
                f"Crypgo_Portfolio_Report_{user_identifier}_{timezone.now().strftime('%Y-%m-%d')}.pdf"
            )
            return [(filename, report_bytes, 'application/pdf')]
        except Exception as exc:
            logger.exception('Unexpected error while generating PDF attachment for recipient %s', recipient.recipient_email or recipient.external_user_id)
            return []

    def send_test_email(self, campaign, test_email):
        """Send a single test email using the full email engine pipeline"""
        from apps.email_engine.sender import EmailSender
        from apps.templates.renderer import TemplateRenderer
        from apps.campaigns.models import CampaignLead

        self.stdout.write(f'Sending test email to: {test_email}')

        try:
            if not self.refresh_crypgo_links(campaign):
                self.stderr.write(self.style.ERROR(
                    'Could not refresh the campaign access link from Crypgo.'
                ))
                return

            # Query the CampaignLead table for the actual recipient record
            campaign_lead = CampaignLead.objects.filter(
                recipient_email=test_email,
                campaign=campaign,
                source='crypgo_user'
            ).first()

            if not campaign_lead:
                self.stderr.write(self.style.ERROR(
                    f'No CampaignLead record found for test email: {test_email}. '
                    f'Please ensure the recipient is in the campaign.'
                ))
                return

            # Extract recipient data from the CampaignLead record
            first_name = campaign_lead.recipient_first_name or ''
            last_name = campaign_lead.recipient_last_name or ''
            dashboard_url = campaign_lead.dashboard_url or settings.SITE_URL.rstrip('/') + '/dashboard/'

            sender = EmailSender()
            context = {
                'first_name': first_name,
                'last_name': last_name,
                'email': test_email,
                'dashboard_url': dashboard_url,
            }
            result = sender.send_with_tracking(
                recipient_email=test_email,
                subject=TemplateRenderer.render_subject(campaign.template.subject, context),
                html_body=str(TemplateRenderer.render(campaign.template.html_content, context)),
                plain_text=TemplateRenderer._simple_render(campaign.template.plain_text or '', context),
                campaign=campaign,
            )

            if result and getattr(result, 'status', None) in ('sent', 'delivered'):
                self.stdout.write(self.style.SUCCESS('Test email sent successfully'))
            else:
                status = getattr(result, 'status', 'unknown')
                self.stdout.write(self.style.WARNING(f'Test email status: {status}'))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Test email failed: {str(e)}'))
            logger.error('Test email failed: %s', str(e))

    def send_campaign(self, campaign):
        """Send campaign using the full email engine pipeline"""
        from apps.campaigns.models import CampaignLead
        from apps.leads.models import BlacklistedLead
        from apps.unsubscribes.models import UnsubscribedLead
        from apps.email_engine.sender import EmailSender
        from apps.email_engine.models import EmailLog
        from apps.templates.renderer import TemplateRenderer
        from apps.email_engine.throttler import Throttler

        sender = EmailSender()
        throttler = Throttler()

        # Mark campaign as running
        if campaign.status == 'draft':
            campaign.status = 'running'
            campaign.started_at = timezone.now()
            campaign.save(update_fields=['status', 'started_at', 'updated_at'])
            self.stdout.write(self.style.SUCCESS(f'Campaign "{campaign.name}" started.'))

        # Setup
        batch_size = campaign.batch_size
        template_a = campaign.template
        template_b = campaign.template_b
        use_ab_testing = template_b is not None

        if not template_a:
            self.stderr.write(self.style.ERROR(f'Campaign "{campaign.name}" has no template assigned.'))
            return

        if not self.refresh_crypgo_links(campaign):
            self.stderr.write(self.style.ERROR(
                f'Campaign "{campaign.name}" stopped because campaign-access links could not be refreshed.'
            ))
            return

        self.send_crypgo_recipients(campaign, template_a, sender, throttler)

        self._finalize(campaign, 0, 0)
        return

    def refresh_crypgo_links(self, campaign):
        """Refresh stored Crypgo links before sending to prevent stale access URLs."""
        from apps.campaigns.models import CampaignLead

        if not settings.CRYPGO_SERVICE_KEY:
            logger.error('Cannot refresh Crypgo links: CRYPGO_SERVICE_KEY is missing.')
            return False

        body = b'{}'
        signature = hmac.new(
            settings.CRYPGO_SERVICE_KEY.encode('utf-8'), body, hashlib.sha256
        ).hexdigest()
        endpoint = (
            f"{settings.CRYPGO_API_URL.rstrip('/')}/api/internal/campaigns/"
            f"{campaign.pk}/recipients/export/"
        )

        try:
            response = requests.post(
                endpoint,
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'X-Bot-Signature': signature,
                },
                timeout=60,
            )
            response.raise_for_status()
            exported = response.json().get('recipients', [])
            if not isinstance(exported, list):
                raise ValueError('Crypgo returned an invalid recipient list.')

            existing = {
                lead.external_user_id: lead
                for lead in CampaignLead.objects.filter(
                    campaign=campaign,
                    source='crypgo_user',
                )
            }
            refreshed = 0
            for recipient in exported:
                external_user_id = recipient.get('external_user_id')
                dashboard_url = recipient.get('dashboard_url')
                if not isinstance(external_user_id, str) or not isinstance(dashboard_url, str):
                    continue
                lead = existing.get(external_user_id)
                if lead is None or lead.dashboard_url == dashboard_url:
                    continue
                lead.dashboard_url = dashboard_url
                lead.save(update_fields=['dashboard_url', 'updated_at'])
                refreshed += 1

            logger.info(
                'Refreshed %s campaign-access link(s) for campaign %s.',
                refreshed,
                campaign.pk,
            )
            return True
        except (requests.RequestException, KeyError, TypeError, ValueError) as error:
            logger.exception('Crypgo link refresh failed for campaign %s: %s', campaign.pk, error)
            return False

        # Get unsubscribed emails to exclude
        unsubscribed_emails = set(
            UnsubscribedLead.objects.values_list('email', flat=True)
        )

        # Get blacklisted emails
        blacklisted_emails = set(
            BlacklistedLead.objects.values_list('email', flat=True)
        )

        max_document_id = (
            Lead.objects.aggregate(max_doc=Count('document_id', distinct=True))['max_doc'] or 1
        )

        self.stdout.write(
            f'  Status: {campaign.get_status_display()}\n'
            f'  Batch size: {batch_size}\n'
            f'  A/B Testing: {"Enabled" if use_ab_testing else "Disabled"}\n'
            f'  Documents: {campaign.current_document_id} to {max_document_id}\n'
            f'  Rate: 1 email every 90 seconds (40/hour, 70/day)'
        )

        total_sent = 0
        total_failed = 0

        # Process documents
        for doc_id in range(campaign.current_document_id, max_document_id + 1):
            campaign.current_document_id = doc_id
            campaign.save(update_fields=['current_document_id', 'updated_at'])

            self.stdout.write(f'\n--- Processing Document {doc_id} ---')

            # Get sent lead IDs
            sent_lead_ids = set(
                CampaignLead.objects.filter(
                    campaign=campaign, status='sent'
                ).values_list('lead_id', flat=True)
            )

            leads_qs = Lead.objects.filter(document_id=doc_id)
            if campaign.last_processed_index > 0:
                leads_qs = leads_qs.filter(id__gt=campaign.last_processed_index)

            # Filter leads
            leads = []
            for lead in leads_qs.order_by('id'):
                if lead.id in sent_lead_ids:
                    continue
                if lead.email in blacklisted_emails:
                    continue
                if lead.email in unsubscribed_emails:
                    continue
                leads.append(lead)

            total_in_doc = len(leads)
            if total_in_doc == 0:
                self.stdout.write(f'  Document {doc_id} has no pending leads. Moving on.')
                campaign.last_processed_index = 0
                campaign.save(update_fields=['last_processed_index', 'updated_at'])
                continue

            self.stdout.write(f'  Leads to process: {total_in_doc}')

            doc_sent = 0
            doc_failed = 0

            for batch_start in range(0, total_in_doc, batch_size):
                batch = leads[batch_start:batch_start + batch_size]
                batch_end = min(batch_start + batch_size, total_in_doc)
                self.stdout.write(f'  Batch {batch_start + 1}-{batch_end}/{total_in_doc}')

                for lead in batch:
                    campaign.refresh_from_db(fields=['is_paused', 'status'])
                    if campaign.is_paused or campaign.status == 'paused':
                        self.stdout.write(self.style.WARNING('Campaign paused. Stopping send.'))
                        return
                    remaining_day = throttler.get_remaining_day(campaign)
                    if remaining_day <= 0:
                        self.stdout.write(self.style.WARNING('Daily cap reached. Pausing campaign.'))
                        campaign.status = 'paused'
                        campaign.is_paused = True
                        campaign.save(update_fields=['status', 'is_paused', 'updated_at'])
                        self._finalize(campaign, total_sent, total_failed)
                        return

                    wait_time = throttler.wait_for_next_slot(campaign)
                    if wait_time > 0:
                        self.stdout.write(
                            self.style.WARNING(
                                f'Waiting {wait_time:.0f} seconds for the next send slot...'
                            )
                        )
                        time.sleep(wait_time)

                    # A/B template variant
                    if use_ab_testing and random.random() < campaign.split_ratio:
                        template = template_b
                        variant = 'B'
                    else:
                        template = template_a
                        variant = 'A'

                    # Create/get CampaignLead record
                    campaign_lead, created = CampaignLead.objects.get_or_create(
                        campaign=campaign,
                        lead=lead,
                        defaults={'status': 'pending', 'template_variant': variant}
                    )

                    if campaign_lead.status == 'sent':
                        continue

                    try:
                        # Render template
                        rendered = TemplateRenderer.render_for_lead(
                            lead=lead, template=template, campaign=campaign
                        )

                        # Send email
                        result = sender.send_campaign_email(
                            lead=lead, template=template, campaign=campaign,
                            context={
                                'subject': rendered['subject'],
                                'html_content': rendered['html'],
                                'plain_content': rendered['plain'],
                            },
                        )

                        if result and getattr(result, 'status', None) in ('sent', 'delivered'):
                            campaign_lead.status = 'sent'
                            campaign_lead.sent_at = timezone.now()
                            campaign_lead.template_variant = variant
                            campaign_lead.save()
                            Campaign.objects.filter(pk=campaign.pk).update(
                                sent_count=F('sent_count') + 1,
                                last_processed_index=lead.id,
                            )
                            doc_sent += 1
                        else:
                            campaign.refresh_from_db()
                            if campaign.is_paused:
                                self.stdout.write(self.style.WARNING('Campaign paused after a provider limit error.'))
                                return
                            raise Exception(f'Email send returned status: {getattr(result, "status", "unknown")}')

                    except Exception as e:
                        campaign.refresh_from_db()
                        if campaign.is_paused:
                            self.stdout.write(self.style.WARNING('Campaign paused after a provider limit error.'))
                            return
                        logger.error("Failed to send to %s (lead %d): %s", lead.email, lead.pk, str(e))
                        campaign_lead.retry_count = F('retry_count') + 1
                        campaign_lead.error_message = str(e)[:500]
                        campaign_lead.save()
                        campaign_lead.refresh_from_db()
                        if campaign_lead.retry_count >= 3:
                            campaign_lead.status = 'failed'
                            campaign_lead.save()
                            Campaign.objects.filter(pk=campaign.pk).update(
                                failed_count=F('failed_count') + 1,
                            )
                            doc_failed += 1

                # After batch
                campaign.refresh_from_db()
                self.stdout.write(f'    Progress: {doc_sent} sent, {doc_failed} failed (total sent: {campaign.sent_count})')

            # Document complete
            campaign.last_processed_index = 0
            campaign.save(update_fields=['last_processed_index', 'updated_at'])
            total_sent += doc_sent
            total_failed += doc_failed

        self._finalize(campaign, total_sent, total_failed)

    def send_crypgo_recipients(self, campaign, template, sender, throttler):
        """Send campaign-scoped Crypgo recipients with their dashboard links."""
        from apps.campaigns.models import CampaignLead
        from apps.templates.renderer import TemplateRenderer

        recipients = CampaignLead.objects.filter(
            campaign=campaign,
            source='crypgo_user',
        ).exclude(status='sent').order_by('id')

        for recipient in recipients:
            campaign.refresh_from_db(fields=['is_paused', 'status'])
            if campaign.is_paused or campaign.status == 'paused':
                logger.info('Campaign %s paused. Stopping recipient send.', campaign.pk)
                return
            if throttler.get_remaining_day(campaign) <= 0:
                logger.warning('Campaign %s reached its daily cap. Pausing.', campaign.pk)
                campaign.status = 'paused'
                campaign.is_paused = True
                campaign.save(update_fields=['status', 'is_paused', 'updated_at'])
                return
            if not recipient.recipient_email or not recipient.dashboard_url:
                recipient.status = 'failed'
                recipient.error_message = 'Recipient email or dashboard URL is missing.'
                recipient.save(update_fields=['status', 'error_message', 'updated_at'])
                continue

            wait_time = throttler.wait_for_next_slot(campaign)
            if wait_time > 0:
                time.sleep(wait_time)

            context = {
                'first_name': recipient.recipient_first_name or '',
                'last_name': recipient.recipient_last_name or '',
                'email': recipient.recipient_email,
                'dashboard_url': recipient.dashboard_url,
            }
            rendered_html = TemplateRenderer.render(template.html_content, context)
            rendered_plain = TemplateRenderer._simple_render(template.plain_text or '', context)
            rendered_subject = TemplateRenderer.render_subject(template.subject, context)
            attachments = []
            if template.include_account_report_attachment:
                attachments = self._build_recipient_pdf_attachment(recipient)

            result = sender.send_with_tracking(
                recipient_email=recipient.recipient_email,
                subject=rendered_subject,
                html_body=str(rendered_html),
                plain_text=rendered_plain,
                campaign=campaign,
                track_links=True,
                attachments=attachments,
            )
            if result and getattr(result, 'status', None) in ('sent', 'delivered'):
                recipient.status = 'sent'
                recipient.sent_at = timezone.now()
                recipient.error_message = ''
            else:
                campaign.refresh_from_db()
                if campaign.is_paused:
                    logger.warning('Campaign %s paused after a provider limit error.', campaign.pk)
                    return
                recipient.status = 'failed'
                recipient.error_message = f'Email send returned status: {getattr(result, "status", "unknown")}'
            recipient.save(update_fields=['status', 'sent_at', 'error_message', 'updated_at'])

        Campaign.objects.filter(pk=campaign.pk).update(
            sent_count=CampaignLead.objects.filter(campaign=campaign, status='sent').count()
        )

    def _finalize(self, campaign, total_sent, total_failed):
        """Finalize campaign"""
        from apps.campaigns.models import CampaignLead

        campaign.refresh_from_db()
        pending_count = CampaignLead.objects.filter(
            campaign=campaign, status__in=['pending', 'queued', 'failed']
        ).count()

        if pending_count == 0 and not campaign.is_paused:
            Campaign.objects.filter(pk=campaign.pk).update(
                status='completed', completed_at=timezone.now(),
            )
            self.stdout.write(self.style.SUCCESS(
                f'\nCampaign "{campaign.name}" fully completed!\n'
                f'  Total sent: {campaign.sent_count}\n'
                f'  Total failed: {campaign.failed_count}'
            ))
        else:
            self.stdout.write(
                f'\nCampaign "{campaign.name}" progress saved.\n'
                f'  Sent: {campaign.sent_count}\n'
                f'  Failed: {campaign.failed_count}\n'
                f'  Remaining (pending/failed): {pending_count}\n'
                f'  Status: {campaign.get_status_display()}'
            )
