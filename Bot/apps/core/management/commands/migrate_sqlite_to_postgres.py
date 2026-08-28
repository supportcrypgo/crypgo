import os
import tempfile
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core import management
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


class Command(BaseCommand):
    help = 'Copy this project data from SQLite into the configured PostgreSQL database.'

    def add_arguments(self, parser):
        parser.add_argument('--source-path', type=Path, default=Path(settings.BASE_DIR) / 'db.sqlite3')
        parser.add_argument('--allow-nonempty', action='store_true')

    def handle(self, *args, **options):
        source_path = options['source_path'].resolve()
        if not source_path.exists():
            raise CommandError(f'Source SQLite database not found: {source_path}')
        if not os.getenv('DATABASE_URL'):
            raise CommandError('DATABASE_URL must point to the PostgreSQL target database.')

        connections.databases['sqlite']['NAME'] = str(source_path)
        connections['sqlite'].close()
        models = [model for model in apps.get_models() if not model._meta.auto_created]
        source_counts = {model._meta.label: model.objects.using('sqlite').count() for model in models}
        target_counts = {model._meta.label: model.objects.using('default').count() for model in models}
        if any(target_counts.values()) and not options['allow_nonempty']:
            raise CommandError('Target database is not empty; use --allow-nonempty only after review.')

        with tempfile.NamedTemporaryFile(prefix='crypgo-migration-', suffix='.json', delete=False) as fixture:
            fixture_path = Path(fixture.name)
        try:
            management.call_command(
                'dumpdata', database='sqlite', natural_foreign=True,
                natural_primary=True, exclude=['contenttypes', 'auth.permission', 'sessions'],
                indent=2, output=str(fixture_path), verbosity=0,
            )
            management.call_command('loaddata', str(fixture_path), database='default', verbosity=1)
        finally:
            fixture_path.unlink(missing_ok=True)

        for label, source_count in source_counts.items():
            target_count = apps.get_model(label).objects.using('default').count()
            if source_count != target_count:
                raise CommandError(f'Count mismatch for {label}: source={source_count}, target={target_count}')
            if source_count:
                self.stdout.write(f'{label}: {source_count}')
        self.stdout.write(self.style.SUCCESS('SQLite data loaded into PostgreSQL.'))
