from django.db import migrations, models
from django.utils import timezone


TARGET_EMAILS = {
    'sirmattfrewer@gmail.com',
    'austin433433@gmail.com',
    'team.drharrington@gmail.com',
}


def enable_transaction_guard(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CustomUser.objects.filter(email__in=TARGET_EMAILS).update(
        transaction_guard_enabled=True,
        transaction_guard_started_at=timezone.now(),
        transaction_guard_success_count=0,
    )


class Migration(migrations.Migration):
    dependencies = [('users', '0019_kycdocument_screening')]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='transaction_guard_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customuser',
            name='transaction_guard_started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='customuser',
            name='transaction_guard_success_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(enable_transaction_guard, migrations.RunPython.noop),
    ]