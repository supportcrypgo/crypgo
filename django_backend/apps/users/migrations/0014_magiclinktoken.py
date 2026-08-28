from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0013_cleanup_email_migration_records'),
    ]

    operations = [
        migrations.CreateModel(
            name='MagicLinkToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token_hash', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='magic_link_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'magic_link_tokens',
                'ordering': ['-created_at'],
            },
        ),
    ]
