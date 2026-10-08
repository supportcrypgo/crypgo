from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0008_campaignrun'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignlead',
            name='recipient_account_emails',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='campaignlead',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('queued', 'Queued'),
                    ('sent', 'Sent'),
                    ('duplicate', 'Duplicate inbox'),
                    ('opened', 'Opened'),
                    ('clicked', 'Clicked'),
                    ('failed', 'Failed'),
                    ('bounced', 'Bounced'),
                    ('unsubscribed', 'Unsubscribed'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
