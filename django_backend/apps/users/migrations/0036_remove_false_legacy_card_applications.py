from django.db import migrations
from django.db.migrations.recorder import MigrationRecorder


def remove_false_legacy_card_applications(apps, schema_editor):
    CardIssuer = apps.get_model("users", "CardIssuer")
    CardApplication = apps.get_model("users", "CardApplication")
    CardApplicationNumber = apps.get_model("users", "CardApplicationNumber")
    CardDeliveryAddress = apps.get_model("users", "CardDeliveryAddress")
    CardActivationCode = apps.get_model("users", "CardActivationCode")
    database = schema_editor.connection.alias
    migration_applied_at = MigrationRecorder(schema_editor.connection).migration_qs.filter(
        app="users",
        name="0035_card_applications",
    ).values_list("applied", flat=True).first()
    if migration_applied_at is None:
        raise RuntimeError(
            "Cannot safely identify legacy card applications without the "
            "0035_card_applications migration timestamp."
        )

    for application in CardApplication.objects.using(database).filter(
        created_at__lte=migration_applied_at,
    ):
        number_record = CardApplicationNumber.objects.using(database).filter(
            application_id=application.pk,
        ).first()
        if number_record is not None and CardIssuer.objects.using(database).filter(
            user_id=application.user_id,
            card_issuer_number=number_record.number,
        ).exists():
            continue
        application.delete(using=database)

    issuer_user_ids = CardIssuer.objects.using(database).values("user_id")
    orphaned_user_ids = set(
        CardDeliveryAddress.objects.using(database)
        .filter(application__isnull=True)
        .exclude(user_id__in=issuer_user_ids)
        .values_list("user_id", flat=True)
    )
    orphaned_user_ids.update(
        CardActivationCode.objects.using(database)
        .filter(application__isnull=True, user_id__isnull=False)
        .exclude(user_id__in=issuer_user_ids)
        .values_list("user_id", flat=True)
    )
    CardDeliveryAddress.objects.using(database).filter(
        application__isnull=True,
        user_id__in=orphaned_user_ids,
    ).delete()
    CardActivationCode.objects.using(database).filter(
        application__isnull=True,
        user_id__in=orphaned_user_ids,
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0035_card_applications"),
    ]

    operations = [
        migrations.RunPython(
            remove_false_legacy_card_applications,
            migrations.RunPython.noop,
        ),
    ]
