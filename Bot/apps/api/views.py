from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, Q
from django.conf import settings
import hashlib
import hmac

from apps.leads.models import BlacklistedLead
from apps.templates.models import EmailTemplate
from apps.campaigns.models import Campaign, CampaignLead
from apps.email_engine.models import EmailLog, Bounce, Tracking
from apps.unsubscribes.models import UnsubscribedLead
from apps.webhooks.models import Webhook
from apps.email_engine.sender import EmailSender

from .serializers import (
    BlacklistedLeadSerializer,
    EmailTemplateSerializer, CampaignSerializer, CampaignStartSerializer,
    EmailLogSerializer, BounceSerializer, TrackingSerializer,
    UnsubscribedLeadSerializer, WebhookSerializer, DashboardStatsSerializer,
)


class BlacklistedLeadViewSet(viewsets.ModelViewSet):
    queryset = BlacklistedLead.objects.all()
    serializer_class = BlacklistedLeadSerializer
    search_fields = ['email', 'reason']


class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    search_fields = ['name', 'subject']
    filterset_fields = ['is_active']

    @action(detail=True, methods=['post'])
    def render(self, request, pk=None):
        template = self.get_object()
        context = request.data.get('context', {})
        rendered_html = template.render(context)
        return Response({'html': rendered_html})


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    search_fields = ['name', 'subject']
    filterset_fields = ['status', 'priority']
    ordering_fields = ['created_at', 'scheduled_at', 'priority']

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != 'draft':
            return Response({'error': 'Campaign can only be started from draft status'},
                            status=status.HTTP_400_BAD_REQUEST)
        campaign.status = 'running'
        campaign.save()
        return Response(CampaignSerializer(campaign).data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != 'running':
            return Response({'error': 'Only running campaigns can be paused'},
                            status=status.HTTP_400_BAD_REQUEST)
        campaign.status = 'paused'
        campaign.save()
        return Response(CampaignSerializer(campaign).data)

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != 'paused':
            return Response({'error': 'Only paused campaigns can be resumed'},
                            status=status.HTTP_400_BAD_REQUEST)
        campaign.status = 'running'
        campaign.save()
        return Response(CampaignSerializer(campaign).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Campaign.objects.count()
        by_status = Campaign.objects.values('status').annotate(count=Count('id'))
        return Response({
            'total': total,
            'by_status': {item['status']: item['count'] for item in by_status},
        })


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EmailLog.objects.select_related('campaign', 'lead').all()
    serializer_class = EmailLogSerializer
    filterset_fields = ['status', 'campaign']
    search_fields = ['recipient_email', 'subject']
    ordering_fields = ['sent_at']


class BounceViewSet(viewsets.ModelViewSet):
    queryset = Bounce.objects.all()
    serializer_class = BounceSerializer
    search_fields = ['email', 'reason']
    filterset_fields = ['bounce_type']


class TrackingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tracking.objects.select_related('email_log').all()
    serializer_class = TrackingSerializer
    filterset_fields = ['tracking_type']
    ordering_fields = ['tracked_at']


class UnsubscribedLeadViewSet(viewsets.ModelViewSet):
    queryset = UnsubscribedLead.objects.all()
    serializer_class = UnsubscribedLeadSerializer
    search_fields = ['email', 'reason']


class WebhookViewSet(viewsets.ModelViewSet):
    queryset = Webhook.objects.all()
    serializer_class = WebhookSerializer
    search_fields = ['name', 'url']
    filterset_fields = ['status', 'event']


class DashboardStatsView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DashboardStatsSerializer

    def get(self, request, *args, **kwargs):
        data = {
            'total_leads': CampaignLead.objects.filter(source='crypgo_user').count(),
            'total_campaigns': Campaign.objects.count(),
            'total_sent': EmailLog.objects.filter(status='sent').count(),
            'total_opened': EmailLog.objects.filter(status='opened').count(),
            'total_clicked': EmailLog.objects.filter(status='clicked').count(),
            'total_bounced': Bounce.objects.count(),
            'total_unsubscribed': UnsubscribedLead.objects.count(),
            'active_campaigns': Campaign.objects.filter(status='running').count(),
        }
        return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_magic_link(request):
    signature = request.headers.get('X-Crypgo-Signature', '')
    expected = hmac.new(
        settings.CRYPGO_SERVICE_KEY.encode('utf-8'), request.body, hashlib.sha256
    ).hexdigest()
    if not settings.CRYPGO_SERVICE_KEY or not hmac.compare_digest(signature, expected):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    email = request.data.get('email')
    magic_link = request.data.get('magic_link')
    if not isinstance(email, str) or not isinstance(magic_link, str):
        return Response(
            {'error': 'email and magic_link are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = EmailSender().send_with_tracking(
        recipient_email=email,
        subject=request.data.get('subject', 'Your Crypgo sign-in link'),
        html_body=(
            '<p>Use this link to sign in to Crypgo:</p>'
            f'<p><a href="{magic_link}">Sign in to Crypgo</a></p>'
        ),
        plain_text=f'Sign in to Crypgo: {magic_link}',
        track_links=False,
    )
    if not result or getattr(result, 'status', None) != 'sent':
        return Response({'error': 'Unable to send email'}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def sync_campaign_recipients(request, campaign_id):
    signature = request.headers.get('X-Crypgo-Signature', '')
    expected = hmac.new(
        settings.CRYPGO_SERVICE_KEY.encode('utf-8'), request.body, hashlib.sha256
    ).hexdigest()
    if not settings.CRYPGO_SERVICE_KEY or not hmac.compare_digest(signature, expected):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        campaign = Campaign.objects.get(pk=campaign_id)
    except Campaign.DoesNotExist:
        return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)

    recipients = request.data.get('recipients')
    if not isinstance(recipients, list):
        return Response({'error': 'recipients must be a list'}, status=status.HTTP_400_BAD_REQUEST)

    created = 0
    updated = 0
    for recipient in recipients:
        if not isinstance(recipient, dict):
            return Response({'error': 'Each recipient must be an object'}, status=status.HTTP_400_BAD_REQUEST)
        external_user_id = recipient.get('external_user_id')
        email = recipient.get('email')
        dashboard_url = recipient.get('dashboard_url')
        if not all(isinstance(value, str) and value for value in (external_user_id, email, dashboard_url)):
            return Response(
                {'error': 'Each recipient requires external_user_id, email, and dashboard_url'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        campaign_recipient, was_created = CampaignLead.objects.update_or_create(
            campaign=campaign,
            external_user_id=external_user_id,
            defaults={
                'source': 'crypgo_user',
                'recipient_email': email,
                'recipient_first_name': recipient.get('first_name', ''),
                'recipient_last_name': recipient.get('last_name', ''),
                'dashboard_url': dashboard_url,
                'status': 'pending',
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    Campaign.objects.filter(pk=campaign.pk).update(
        total_leads=CampaignLead.objects.filter(campaign=campaign).count()
    )
    return Response({'created': created, 'updated': updated, 'total': created + updated})