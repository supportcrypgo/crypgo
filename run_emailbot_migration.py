#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Add the project root to the path
BASE_DIR = Path(__file__).resolve().parent / "Bot"
sys.path.insert(0, str(BASE_DIR))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')

import django
django.setup()

from django.db import connections, transaction
from django.apps import apps

def run_migration():
    batch_size = 1000
    dry_run = False
    
    print('Starting Email Bot SQLite to Supabase migration...')
    
    if not os.getenv('DATABASE_URL'):
        print('ERROR: DATABASE_URL not set - cannot connect to Supabase')
        return
    
    from django.db import connection
    print(f'Target database: {connection.settings_dict["NAME"]}')
    
    # Get all models, but skip Django's built-in ones
    all_models = apps.get_models()
    
    # Skip these Django built-in models (handled by migrations)
    skip_apps = {'admin', 'auth', 'contenttypes', 'sessions'}
    
    for model in all_models:
        if model._meta.auto_created:
            continue
        
        app_label = model._meta.app_label
        if app_label in skip_apps:
            print(f'Skipping {app_label}.{model._meta.model_name} (built-in)')
            continue
        
        model_name = model._meta.model_name
        table_name = model._meta.db_table
        
        print(f'Processing {app_label}.{model_name} ({table_name})...')
        
        try:
            # Count records in SQLite
            with connections['sqlite'].cursor() as cursor:
                cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
                count = cursor.fetchone()[0]
            
            if count == 0:
                print(f'  No records to migrate')
                continue
            
            print(f'  Found {count} records')
            
            if dry_run:
                print(f'  [DRY RUN] Would migrate {count} records')
                continue
            
            # Migrate in batches
            migrated = 0
            with connections['sqlite'].cursor() as src_cursor:
                src_cursor.execute(f'SELECT * FROM {table_name}')
                columns = [col[0] for col in src_cursor.description]
                
                while True:
                    rows = src_cursor.fetchmany(batch_size)
                    if not rows:
                        break
                    
                    # Insert into Supabase
                    placeholders = ', '.join(['%s'] * len(columns))
                    columns_str = ', '.join(columns)
                    insert_sql = f'INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
                    
                    with transaction.atomic():
                        with connection.cursor() as dst_cursor:
                            dst_cursor.executemany(insert_sql, rows)
                            migrated += len(rows)
                    
                    print(f'  Migrated {migrated}/{count} records...')
            
            print(f'  Completed: {migrated} records migrated')
        
        except Exception as e:
            print(f'  Error migrating {table_name}: {e}')
            if not dry_run:
                raise
    
    print('Migration complete!')

if __name__ == '__main__':
    run_migration()