import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from django.contrib.auth import get_user_model, authenticate
from django.test import Client

User = get_user_model()
ADMIN_EMAIL = 'admin@crypgo.com'
ADMIN_PASSWORD = 'Password123!'

# Test authentication
user = authenticate(username=ADMIN_EMAIL, password=ADMIN_PASSWORD)

if user is None:
    raise RuntimeError('Authentication failed')

print(f'Authentication successful for: {user.email}')
print(f'is_active: {user.is_active}')
print(f'is_staff: {user.is_staff}')
print(f'is_superuser: {user.is_superuser}')

client = Client()
login_page = client.get('/admin/login/?next=/admin/')
if login_page.status_code != 200:
    raise RuntimeError(f'Admin login page returned HTTP {login_page.status_code}')
if b'type="submit"' not in login_page.content:
    raise RuntimeError('Admin login page does not contain a submit control')

if not client.login(username=ADMIN_EMAIL, password=ADMIN_PASSWORD):
    raise RuntimeError('Django test client login failed')

admin_page = client.get('/admin/')
if admin_page.status_code != 200:
    raise RuntimeError(f'Authenticated admin page returned HTTP {admin_page.status_code}')

print('Admin login page and authenticated dashboard verified')

# Also check the user still exists
user_obj = User.objects.get(email=ADMIN_EMAIL)
print(f'User exists: {user_obj.email}')