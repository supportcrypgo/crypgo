from django.db import migrations


def refuse_if_legacy_leads_exist(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    if Lead.objects.exists():
        raise RuntimeError(
            'Legacy Lead rows exist. Export or migrate them before applying the Crypgo-only cleanup.'
        )


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0005_campaignlead_crypgo_recipient'),
        ('leads', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(refuse_if_legacy_leads_exist, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='campaignlead',
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name='campaign',
            name='leads',
        ),
        migrations.RemoveField(
            model_name='campaignlead',
            name='lead',
        ),
    ]