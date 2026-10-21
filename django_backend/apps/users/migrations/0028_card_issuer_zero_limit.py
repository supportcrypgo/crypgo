import secrets

from django.db import migrations


def generate_card_issuer_number(existing_numbers):
    while True:
        prefix = ''.join(secrets.SystemRandom().sample('123456789', 4))
        remaining_groups = []
        for _ in range(3):
            while True:
                group = f'{secrets.randbelow(10**4):04d}'
                if group.count('0') <= 1:
                    remaining_groups.append(group)
                    break
        candidate = prefix + ''.join(remaining_groups)
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
        number = user.card_issuer_number
        groups = [number[index:index + 4] for index in range(0, 16, 4)]
        first_group_is_valid = (
            '0' not in groups[0] and len(set(groups[0])) == 4
        )
        zero_counts_are_valid = all(group.count('0') <= 1 for group in groups)
        if first_group_is_valid and zero_counts_are_valid:
            continue

        existing_numbers.remove(number)
        user.card_issuer_number = generate_card_issuer_number(existing_numbers)
        pending_updates.append(user)

        if len(pending_updates) >= 500:
            users.bulk_update(pending_updates, ['card_issuer_number'])
            pending_updates.clear()

    if pending_updates:
        users.bulk_update(pending_updates, ['card_issuer_number'])


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0027_card_issuer_number_format'),
    ]

    operations = [
        migrations.RunPython(
            update_card_issuer_numbers,
            migrations.RunPython.noop,
        ),
    ]
