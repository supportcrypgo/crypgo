from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_templates', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailtemplate',
            name='include_account_report_attachment',
            field=models.BooleanField(
                default=False,
                help_text='Attach the personalized account report PDF to emails sent with this template.',
            ),
        ),
    ]
