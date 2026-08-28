import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.users.models import CustomUser

NEW_PASSWORD = 'Password123!'
users = CustomUser.objects.all()
count = 0

for user in users:
    user.set_password(NEW_PASSWORD)
    user.save(update_fields=['password'])
    count += 1

print(f'Updated {count} users to password: {NEW_PASSWORD}')
