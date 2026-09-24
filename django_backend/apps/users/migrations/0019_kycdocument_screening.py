from django.db import migrations, models
import django.db.models.deletion
import django.db.models.fields.json


class Migration(migrations.Migration):
    dependencies = [('users', '0018_walletaddress')]

    operations = [
        migrations.AddField(model_name='kycdocument', name='screening_status', field=models.CharField(default='manual_review', max_length=20)),
        migrations.AddField(model_name='kycdocument', name='screening_score', field=models.DecimalField(decimal_places=4, default=0, max_digits=5)),
        migrations.AddField(model_name='kycdocument', name='screening_reason', field=models.TextField(blank=True, null=True)),
        migrations.AddField(model_name='kycdocument', name='extracted_data', field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name='kycdocument', name='screened_at', field=models.DateTimeField(blank=True, null=True)),
    ]