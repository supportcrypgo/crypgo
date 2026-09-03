"""
Management command to create or reset an admin user from environment variables.
Used during deployment to ensure admin access is available.
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create or reset admin user from environment variables'

    def handle(self, *args, **options):
        admin_username = os.getenv('ADMIN_USERNAME', 'admin')
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@crypgo.com')
        admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')

        # Check if user exists
        if User.objects.filter(username=admin_username).exists():
            user = User.objects.get(username=admin_username)
            user.email = admin_email
            user.set_password(admin_password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'✓ Admin user "{admin_username}" updated successfully')
            )
        else:
            # Create new admin user
            User.objects.create_superuser(
                username=admin_username,
                email=admin_email,
                password=admin_password
            )
            self.stdout.write(
                self.style.SUCCESS(f'✓ Admin user "{admin_username}" created successfully')
            )

        self.stdout.write(
            self.style.WARNING(
                f'Admin credentials: {admin_username} / {admin_password}\n'
                f'Access admin at: /admin/'
            )
        )
