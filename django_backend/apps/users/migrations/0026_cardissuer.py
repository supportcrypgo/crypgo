import secrets

from django.db import migrations, models
import apps.users.models


def backfill_card_issuer_numbers(apps, schema_editor):
    CustomUser = apps.get_model("users", "CustomUser")
    database = schema_editor.connection.alias
    existing_numbers = set(
        CustomUser.objects.using(database)
        .exclude(card_issuer_number__isnull=True)
        .values_list("card_issuer_number", flat=True)
    )
    pending_updates = []

    for user in (
        CustomUser.objects.using(database)
        .filter(card_issuer_number__isnull=True)
        .only("pk")
        .iterator()
    ):
        while True:
            candidate = f"0000{secrets.randbelow(10**12):012d}"
            if candidate not in existing_numbers:
                existing_numbers.add(candidate)
                user.card_issuer_number = candidate
                pending_updates.append(user)
                break

        if len(pending_updates) >= 500:
            CustomUser.objects.using(database).bulk_update(
                pending_updates, ["card_issuer_number"]
            )
            pending_updates.clear()

    if pending_updates:
        CustomUser.objects.using(database).bulk_update(
            pending_updates, ["card_issuer_number"]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0025_accountselectionchallenge_sharedinboxgroup_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="card_issuer_number",
            field=models.CharField(
                editable=False,
                help_text="Non-functional card issuer identifier; not a payment card number.",
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="customuser",
            name="card_issuer_issued_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.RunPython(
            backfill_card_issuer_numbers,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="customuser",
            name="card_issuer_number",
            field=models.CharField(
                default=apps.users.models.generate_card_issuer_number,
                editable=False,
                help_text="Non-functional card issuer identifier; not a payment card number.",
                max_length=16,
                unique=True,
            ),
        ),
    ]
