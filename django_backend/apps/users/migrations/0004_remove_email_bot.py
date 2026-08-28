from django.db import migrations


EMAIL_TABLES = (
    'email_campaigns_campaignlead',
    'email_engine_tracking',
    'email_engine_click',
    'email_engine_emaillog',
    'email_engine_bounce',
    'email_campaigns_campaign',
    'email_templates_emailtemplate',
    'email_leads_lead',
    'email_leads_blacklistedlead',
    'email_unsubscribes_unsubscribedlead',
    'email_webhooks_webhooklog',
    'email_webhooks_webhook',
    'email_core_setting',
    'email_core_systemlog',
)

DROP_EMAIL_TABLES = '\n'.join(
    f'DROP TABLE IF EXISTS "{table}";' for table in EMAIL_TABLES
)

EMAIL_APP_LABELS = (
    'email_core',
    'email_leads',
    'email_templates',
    'email_campaigns',
    'email_engine',
    'email_unsubscribes',
    'email_webhooks',
    'email_api',
)


def remove_email_content_types(apps, schema_editor):
    content_type = apps.get_model('contenttypes', 'ContentType')
    content_type.objects.filter(app_label__in=EMAIL_APP_LABELS).delete()


def restore_email_content_types(apps, schema_editor):
    # This migration intentionally cannot restore deleted email applications.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0012_add_unique_public_id'),
    ]

    operations = [
        migrations.RunSQL(
            sql=DROP_EMAIL_TABLES,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(
            remove_email_content_types,
            restore_email_content_types,
        ),
    ]
