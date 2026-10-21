from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0040_customuser_identity_details_verified'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='display_currency',
            field=models.CharField(default='USD', max_length=3),
        ),
    ]
