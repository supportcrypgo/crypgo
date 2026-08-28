import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from django.contrib.auth import get_user_model, authenticate

User = get_user_model()

ADMIN_EMAIL = 'admin@crypgo.com'
ADMIN_PASSWORD = 'Password123!'

try:
	user = User.objects.get(email__iexact=ADMIN_EMAIL)
except User.DoesNotExist:
	user = User.objects.create_user(
		username=ADMIN_EMAIL,
		email=ADMIN_EMAIL,
		password=ADMIN_PASSWORD,
	)

user.email = ADMIN_EMAIL
user.is_active = True
user.is_staff = True
user.is_superuser = True
user.set_password(ADMIN_PASSWORD)
user.save()

if authenticate(username=ADMIN_EMAIL, password=ADMIN_PASSWORD) is None:
	raise RuntimeError(f'Authentication failed after resetting {ADMIN_EMAIL}')

print(f'Password reset and authentication verified for user: {user.email}')