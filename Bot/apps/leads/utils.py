"""Lead-related utility helpers."""

import re
from email.utils import parseaddr


def extract_name_from_email(email):
    """Extract a friendly name from an email address.

    Falls back to "there" when the local-part does not look human-readable.
    """
    if not email:
        return "there"

    _, address = parseaddr(email)
    source = address or email
    if "@" not in source:
        return "there"

    local_part = source.split("@", 1)[0].strip()
    if not local_part:
        return "there"

    cleaned = re.split(r"[._+\-]+", local_part)
    friendly = " ".join(part for part in cleaned if part).strip()
    if not friendly:
        return "there"

    # Avoid greeting people with obviously synthetic tokens.
    if friendly.isdigit() or len(friendly) < 2:
        return "there"

    return friendly.title()


def build_greeting(first_name=None, email=None):
    """Return a safe, personalized greeting value."""
    if first_name and str(first_name).strip():
        return str(first_name).strip().title()

    return extract_name_from_email(email)
