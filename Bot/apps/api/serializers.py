from rest_framework import serializers
from apps.leads.models import BlacklistedLead
from apps.templates.models import EmailTemplate
from apps.campaigns.models import Campaign
from apps.email_engine.models import EmailLog, Bounce, Tracking
from apps.unsubscribes.models import UnsubscribedLead
from apps.webhooks.models import Webhook


class BlacklistedLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlacklistedLead
        fields = '__all__'


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class CampaignSerializer(serializers.ModelSerializer):
    open_rate = serializers.ReadOnlyField()
    click_rate = serializers.ReadOnlyField()
    bounce_rate = serializers.ReadOnlyField()

    class Meta:
        model = Campaign
        fields = '__all__'
        read_only_fields = ['total_leads', 'sent_count', 'opened_count', 'clicked_count',
                           'bounced_count', 'failed_count', 'started_at', 'completed_at',
                           'created_at', 'updated_at']


class CampaignStartSerializer(serializers.Serializer):
    campaign_id = serializers.IntegerField()


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = '__all__'
        read_only_fields = ['tracking_id', 'sent_at', 'created_at']


class BounceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bounce
        fields = '__all__'


class TrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tracking
        fields = '__all__'


class UnsubscribedLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnsubscribedLead
        fields = '__all__'
        read_only_fields = ['unsubscribed_at', 'created_at']


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = '__all__'
        read_only_fields = ['retry_count', 'last_triggered_at', 'created_at', 'updated_at']


class DashboardStatsSerializer(serializers.Serializer):
    total_leads = serializers.IntegerField()
    total_campaigns = serializers.IntegerField()
    total_sent = serializers.IntegerField()
    total_opened = serializers.IntegerField()
    total_clicked = serializers.IntegerField()
    total_bounced = serializers.IntegerField()
    total_unsubscribed = serializers.IntegerField()
    active_campaigns = serializers.IntegerField()