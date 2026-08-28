from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0014_magiclinktoken'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampaignAccessToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('campaign_ref', models.CharField(max_length=100)),
                ('token_hash', models.CharField(db_index=True, max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='campaign_access_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'campaign_access_tokens',
                'ordering': ['-created_at'],
            },
        ),
    ]
