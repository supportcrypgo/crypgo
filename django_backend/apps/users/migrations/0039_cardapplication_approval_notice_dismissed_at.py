from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0038_cardapplication_canceled_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='cardapplication',
            name='approval_notice_dismissed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
