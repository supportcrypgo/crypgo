#!/usr/bin/env python3
"""
Fix email sender name to show "Crypgo" instead of just email address.
"""

# Update the send_magic_link_email function to use formatted from_email
services_file = r'c:\Users\User\Desktop\Crypgo\django_backend\apps\users\services.py'

with open(services_file, 'r') as f:
    content = f.read()

old_send_mail_call = '''    try:
        send_mail(
            subject,
            message,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@crypgo.com'),
            [user.email],
            fail_silently=False,
        )
        return True
    except Exception:
        return False'''

new_send_mail_call = '''    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@crypgo.com')
        # Format sender name as "Crypgo <email@domain.com>"
        if '<' not in from_email:
            from_email = f'Crypgo <{from_email}>'
        
        send_mail(
            subject,
            message,
            from_email,
            [user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f'Failed to send magic link email: {str(e)}')
        return False'''

if old_send_mail_call in content:
    content = content.replace(old_send_mail_call, new_send_mail_call)
    print("✓ Updated send_magic_link_email to format sender name")

# Add logging import if not present
if 'import logging' not in content:
    content = content.replace('from django.conf import settings', 'import logging\nfrom django.conf import settings')
    if 'logger = logging.getLogger' not in content:
        content = content.replace('from django.conf import settings', 'from django.conf import settings\n\nlogger = logging.getLogger(__name__)')
    print("✓ Added logging import")

with open(services_file, 'w') as f:
    f.write(content)

print("✅ Email sender name fix applied!")
