from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0021_imported_users_transaction_guard'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='customuser',
            name='public_id',
        ),
        migrations.RemoveField(
            model_name='customuser',
            name='phone',
        ),
        migrations.AlterModelManagers(
            name='customuser',
            managers=[],
        ),
    ]