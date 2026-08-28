from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import hashlib
import hmac
import json
import requests


def send_magic_link_email(user, raw_token):
    """Send a plain-text password-change link through the configured SMTP backend."""
    link = f"{settings.FRONTEND_URL.rstrip('/')}/?magicToken={raw_token}"
    subject = 'Change your Crypgo password'
    message = render_to_string('emails/magic_link_password_change.txt', {
        'user': user,
        'magic_link': link,
        'expiry_hours': getattr(settings, 'MAGIC_LINK_EXPIRY_HOURS', 1),
    })
    try:
        send_mail(
            subject,
            message,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@crypgo.com'),
            [user.email],
            fail_silently=False,
        )
        return True
    except Exception:
        return False


def build_campaign_access_url(user, campaign_ref):
    from .models import CampaignAccessToken

    _, raw_token = CampaignAccessToken.generate_token(user, campaign_ref)
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/campaign-access?token={raw_token}"


def send_reset_password_email(user, reset_token):
    """
    Send password reset email to the user using SendGrid or console backend.

    Args:
        user: CustomUser instance
        reset_token: PasswordResetToken instance

    Returns:
        bool: True if email was sent successfully, False otherwise
    """

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token.token}"

    subject = "Reset Your Password - Crypgo"

    expiry_hours = getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRY_HOURS', 24)

    # Build the reset link with full URL
    context = {
        'user': user,
        'reset_link': reset_link,
        'expiry_hours': expiry_hours,
    }

    # Render HTML email template
    html_message = render_to_string('emails/reset_password.html', context)
    plain_message = strip_tags(html_message)

    from_email = f"{getattr(settings, 'EMAIL_FROM_NAME', 'Crypgo')} <{getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@crypgo.com')}>"

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message,
        )
        return True
    except Exception as e:
        print(f"Failed to send email to {user.email}: {str(e)}")
        return False