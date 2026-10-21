import secrets

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.users.models


def generate_card_issuer_number(existing_numbers):
    while True:
        prefix = ''.join(secrets.SystemRandom().sample('123456789', 4))
        groups = []
        for _ in range(3):
            while True:
                group = f'{secrets.randbelow(10**4):04d}'
                if group.count('0') <= 1:
                    groups.append(group)
                    break
        candidate = prefix + ''.join(groups)
        if candidate not in existing_numbers:
            existing_numbers.add(candidate)
            return candidate


def move_issuer_data_to_records(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CardIssuer = apps.get_model('users', 'CardIssuer')
    database = schema_editor.connection.alias
    users = CustomUser.objects.using(database)
    existing_numbers = set(users.values_list('card_issuer_number', flat=True))
    records = []

    for user in users.only(
        'pk',
        'card_issuer_number',
        'card_issuer_issued_at',
    ).iterator():
        number = user.card_issuer_number
        if not number:
            number = generate_card_issuer_number(existing_numbers)
        records.append(CardIssuer(
            user_id=user.pk,
            card_issuer_number=number,
            issued_at=user.card_issuer_issued_at,
        ))
        if len(records) >= 500:
            CardIssuer.objects.using(database).bulk_create(records)
            records.clear()

    if records:
        CardIssuer.objects.using(database).bulk_create(records)


def restore_issuer_data_to_users(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CardIssuer = apps.get_model('users', 'CardIssuer')
    database = schema_editor.connection.alias

    for issuer in CardIssuer.objects.using(database).iterator():
        CustomUser.objects.using(database).filter(pk=issuer.user_id).update(
            card_issuer_number=issuer.card_issuer_number,
            card_issuer_issued_at=issuer.issued_at,
        )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0028_card_issuer_zero_limit'),
    ]

    operations = [
        migrations.CreateModel(
            name='CardIssuer',
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
                (
                    'card_issuer_number',
                    models.CharField(
                        default=apps.users.models.generate_card_issuer_number,
                        editable=False,
                        help_text='Non-functional card issuer identifier; not a payment card number.',
                        max_length=16,
                        unique=True,
                    ),
                ),
                (
                    'issued_at',
                    models.DateTimeField(blank=True, editable=False, null=True),
                ),
                (
                    'user',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='card_issuer',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(
            move_issuer_data_to_records,
            restore_issuer_data_to_users,
        ),
        migrations.RemoveField(
            model_name='customuser',
            name='card_issuer_number',
        ),
        migrations.RemoveField(
            model_name='customuser',
            name='card_issuer_issued_at',
        ),
    ]
