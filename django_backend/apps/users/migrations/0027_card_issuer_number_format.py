import secrets

from django.db import migrations


def generate_card_issuer_number(existing_numbers):
    while True:
        prefix = ''.join(secrets.SystemRandom().sample('123456789', 4))
        candidate = f'{prefix}{secrets.randbelow(10**12):012d}'
        if candidate not in existing_numbers:
            existing_numbers.add(candidate)
            return candidate


def update_card_issuer_numbers(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    database = schema_editor.connection.alias
    users = CustomUser.objects.using(database)
    existing_numbers = set(users.values_list('card_issuer_number', flat=True))
    pending_updates = []

    for user in users.only('pk', 'card_issuer_number').iterator():
        first_four_digits = user.card_issuer_number[:4]
        if '0' not in first_four_digits and len(set(first_four_digits)) == 4:
            continue

        existing_numbers.remove(user.card_issuer_number)
        user.card_issuer_number = generate_card_issuer_number(existing_numbers)
        pending_updates.append(user)

        if len(pending_updates) >= 500:
            users.bulk_update(pending_updates, ['card_issuer_number'])
            pending_updates.clear()

    if pending_updates:
        users.bulk_update(pending_updates, ['card_issuer_number'])


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0026_cardissuer'),
    ]

    operations = [
        migrations.RunPython(
            update_card_issuer_numbers,
            migrations.RunPython.noop,
        ),
    ]
