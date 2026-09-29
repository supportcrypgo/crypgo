from django.db import migrations, models


def copy_user_identity(apps, schema_editor):
    DeletionHistory = apps.get_model("users", "DeletionHistory")
    for record in DeletionHistory.objects.select_related("user").iterator():
        record.deleted_user_id = str(record.user_id)
        record.deleted_user_email = record.user.email
        record.deleted_by_email = ""
        record.save(update_fields=["deleted_user_id", "deleted_user_email", "deleted_by_email"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0023_deletionhistory"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="deletionhistory",
            name="idx_del_user",
        ),
        migrations.AddField(
            model_name="deletionhistory",
            name="deleted_user_id",
            field=models.CharField(max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="deletionhistory",
            name="deleted_user_email",
            field=models.EmailField(max_length=254, null=True),
        ),
        migrations.AddField(
            model_name="deletionhistory",
            name="deleted_by_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.RunPython(copy_user_identity, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="deletionhistory",
            name="deleted_by",
        ),
        migrations.RemoveField(
            model_name="deletionhistory",
            name="user",
        ),
        migrations.AlterField(
            model_name="deletionhistory",
            name="deleted_user_id",
            field=models.CharField(max_length=64),
        ),
        migrations.AlterField(
            model_name="deletionhistory",
            name="deleted_user_email",
            field=models.EmailField(max_length=254),
        ),
        migrations.AddIndex(
            model_name="deletionhistory",
            index=models.Index(fields=["deleted_user_id"], name="idx_del_user"),
        ),
    ]