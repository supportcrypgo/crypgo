import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from django.contrib.auth.models import User

print("Checking admin account...")
users = User.objects.filter(is_superuser=True)
print(f"Admin users found: {users.count()}")

if users.exists():
    for user in users:
        print(f"  - {user.username} (email: {user.email}, is_staff: {user.is_staff}, is_superuser: {user.is_superuser})")

print("\nAll registered users:")
all_users = User.objects.all()
for user in all_users:
    print(f"  - {user.username} (is_superuser: {user.is_superuser})")