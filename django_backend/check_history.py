import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.db import connection
cursor = connection.cursor()

# Check if there's any script or management command for generating historical data
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%history%' OR name LIKE '%price%' OR name LIKE '%coin%' OR name LIKE '%ticker%'")
for r in cursor.fetchall():
    print(r[0])