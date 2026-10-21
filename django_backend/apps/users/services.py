from django.core.mail import send_mail
from django.template.loader import render_to_string
import logging
from .email_identity import delivery_email_for_user
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
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'support.crypgo@gmail.com',
            recipient_list=[delivery_email_for_user(user)],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Failed to send transaction caution email to %s', user.email)
        return False


def send_card_application_cancellation_email(user):
    """Notify a user that their Crypgo Classic application was not approved."""
    first_name = user.first_name.strip() or user.username.strip() or 'there'
    message = (
        f'Dear {first_name},\n'
        'Thank you for your recent application for the Crypgo Classic®.\n\n'
        'We are writing to inform you that we are unable to approve your card request or issue your card at this time, and your application has been canceled.\n'
        'Reason for Decision:\n'
        'Based on a review of your application, you do not currently meet our eligibility requirements. The decision was influenced by the following factor(s):\n\n'
        '- Inability to verify your identity information\n\n'
        'If you believe there was a typo or error in the information provided during your profile verification (such as your address, or date of birth), or if you would like to submit updated documentation, please log in to your account dashboard or contact our customer support team.\n\n'
        'We appreciate your interest in Crypgo Classic.\n'
        'Sincerely,\n'
        'Crypgo'
    )
    try:
        sent_count = send_mail(
            subject='Update regarding your Crypgo Card Application',
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[delivery_email_for_user(user)],
            fail_silently=False,
        )
        if sent_count != 1:
            logger.error(
                'Card application cancellation email was not accepted for user %s',
                user.pk,
            )
            return False
        return True
    except Exception:
        logger.exception(
            'Failed to send card application cancellation email for user %s',
            user.pk,
        )
        return False


def send_card_application_approval_email(application):
    """Notify the user that their Crypgo Classic card request was approved."""
    user = application.user
    first_name = user.first_name.strip() or user.username.strip() or 'there'
    message = (
        f'Dear {first_name},\n\n'
        'We are pleased to inform you that your request for the Crypgo Classic® '
        'has been successfully approved!\n\n'
        'Application Details:\n\n'
        f'- Card Number: {application.card_number or "Unavailable"}\n'
        '- Card Type: Classic®\n'
        '- Status: Out for delivery\n\n'
        'What Happens Next?\n\n'
        'You will receive an email once it has arrived at your registered '
        'delivery address.\n\n'
        'Activating Your Card\n\n'
        'Once your card arrives, you will need to activate it before use. To do '
        'so, visit the nearest ATM and follow the on-screen instructions using '
        'your secure PIN.\n\n'
        'Managing Your Card\n\n'
        'Through your account dashboard, you can:\n\n'
        '- View your card details and balance\n'
        '- Track your spending and transaction history\n'
        '- Freeze or unfreeze your card instantly if needed\n\n'
        'Need Help?\n'
        'If you have any questions about your card or your account, our support '
        'team is here to assist you. Simply reach out through the Help section '
        'of your dashboard or contact us at support@crypgo.us.ci.\n\n'
        'Stay Secure\n\n'
        'For your protection, never share your card details, PIN, or account '
        'credentials with anyone. Crypgo will never ask you for this information '
        'via email or phone.\n\n'
        "We're glad to have you with us and look forward to serving you.\n\n"
        'Sincerely,\n'
        'Crypgo'
    )
    try:
        sent_count = send_mail(
            subject='Your Card Request Has Been Approved',
            message=message,
            from_email='info@crypgo.us.ci',
            recipient_list=[delivery_email_for_user(user)],
            fail_silently=False,
        )
        if sent_count != 1:
            logger.error(
                'Card application approval email was not accepted for user %s',
                user.pk,
            )
            return False
        return True
    except Exception:
        logger.exception(
            'Failed to send card application approval email for user %s',
            user.pk,
        )
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
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'support.crypgo@gmail.com'
        # Format sender name as "Crypgo <email@domain.com>"
        if '<' not in from_email:
            from_email = f'Crypgo <{from_email}>'
        
        send_mail(
            subject,
            message,
            from_email,
            [delivery_email_for_user(user)],
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

    plain_message = (
        f"Hi {user.get_full_name() or user.username},\n\n"
        'We received a request to reset your password for your Crypgo account. '
        'Use the link below to set a new password:\n\n'
        f'{reset_link}\n\n'
        f'This link will expire in {expiry_hours} hours.\n\n'
        'If you did not request a password reset, please ignore this email.\n\n'
        'Best regards,\nThe Crypgo Team'
    )

    from_email = 'Crypgo <support.crypgo@gmail.com>'

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[delivery_email_for_user(user)],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Failed to send email to {user.email}: {str(e)}")
        return False