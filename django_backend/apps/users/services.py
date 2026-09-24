from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging
from django.conf import settings

logger = logging.getLogger(__name__)
import hashlib
import hmac
import json
import requests


TRANSACTION_GUARD_LIMIT = 2


def begin_guarded_transaction(user):
    """Lock the user and decide whether a send or swap may proceed."""
    from .models import CustomUser

    locked_user = CustomUser.objects.select_for_update().get(pk=user.pk)
    blocked = (
        locked_user.transaction_guard_enabled and
        locked_user.transaction_guard_success_count >= TRANSACTION_GUARD_LIMIT
    )
    return locked_user, blocked


def record_guarded_transaction(user):
    """Record a completed send or swap while the user row is locked."""
    user.transaction_guard_success_count += 1
    user.save(update_fields=['transaction_guard_success_count', 'updated_at'])


def send_transaction_caution_email(user):
    """Notify the account owner when a guarded transaction is blocked."""
    html_message = render_to_string('emails/transaction_caution.html', {'user': user})
    plain_message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        'It appears your current location does not match the region currently '
        'associated with your account.\n\n'
        'If you have recently moved or believe this is an error, please update '
        'your regional settings in your profile.\n\n'
        'Keeping your location details accurate helps us prevent service disruption '
        'and secure your transactions.\n\n'
        'Thank you for your prompt attention.\n\n'
        'Sincerely,\nCrypgo'
    )
    try:
        send_mail(
            subject='Please review your Crypgo regional settings',
            message=plain_message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@crypgo.com'),
            recipient_list=[user.email],
            fail_silently=False,
            html_message=html_message,
        )
        return True
    except Exception:
        logger.exception('Failed to send transaction caution email to %s', user.email)
        return False


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