from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0006_remove_legacy_lead_relationships'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='source',
            field=models.CharField(default='crypgo_user', max_length=30),
        ),
    ]
