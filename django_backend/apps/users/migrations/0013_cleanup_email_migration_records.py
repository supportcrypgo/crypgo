from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0004_remove_email_bot'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DELETE FROM django_migrations "
                "WHERE app IN ("
                "'email_core', 'email_leads', 'email_templates', "
                "'email_campaigns', 'email_engine', 'email_unsubscribes', "
                "'email_webhooks', 'email_api'"
                ");"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
