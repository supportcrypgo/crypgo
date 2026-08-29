#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Email Bot verification
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
sys.path.insert(0, str(Path(__file__).resolve().parent / "Bot"))
django.setup()

from django.db import connections

print("=== Email Bot (emailbot schema) ===")
c = connections['default'].cursor()

# Check the main tables that had data
c.execute('SELECT COUNT(*) FROM emailbot.app_templates_emailtemplate')
print(f'emailtemplate: {c.fetchone()[0]} (expected: 1)')

c.execute('SELECT COUNT(*) FROM emailbot.campaigns_campaign')
print(f'campaign: {c.fetchone()[0]} (expected: 1)')

c.execute('SELECT COUNT(*) FROM emailbot.campaigns_campaignlead')
print(f'campaignlead: {c.fetchone()[0]} (expected: 1)')

c.execute('SELECT COUNT(*) FROM emailbot.email_engine_emaillog')
print(f'emaillog: {c.fetchone()[0]} (expected: 18)')

c.execute('SELECT COUNT(*) FROM emailbot.email_engine_tracking')
print(f'tracking: {c.fetchone()[0]} (expected: 5)')