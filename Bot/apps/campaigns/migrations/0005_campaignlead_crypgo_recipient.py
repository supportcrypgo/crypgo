from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0004_remove_campaign_warmup_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='lead',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='campaign_leads',
                to='leads.lead',
            ),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='source',
            field=models.CharField(default='bot_lead', max_length=30),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='external_user_id',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='recipient_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='recipient_first_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='recipient_last_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='dashboard_url',
            field=models.URLField(blank=True, max_length=1000, null=True),
        ),
        migrations.AddConstraint(
            model_name='campaignlead',
            constraint=models.UniqueConstraint(
                condition=models.Q(external_user_id__isnull=False),
                fields=('campaign', 'external_user_id'),
                name='unique_crypgo_campaign_recipient',
            ),
        ),
    ]