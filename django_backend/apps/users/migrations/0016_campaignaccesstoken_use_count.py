from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0015_campaignaccesstoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignaccesstoken',
            name='use_count',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
