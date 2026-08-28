import os
import sys
import django
from django.core.management.base import BaseCommand
from django.db import connections, transaction
from django.apps import apps

class Command(BaseCommand):
    help = 'Migrate data from SQLite to Supabase (PostgreSQL)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Batch size for bulk inserts (default: 1000)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without actually migrating'
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        dry_run = options['dry_run']

        self.stdout.write(self.style.NOTICE('Starting SQLite to Supabase migration...'))

        if not os.getenv('DATABASE_URL'):
            self.stdout.write(self.style.ERROR('DATABASE_URL not set - cannot connect to Supabase'))
            return

        # Ensure we're using the default database (which should be Supabase via DATABASE_URL)
        from django.db import connection
        self.stdout.write(f'Target database: {connection.settings_dict["NAME"]}')

        # Get all models
        all_models = apps.get_models()

        for model in all_models:
            if model._meta.auto_created:
                continue

            app_label = model._meta.app_label
            model_name = model._meta.model_name
            table_name = model._meta.db_table

            self.stdout.write(f'Processing {app_label}.{model_name} ({table_name})...')

            try:
                # Count records in SQLite
                with connections['sqlite'].cursor() as cursor:
                    cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
                    count = cursor.fetchone()[0]

                if count == 0:
                    self.stdout.write(f'  No records to migrate')
                    continue

                self.stdout.write(f'  Found {count} records')

                if dry_run:
                    self.stdout.write(f'  [DRY RUN] Would migrate {count} records')
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

                        self.stdout.write(f'  Migrated {migrated}/{count} records...')

                self.stdout.write(self.style.SUCCESS(f'  Completed: {migrated} records migrated'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error migrating {table_name}: {e}'))
                if not dry_run:
                    raise

        self.stdout.write(self.style.SUCCESS('Migration complete!'))