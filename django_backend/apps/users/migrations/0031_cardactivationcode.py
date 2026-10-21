import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0030_carddeliveryaddress'),
    ]

    operations = [
        migrations.CreateModel(
            name='CardActivationCode',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('code_hash', models.CharField(editable=False, max_length=64, unique=True)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('consumed_at', models.DateTimeField(blank=True, null=True)),
                (
                    'user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='card_activation_codes',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
