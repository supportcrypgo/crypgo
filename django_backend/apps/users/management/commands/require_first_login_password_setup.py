from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        'Invalidate customer passwords and require email-verified password setup '
        'at the next sign-in.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Apply the reset. Without this flag, the command only reports the affected count.',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        users = User.objects.filter(
            is_staff=False,
            is_superuser=False,
        ).exclude(password_setup_required=True)
        user_count = users.count()

        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    f'Dry run: {user_count} customer account(s) would be reset. '
                    'No passwords were changed. Re-run with --confirm to apply.'
                )
            )
            return

        if user_count == 0:
            self.stdout.write('No customer accounts require password setup.')
            return

        with transaction.atomic():
            for user in users.iterator(chunk_size=500):
                user.set_unusable_password()
                user.password_setup_required = True
                user.save(update_fields=['password', 'password_setup_required'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Reset {user_count} customer account(s). Each account must verify its email '
                'and choose a new password at the next sign-in.'
            )
        )
