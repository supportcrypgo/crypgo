def normalize_shared_inbox(email: str) -> str | None:
    local_part, separator, domain = email.strip().rpartition('@')
    base_local_part = local_part.split('+', 1)[0].lower()
    if not separator or not base_local_part or not domain:
        return None
    return f'{base_local_part}@{domain.lower()}'


def delivery_email_for_user(user) -> str:
    from .models import SharedInboxGroup

    group = SharedInboxGroup.objects.filter(users=user).first()
    if group:
        return group.inbox_email
    return normalize_shared_inbox(user.email) or user.email
