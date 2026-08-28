import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


class GmailAPIBackend(BaseEmailBackend):
    """Django email backend using Gmail API with refresh token"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._service = None

    def _get_gmail_service(self):
        """Build Gmail API service using refresh token from env vars"""
        if self._service:
            return self._service

        client_id = getattr(settings, 'GMAIL_CLIENT_ID', None)
        client_secret = getattr(settings, 'GMAIL_CLIENT_SECRET', None)
        refresh_token = getattr(settings, 'GMAIL_REFRESH_TOKEN', None)

        if not all([client_id, client_secret, refresh_token]):
            raise ValueError("Gmail API credentials not configured in environment")

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=["https://www.googleapis.com/auth/gmail.send"]
        )

        self._service = build('gmail', 'v1', credentials=creds, cache_discovery=False)
        return self._service

    def _create_message(self, email_message):
        """Convert Django EmailMessage to Gmail API format"""
        if isinstance(email_message, MIMEMultipart):
            mime_msg = email_message
        else:
            mime_msg = MIMEMultipart()
            mime_msg['Subject'] = email_message.subject
            mime_msg['From'] = email_message.from_email
            mime_msg['To'] = ', '.join(email_message.to)

            # Add headers
            for key, value in email_message.extra_headers.items():
                mime_msg[key] = value

            # Add body
            if hasattr(email_message, 'alternatives'):
                for content, mimetype in email_message.alternatives:
                    if mimetype == 'text/html':
                        mime_msg.attach(MIMEText(content, 'html'))
                    else:
                        mime_msg.attach(MIMEText(content, 'plain'))
            else:
                mime_msg.attach(MIMEText(email_message.body, 'plain'))

        raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
        return {'raw': raw}

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        service = self._get_gmail_service()
        sent_count = 0

        for email_message in email_messages:
            try:
                message = self._create_message(email_message)
                service.users().messages().send(userId='me', body=message).execute()
                sent_count += 1
                logger.info(f"Email sent via Gmail API to {email_message.to}")
            except Exception as e:
                logger.error(f"Failed to send email via Gmail API: {e}")
                if not self.fail_silently:
                    raise

        return sent_count