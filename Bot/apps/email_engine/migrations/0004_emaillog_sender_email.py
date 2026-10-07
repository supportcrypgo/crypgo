from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('email_engine', '0003_alter_emaillog_campaign'),
    ]

    operations = [
        migrations.AddField(
            model_name='emaillog',
            name='sender_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
    ]
