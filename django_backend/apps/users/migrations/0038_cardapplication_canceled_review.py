from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0037_cardapplication_cancellation_due_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='cardapplication',
            name='approval_email_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='cardapplication',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('activation_pending', 'Activation pending'),
                    ('approved', 'Approved'),
                    ('canceled', 'Canceled'),
                ],
                default='draft',
                max_length=32,
            ),
        ),
    ]
