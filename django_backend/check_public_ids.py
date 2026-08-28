#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import CustomUser

users = CustomUser.objects.all()
print(f'Total users: {users.count()}')
for u in users:
    print(f'  {u.email} -> public_id: {u.public_id}')