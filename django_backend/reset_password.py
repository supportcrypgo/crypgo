import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, 'c:\\Users\\User\\Desktop\\Crypgo\\django_backend')

django.setup()

from apps.users.models import CustomUser

# Get the admin user
try:
    user = CustomUser.objects.get(email='admin@crypgo.com')
    user.set_password('Password123!')
    user.save()
    print(f'Password reset for {user.email} (username: {user.username})')
except CustomUser.DoesNotExist:
    print('User admin@crypgo.com not found')

# Also check if there's a user with crypo.com (typo)
try:
    user = CustomUser.objects.get(email='admin@crypo.com')
    user.set_password('Password123!')
    user.save()
    print(f'Password reset for {user.email} (username: {user.username})')
except CustomUser.DoesNotExist:
    print('User admin@crypo.com not found')