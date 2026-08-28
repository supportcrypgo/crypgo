import logging
import uuid
import re
from email.utils import parseaddr
from urllib.parse import quote, urlparse
from django.core.mail import EmailMultiAlternatives
from django.template import Template, Context
from django.conf import settings
from django.utils import timezone
from django.db.models import F
from .models import EmailLog, Bounce, Tracking
from .retry import RetryHandler
from .throttler import Throttler

logger = logging.getLogger(__name__)


class EmailSender:
    """Core email sending engine with tracking, retry, and logging"""

    def __init__(self):
        self.retry_handler = RetryHandler()
        self.throttler = Throttler()

    def _resolve_from_email(self):
        """Return a consistently formatted from address."""
        raw_from = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER
        display_name, email_address = parseaddr(raw_from)

        if not email_address:
            email_address = settings.EMAIL_HOST_USER

        if not display_name:
            display_name = settings.EMAIL_FROM_NAME

        return f"{display_name} <{email_address}>"

    def _build_headers(self, recipient_email, tracking_id):
        """Build a standard, safe set of email headers."""
        site_url = settings.SITE_URL.rstrip('/')
        message_domain = urlparse(site_url).hostname or 'localhost'
        unsubscribe_email = quote(recipient_email, safe='')

        return {
            'Message-ID': f'<{tracking_id}@{message_domain}>',
            'List-Unsubscribe': f'<{site_url}/unsubscribe/?email={unsubscribe_email}>',
            'X-Mailer': settings.EMAIL_X_MAILER,
        }

    def send_campaign_email(self, lead, template, campaign=None, context=None):
        """Send a single campaign email to one lead"""
        from apps.campaigns.models import Campaign as CampaignModel

        if context is None:
            context = {}

        # Generate tracking IDs
        tracking_id = str(uuid.uuid4())

        # Build context with lead data
        site_url = settings.SITE_URL.rstrip('/')
        encoded_email = quote(lead.email, safe='')
        full_context = {
            'first_name': lead.first_name or '',
            'last_name': lead.last_name or '',
            'full_name': f"{lead.first_name or ''} {lead.last_name or ''}".strip(),
            'email': lead.email,
            'company': lead.company or '',
            'greeting': lead.first_name or 'there',
            'unsubscribe_url': f"{site_url}/unsubscribe/?email={encoded_email}",
            'tracking_pixel': f"{site_url}/track/open/{tracking_id}/",
            **context,
        }

        # Render subject and body
        subject = self._render_template(template.subject, full_context)
        html_body = self._render_template(template.html_content, full_context)

        # Inject tracking pixel
        html_body = self._inject_tracking_pixel(html_body, tracking_id)

        # Inject unsubscribe link
        html_body = self._inject_unsubscribe_link(html_body, lead.email)

        # Wrap URLs for click tracking
        html_body = self._wrap_click_links(html_body, tracking_id)

        # Get plain text fallback
        plain_text = template.plain_text
        if plain_text:
            plain_text = self._render_template(plain_text, full_context)

        try:
            # Check rate limits
            if not self.throttler.can_send():
                logger.warning("Rate limit exceeded, queuing email for %s", lead.email)
                return self._log_attempt(
                    campaign=campaign,
                    recipient_email=lead.email,
                    subject=subject,
                    status='pending',
                    tracking_id=tracking_id,
                    error_message='Rate limited'
                )

            # Build email
            from_email = self._resolve_from_email()
            # Generate plain text fallback if none provided
            if not plain_text and html_body:
                import re
                plain_text = re.sub(r'<[^>]+>', '', html_body).strip()
            headers = self._build_headers(lead.email, tracking_id)
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text or html_body,
                from_email=from_email,
                to=[lead.email],
                headers=headers,
            )
            if html_body:
                msg.attach_alternative(html_body, "text/html")
            # Send
            msg.send(fail_silently=False)

            # Track success
            self.throttler.record_send()
            email_log = self._log_attempt(
                campaign=campaign,
                recipient_email=lead.email,
                subject=subject,
                status='sent',
                tracking_id=tracking_id,
                message_id=headers.get('Message-ID'),
            )

            # Update lead status

            # Update campaign stats if campaign is provided
            if campaign:
                CampaignModel.objects.filter(pk=campaign.pk).update(
                    sent_count=F('sent_count') + 1
                )

            logger.info("Email sent to %s (tracking: %s)", lead.email, tracking_id)
            return email_log

        except Exception as e:
            logger.error("Failed to send email to %s: %s", lead.email, str(e))
            error_msg = str(e)

            # Log the failure
            email_log = self._log_attempt(
                campaign=campaign,
                recipient_email=lead.email,
                subject=subject,
                status='failed',
                tracking_id=tracking_id,
                error_message=error_msg,
            )

            # Update lead status

            # Update campaign stats if campaign is provided
            if campaign:
                CampaignModel.objects.filter(pk=campaign.pk).update(
                    failed_count=F('failed_count') + 1
                )

            # Trigger retry
            if email_log:
                self.retry_handler.schedule_retry(
                    email_log_id=email_log.pk,
                    func=self.send_campaign_email,
                    args=(lead, template, campaign, context),
                    max_retries=3,
                )

            return email_log

    def send_with_tracking(self, recipient_email, subject, html_body,
                           plain_text=None, campaign=None,
                           context=None, track_links=True):
        """Send a standalone email with full tracking"""
        tracking_id = str(uuid.uuid4())

        # Inject tracking
        html_body = self._inject_tracking_pixel(html_body, tracking_id)
        html_body = self._inject_unsubscribe_link(html_body, recipient_email)
        if track_links:
            html_body = self._wrap_click_links(html_body, tracking_id)

        try:
            if not self.throttler.can_send():
                return self._log_attempt(
                    campaign=campaign,
                    recipient_email=recipient_email, subject=subject,
                    status='pending', tracking_id=tracking_id,
                    error_message='Rate limited'
                )

            from_email = self._resolve_from_email()
            # Generate plain text fallback if none provided
            if not plain_text and html_body:
                plain_text = re.sub(r'<[^>]+>', '', html_body).strip()
            headers = self._build_headers(recipient_email, tracking_id)
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text or html_body,
                from_email=from_email,
                to=[recipient_email],
                headers=headers,
            )
            if html_body:
                msg.attach_alternative(html_body, "text/html")

            msg.send(fail_silently=False)
            self.throttler.record_send()

            return self._log_attempt(
                campaign=campaign,
                recipient_email=recipient_email, subject=subject,
                status='sent', tracking_id=tracking_id,
                message_id=headers.get('Message-ID'),
            )

        except Exception as e:
            logger.error("Send failed to %s: %s", recipient_email, str(e))
            return self._log_attempt(
                campaign=campaign,
                recipient_email=recipient_email, subject=subject,
                status='failed', tracking_id=tracking_id,
                error_message=str(e),
            )

    def _render_template(self, content, context):
        """Render a Django template string with context"""
        try:
            template = Template(content)
            rendered = template.render(Context(context))
            return rendered
        except Exception as e:
            logger.warning("Template rendering error: %s", str(e))
            return content

    def _inject_tracking_pixel(self, html_body, tracking_id):
        """Inject 1x1 tracking pixel into email HTML (idempotent - skips if already present)"""
        site_url = settings.SITE_URL.rstrip('/')
        pixel_url = f"{site_url}/track/open/{tracking_id}/"
        
        # Skip if pixel already exists in the body (e.g. from template {{ tracking_pixel }})
        if pixel_url in html_body:
            return html_body
            
        pixel_tag = f'<img src="{pixel_url}" width="1" height="1" style="display:none;" alt=""/>'
        # Insert before closing body tag or at the end
        if '</body>' in html_body:
            html_body = html_body.replace('</body>', f'{pixel_tag}\n</body>')
        else:
            html_body += f'\n{pixel_tag}'
        return html_body

    def _inject_unsubscribe_link(self, html_body, email):
        """Inject unsubscribe link into email HTML (idempotent - skips if already present)"""
        site_url = settings.SITE_URL.rstrip('/')
        unsubscribe_url = f"{site_url}/unsubscribe/?email={quote(email, safe='')}"
        
        # Skip if unsubscribe link already exists in the body (e.g. from template {{ unsubscribe_url }})
        if unsubscribe_url in html_body:
            return html_body
            
        link_html = (
            f'<p style="font-size:12px;color:#999;">'
            f'If you no longer wish to receive these emails, '
            f'<a href="{unsubscribe_url}" style="color:#999;">unsubscribe here</a>.'
            f'</p>'
        )
        if '</body>' in html_body:
            html_body = html_body.replace('</body>', f'{link_html}\n</body>')
        else:
            html_body += f'\n{link_html}'
        return html_body

    def _wrap_click_links(self, html_body, tracking_id):
        """Wrap all links in click tracking URLs"""
        import re
        site_url = settings.SITE_URL.rstrip('/')

        def replace_link(match):
            original_url = match.group(2)
            # Skip mailto: links and anchor-only links
            if original_url.startswith('mailto:') or original_url.startswith('#'):
                return match.group(0)
            # Don't re-wrap already tracked URLs
            if f'{site_url}/track/click/' in original_url:
                return match.group(0)
            encoded_target = quote(original_url, safe='')
            tracked_url = f"{site_url}/track/click/{tracking_id}/?url={encoded_target}"
            return f'href="{tracked_url}"'

        # Match href="..." or href='...'
        html_body = re.sub(
            r'href=(["\'])((?:https?://|/)[^"\']+)\1',
            replace_link,
            html_body,
            flags=re.IGNORECASE,
        )
        return html_body

    def _log_attempt(self, campaign=None, recipient_email='',
                     subject='', status='pending', tracking_id=None,
                     message_id=None, error_message=None):
        """Create an EmailLog entry"""
        import logging
        try:
            email_log = EmailLog.objects.create(
                campaign=campaign,
                recipient_email=recipient_email,
                subject=subject,
                status=status,
                tracking_id=tracking_id or str(uuid.uuid4()),
                message_id=message_id or '',
                error_message=error_message or '',
                sent_at=timezone.now(),
            )
            return email_log
        except Exception as e:
            logger.error("Failed to create EmailLog: %s", str(e))
            return None


# Module-level convenience functions
sender = EmailSender()


def send_email(recipient_email, subject, html_body, plain_text=None,
               campaign=None, context=None):
    """Convenience function to send an email"""
    return sender.send_with_tracking(
        recipient_email=recipient_email,
        subject=subject,
        html_body=html_body,
        plain_text=plain_text,
        campaign=campaign,
        context=context,
    )


def send_campaign_email(lead, template, context=None):
    """Convenience function for campaign email sending"""
    return sender.send_campaign_email(lead, template, context)
