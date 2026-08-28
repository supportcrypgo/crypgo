import os
import django

# Add the parent directory to the path
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()

from apps.templates.models import EmailTemplate
from apps.campaigns.models import CampaignLead, Campaign
from apps.email_engine.models import EmailLog, Tracking, Bounce
from apps.unsubscribes.models import UnsubscribedLead
from apps.leads.models import BlacklistedLead
from apps.webhooks.models import WebhookLog

print("Deleting Email Bot history...")

# Delete from each model
Tracking.objects.all().delete()
EmailLog.objects.all().delete()
CampaignLead.objects.all().delete()
Campaign.objects.all().delete()
Bounce.objects.all().delete()
UnsubscribedLead.objects.all().delete()
BlacklistedLead.objects.all().delete()
WebhookLog.objects.all().delete()
EmailTemplate.objects.all().delete()

print("Email Bot history reset complete!")