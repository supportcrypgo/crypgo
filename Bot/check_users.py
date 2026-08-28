import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
users = User.objects.all()
print('Total users:', users.count())
for u in users:
    print(f'  Email: {u.email}, is_staff: {u.is_staff}, is_superuser: {u.is_superuser}, username: {u.username}')