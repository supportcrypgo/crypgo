import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

from .gmail_sender import gmail_sender

logger = logging.getLogger(__name__)


class GmailAPIBackend(BaseEmailBackend):
    """Django email backend that sends messages through Gmail over HTTPS."""

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        sent_count = 0
        for email_message in email_messages:
            try:
                message = MIMEMultipart('alternative')
                message['Subject'] = email_message.subject
                message['From'] = email_message.from_email
                message['To'] = ', '.join(email_message.to)
                for key, value in email_message.extra_headers.items():
                    message[key] = value

                if email_message.body:
                    message.attach(MIMEText(email_message.body, 'plain'))
                for content, mimetype in email_message.alternatives:
                    message.attach(MIMEText(content, mimetype.split('/', 1)[-1]))

                raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
                gmail_sender._get_service().users().messages().send(
                    userId='me', body={'raw': raw_message}
                ).execute()
                sent_count += 1
            except Exception:
                logger.exception('Failed to send email through Gmail API')
                if not self.fail_silently:
                    raise

        return sent_count
