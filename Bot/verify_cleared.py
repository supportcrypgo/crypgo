import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from apps.templates.models import EmailTemplate
from apps.campaigns.models import CampaignLead, Campaign
from apps.email_engine.models import EmailLog, Tracking, Bounce
from apps.unsubscribes.models import UnsubscribedLead
from apps.leads.models import BlacklistedLead
from apps.webhooks.models import WebhookLog

models_to_check = [
    ('Tracking', Tracking),
    ('EmailLog', EmailLog),
    ('CampaignLead', CampaignLead),
    ('Campaign', Campaign),
    ('Bounce', Bounce),
    ('UnsubscribedLead', UnsubscribedLead),
    ('BlacklistedLead', BlacklistedLead),
    ('WebhookLog', WebhookLog),
    ('EmailTemplate', EmailTemplate),
]

print("Verifying cleared models...")

all_cleared = True
for name, model in models_to_check:
    count = model.objects.all().count()
    status = "[OK] CLEARED" if count == 0 else "[X] NOT CLEARED"
    print(f"{name}: {count} records {status}")
    if count > 0:
        all_cleared = False

print("\nVerification complete!")
if all_cleared:
    print("All campaign history records have been successfully cleared.")