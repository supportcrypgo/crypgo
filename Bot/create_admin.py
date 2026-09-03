#!/usr/bin/env python
"""
Create admin user if it doesn't exist.
This runs AFTER migrations during app startup when DB connection is guaranteed.
Executes before Gunicorn starts in the startCommand.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from django.contrib.auth.models import User


def create_admin():
    """Create superuser from environment variables if it doesn't exist."""
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@crypgo.com')
    admin_password = os.getenv('ADMIN_PASSWORD', 'ChangeMe123!')
    
    # Check if user already exists
    if User.objects.filter(username=admin_username).exists():
        print(f'✓ Admin user "{admin_username}" already exists')
        user = User.objects.get(username=admin_username)
        # Update password and staff status in case they changed
        user.email = admin_email
        user.set_password(admin_password)
        user.is_staff = True
        user.is_superuser = True
        user.save()
        print(f'✓ Admin user credentials updated')
        return
    
    # Create new superuser
    User.objects.create_superuser(
        username=admin_username,
        email=admin_email,
        password=admin_password
    )
    print(f'✓ Admin user "{admin_username}" created successfully')
    print(f'  Credentials: {admin_username} / {admin_password}')
    print(f'  Access admin at: /admin/')


if __name__ == '__main__':
    try:
        create_admin()
    except Exception as e:
        print(f'❌ Error creating admin user: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
