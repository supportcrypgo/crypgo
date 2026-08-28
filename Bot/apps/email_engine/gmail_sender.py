import base64
import logging
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


class GmailAPISender:
    """Gmail API sender for email bot campaigns"""

    def __init__(self):
        self._service = None

    def _get_service(self):
        if self._service:
            return self._service

        client_id = getattr(settings, 'GMAIL_CLIENT_ID', None)
        client_secret = getattr(settings, 'GMAIL_CLIENT_SECRET', None)
        refresh_token = getattr(settings, 'GMAIL_REFRESH_TOKEN', None)

        if not all([client_id, client_secret, refresh_token]):
            raise ValueError("Gmail API credentials not configured")

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

    def send(self, from_email, to_emails, subject, html_body, plain_text=None, headers=None):
        """Send email via Gmail API"""
        service = self._get_service()

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = ', '.join(to_emails) if isinstance(to_emails, list) else to_emails

        if headers:
            for key, value in headers.items():
                msg[key] = value

        if plain_text:
            msg.attach(MIMEText(plain_text, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        message = {'raw': raw}

        result = service.users().messages().send(userId='me', body=message).execute()
        return result.get('id')


# Module-level instance
gmail_sender = GmailAPISender()