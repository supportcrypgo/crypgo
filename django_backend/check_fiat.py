import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fiat%' OR name LIKE '%balance%'")
for r in cursor.fetchall():
    print(r[0])