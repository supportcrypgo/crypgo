from django.db import migrations
from django.utils import timezone


PRESERVED_EMAILS = {
    'sirmattfrewer@gmail.com',
    'austin433433@gmail.com',
    'team.drharrington@gmail.com',
    'debug@example.com',
}


def enable_imported_user_guard(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CustomUser.objects.exclude(email__in=PRESERVED_EMAILS).update(
        transaction_guard_enabled=True,
        transaction_guard_started_at=timezone.now(),
        transaction_guard_success_count=2,
    )


def preserve_existing_user_guard(apps, schema_editor):
    # The forward migration intentionally has no destructive reverse operation.
    pass


class Migration(migrations.Migration):
    dependencies = [('users', '0020_transaction_guard')]

    operations = [
        migrations.RunPython(enable_imported_user_guard, preserve_existing_user_guard),
    ]
