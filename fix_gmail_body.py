#!/usr/bin/env python3
"""
Fix Gmail API backend to properly include email body
"""

backend_file = r'c:\Users\User\Desktop\Crypgo\django_backend\apps\email_backend.py'

with open(backend_file, 'r') as f:
    content = f.read()

# Replace the _create_message method to ensure body is always included
old_method = '''    def _create_message(self, email_message):
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
        return {'raw': raw}'''

new_method = '''    def _create_message(self, email_message):
        """Convert Django EmailMessage to Gmail API format"""
        if isinstance(email_message, MIMEMultipart):
            mime_msg = email_message
        else:
            mime_msg = MIMEMultipart('alternative')
            mime_msg['Subject'] = email_message.subject
            mime_msg['From'] = email_message.from_email
            mime_msg['To'] = ', '.join(email_message.to)

            # Add headers
            for key, value in email_message.extra_headers.items():
                mime_msg[key] = value

            # Always add the plain text body first
            if hasattr(email_message, 'body') and email_message.body:
                mime_msg.attach(MIMEText(email_message.body, 'plain'))
                logger.debug(f"Attached plain text body: {len(email_message.body)} chars")
            
            # Then add any alternatives (HTML version)
            if hasattr(email_message, 'alternatives') and email_message.alternatives:
                for content, mimetype in email_message.alternatives:
                    if mimetype == 'text/html':
                        mime_msg.attach(MIMEText(content, 'html'))
                        logger.debug(f"Attached HTML alternative: {len(content)} chars")

        raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
        return {'raw': raw}'''

if old_method in content:
    content = content.replace(old_method, new_method)
    print("✓ Updated _create_message to always include email body")
else:
    print("✗ Could not find old method to replace")

with open(backend_file, 'w') as f:
    f.write(content)

print("✅ Gmail backend email body fix applied!")
