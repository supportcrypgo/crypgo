import re


def is_gmail_sender_limit_error(error):
    """Return whether Gmail explicitly rejected the sender for quota or rate limits."""
    message = re.sub(r'[\s-]+', ' ', str(error).lower())
    markers = (
        'daily user sending limit exceeded',
        'daily sending quota exceeded',
        'sending quota exceeded',
        'you have reached a limit for sending mail',
        'user-rate limit exceeded',
        'user rate limit exceeded',
        'dailylimitexceeded',
        'userratelimitexceeded',
        'sending limit exceeded',
        'too many messages sent',
        'you are sending mail too quickly',
        'unusual rate of unsolicited mail',
        '421 4.7.0',
        '4.7.0 try again later',
        '550 5.4.5',
        '5.4.5 daily',
    )
    return any(marker in message for marker in markers)


def is_ambiguous_gmail_block_error(error):
    """Identify generic Gmail block wording that needs repeated-failure evidence."""
    message = str(error).lower()
    return 'message blocked' in message or 'has been blocked' in message
