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
        # Use environment variables if available, otherwise use defaults
        # Note: env vars set in render.yaml are only available at runtime, 
        # not during build phase, so we need sensible defaults
        admin_username = os.getenv('ADMIN_USERNAME', 'admin')
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@crypgo.com')
        # During build, ADMIN_PASSWORD won't be set yet, use a temp default
        # In production, update via Render UI after seeing generated value
        admin_password = os.getenv('ADMIN_PASSWORD', 'ChangeMe123!')
        
        # If password is the temporary build default, warn user
        is_temp_password = admin_password == 'ChangeMe123!'

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

        # Show credentials
        credential_msg = f'Admin credentials: {admin_username} / {admin_password}\nAccess admin at: /admin/'
        if is_temp_password:
            self.stdout.write(
                self.style.WARNING(
                    f'{credential_msg}\n\n⚠️  NOTE: Using temporary password during build!\n'
                    f'After deployment, update password in Render Environment Variables:\n'
                    f'ADMIN_PASSWORD = (value shown in Render Dashboard)'
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS(credential_msg))
