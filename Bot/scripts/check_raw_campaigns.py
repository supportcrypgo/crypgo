import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['DJANGO_SETTINGS_MODULE'] = 'bot_project.settings'

import django
django.setup()

from django.db import connection
import sqlite3

print("=== RAW DATABASE INSPECTION ===\n")

# Method 1: Direct SQLite query
try:
    db_path = 'db.sqlite3'
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Get all campaigns from campaigns_campaign table
    cursor.execute('SELECT id, name, status, created_at FROM campaigns_campaign ORDER BY created_at DESC')
    campaigns = cursor.fetchall()
    
    print(f"Campaigns table records (total): {len(campaigns)}")
    if len(campaigns) == 0:
        print("  NO RECORDS FOUND IN campaigns_campaign TABLE")
    else:
        for c in campaigns:
            print(f"  - ID: {c[0] if c[0] is not None else 'NULL'}")
            print(f"    Name: {c[1] if c[1] is not None else 'NULL'}")
            print(f"    Status: {c[2] if c[2] is not None else 'NULL'}")
            print(f"    Created: {c[3]}")
            print()
    
    con.close()
except Exception as e:
    print(f"Error accessing campaigns table: {e}\n")

# Method 2: Django ORM QuerySet.count()
from apps.campaigns.models import Campaign
from django.utils import timezone

try:
    print("=== DJANGO ORM ===")
    print(f"Campaign.objects.count(): {Campaign.objects.count()}")
    print(f"Campaign.objects.all().count(): {Campaign.objects.all().count()}")
except Exception as e:
    print(f"Error with Django ORM: {e}")

print()
print("=== FINAL RESULT ===")
print("If campaigns table is empty AND Campaign.objects.count() is 0:")
print("  → NO existing campaigns found (including deleted)")