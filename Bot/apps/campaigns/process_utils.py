import os
import sys
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def get_campaign_python_executable():
    configured_executable = getattr(settings, 'CAMPAIGN_PYTHON_EXECUTABLE', '').strip()
    if configured_executable:
        return configured_executable

    virtualenv_executable = Path(sys.prefix) / 'bin' / 'python'
    if virtualenv_executable.is_file() and os.access(virtualenv_executable, os.X_OK):
        return str(virtualenv_executable)

    executable_name = Path(sys.executable).name.lower()
    if 'uwsgi' in executable_name or 'gunicorn' in executable_name:
        raise ImproperlyConfigured(
            'Set CAMPAIGN_PYTHON_EXECUTABLE to the Bot virtualenv Python executable.'
        )

    return sys.executable