import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '.')
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    print("Starting import...")
    call_command('import_people_contacts', '--apply', '--yes', stdout=sys.stdout)
    print("Import completed!")