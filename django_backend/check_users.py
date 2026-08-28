import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, 'c:\\Users\\User\\Desktop\\Crypgo\\django_backend')

django.setup()

from apps.users.models import CustomUser

users = CustomUser.objects.all()
for u in users:
    print(f'email={u.email}, is_staff={u.is_staff}, is_superuser={u.is_superuser}, username={u.username}')