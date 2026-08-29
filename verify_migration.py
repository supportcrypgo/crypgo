#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Crypgo API verification
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, str(Path(__file__).resolve().parent / "django_backend"))
django.setup()

from django.db import connections

print("=== Crypgo API (crypgo schema) ===")
c = connections['default'].cursor()

c.execute('SELECT COUNT(*) FROM crypgo.users')
print(f'users: {c.fetchone()[0]} (expected: 259)')

c.execute('SELECT COUNT(*) FROM crypgo.wallet_assets')
print(f'wallet_assets: {c.fetchone()[0]} (expected: 2839)')

c.execute('SELECT COUNT(*) FROM crypgo.users_transaction')
print(f'users_transaction: {c.fetchone()[0]} (expected: 2580)')