import logging
import hashlib
import hmac
import json
import os
import subprocess
import sys

from django.contrib import admin
from django.conf import settings
from django.contrib import messages
from django.db import transaction
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from .models import Campaign, CampaignLead
import requests

logger = logging.getLogger(__name__)


@admin.register(Campaign)
class CampaignAdmin(ModelAdmin):
    change_form_template = 'admin/campaigns/campaign_change_form.html'
    list_display = [
        'name',
        'status_badge',
        'progress_bar',
        'priority',
        'sent_count',
        'total_leads',
        'last_run_at',
        'scheduled_at',
        'is_archived',
    ]
    list_filter = ['status', 'priority', 'is_archived', 'created_at']
    search_fields = ['name', 'subject']
    readonly_fields = ['total_leads', 'sent_count', 'opened_count', 'clicked_count',
                       'bounced_count', 'failed_count', 'started_at', 'completed_at',
                       'created_at', 'updated_at']
    list_per_page = 25

    fieldsets = (
        ('Campaign Info', {
            'fields': ('name', 'subject', 'template', 'status', 'priority', 'is_archived'),
        }),
        ('Crypgo audience', {
            'fields': (),
            'description': 'Recipients are synchronized from the current active Crypgo users before sending.',
        }),
        ('Scheduling', {
            'fields': ('scheduled_at', 'started_at', 'completed_at'),
        }),
        ('Stats', {
            'fields': ('total_leads', 'sent_count', 'opened_count', 'clicked_count',
                       'bounced_count', 'failed_count'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    actions = ['sync_crypgo_users', 'send_campaign_now', 'start_campaign', 'pause_campaign', 'resume_campaign', 'archive_campaigns']

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:campaign_id>/send-now/',
                self.admin_site.admin_view(self.send_campaign_view),
                name='campaigns_campaign_send_now',
            ),
        ]
        return custom_urls + urls

    def status_badge(self, obj):
        colors = {
            'draft': '#6B7280',
            'scheduled': '#F59E0B',
            'running': '#22C55E',
            'completed': '#2563EB',
            'paused': '#EF4444',
            'cancelled': '#9CA3AF',
        }
        color = colors.get(obj.status, '#6B7280')
        return format_html(
            '<span style="background:{};color:#fff;padding:3px 8px;border-radius:999px;font-size:11px;">{}</span>',
            color,
            obj.get_status_display().upper(),
        )
    status_badge.short_description = 'Status'

    def progress_bar(self, obj):
        if not obj.total_leads:
            return '0%'
        percentage = min(100, int((obj.sent_count / obj.total_leads) * 100))
        return format_html(
            '<div style="background:#E5E7EB;border-radius:999px;width:120px;height:16px;overflow:hidden;">'
            '<div style="background:#22C55E;width:{}%;height:100%;color:#fff;font-size:10px;line-height:16px;text-align:center;">{}%</div>'
            '</div>',
            percentage,
            percentage,
        )
    progress_bar.short_description = 'Progress'

    def last_run_at(self, obj):
        return obj.completed_at or obj.started_at or obj.created_at
    last_run_at.admin_order_field = 'completed_at'
    last_run_at.short_description = 'Last Run'

    def _queue_campaign_send(self, campaign, request=None):
        """Normalize campaign state and launch the existing send command in the background."""
        if campaign.status == 'completed':
            return False, f"Campaign '{campaign.name}' is already completed."

        if campaign.is_archived:
            return False, f"Campaign '{campaign.name}' is archived."

        synced, sync_message = self._sync_crypgo_users(campaign)
        if not synced:
            return False, sync_message

        if campaign.status == 'draft':
            campaign.started_at = campaign.started_at or timezone.now()

        campaign.status = 'running'
        campaign.is_paused = False
        campaign.save(update_fields=['status', 'is_paused', 'started_at', 'updated_at'])

        manage_py = os.path.normpath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'manage.py')
        )
        proc = subprocess.Popen(
            [sys.executable, manage_py, 'send_campaign', f'--campaign-id={campaign.pk}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            close_fds=True,
        )
        # Read and log the output so it shows up in Render/cloud logs
        try:
            output = proc.communicate(timeout=30)
            # communicate() returns (stdout_bytes, stderr_bytes) or empty if PIPE not used
            if output and len(output) >= 1:
                stdout_bytes = output[0]
                if stdout_bytes:
                    logger.info("Subprocess output for campaign %s:\n%s", campaign.pk, stdout_bytes.decode('utf-8', errors='replace'))
        except subprocess.TimeoutExpired:
            logger.warning("Subprocess for campaign %s still running (expected for long sends).", campaign.pk)
            # Don't kill it; let it run in background
        return True, f"Campaign '{campaign.name}' started sending in the background."

    def _sync_crypgo_users(self, campaign):
        if not settings.CRYPGO_SERVICE_KEY:
            return False, 'Crypgo sync is not configured: CRYPGO_SERVICE_KEY is missing.'

        body = b'{}'
        signature = hmac.new(
            settings.CRYPGO_SERVICE_KEY.encode('utf-8'), body, hashlib.sha256
        ).hexdigest()
        try:
            response = requests.post(
                f"{settings.CRYPGO_API_URL.rstrip('/')}/api/internal/campaigns/{campaign.pk}/recipients/export/",
                data=body,
                headers={
                    'Content-Type': 'application/json',
                    'X-Bot-Signature': signature,
                },
                timeout=15,
            )
            response.raise_for_status()
            recipients = response.json().get('recipients', [])
            if not isinstance(recipients, list):
                return False, 'Crypgo sync returned an invalid recipient list.'

            with transaction.atomic():
                for recipient in recipients:
                    required = ('external_user_id', 'email', 'dashboard_url')
                    if not all(isinstance(recipient.get(field), str) and recipient.get(field) for field in required):
                        return False, 'Crypgo sync returned an incomplete recipient record.'
                    campaign_lead, created = CampaignLead.objects.update_or_create(
                        campaign=campaign,
                        external_user_id=recipient['external_user_id'],
                        defaults={
                            'source': 'crypgo_user',
                            'recipient_email': recipient['email'],
                            'recipient_first_name': recipient.get('first_name', ''),
                            'recipient_last_name': recipient.get('last_name', ''),
                            'dashboard_url': recipient['dashboard_url'],
                        },
                    )
                    if created:
                        campaign_lead.status = 'pending'
                        campaign_lead.save(update_fields=['status', 'updated_at'])
            campaign.total_leads = CampaignLead.objects.filter(campaign=campaign).count()
            campaign.save(update_fields=['total_leads', 'updated_at'])
            if not recipients:
                return False, f'Crypgo returned no active users for campaign "{campaign.name}".'
            return True, f'Synchronized {len(recipients)} Crypgo users.'
        except (requests.RequestException, KeyError, TypeError, ValueError) as error:
            logger.exception('Crypgo recipient sync failed for campaign %s', campaign.pk)
            return False, f'Crypgo sync failed: {error}'

    def send_campaign_now(self, request, queryset):
        started = 0
        skipped = 0
        for campaign in queryset:
            ok, message = self._queue_campaign_send(campaign, request=request)
            if ok:
                started += 1
            else:
                skipped += 1
            self.message_user(
                request,
                message,
                messages.SUCCESS if ok else messages.WARNING,
            )
        if started:
            self.message_user(request, f"Queued {started} campaign(s) for sending.", messages.SUCCESS)
        if skipped and not started:
            self.message_user(request, f"Skipped {skipped} campaign(s).", messages.WARNING)
    send_campaign_now.short_description = "Send selected campaigns now"

    def sync_crypgo_users(self, request, queryset):
        for campaign in queryset:
            synced, message = self._sync_crypgo_users(campaign)
            self.message_user(
                request,
                f'{message} for "{campaign.name}".',
                messages.SUCCESS if synced else messages.ERROR,
            )
    sync_crypgo_users.short_description = "Sync current Crypgo users"

    def start_campaign(self, request, queryset):
        queryset.filter(status='draft').update(status='running')
    start_campaign.short_description = "Start selected campaigns"

    def pause_campaign(self, request, queryset):
        queryset.filter(status='running').update(status='paused')
    pause_campaign.short_description = "Pause selected campaigns"

    def resume_campaign(self, request, queryset):
        queryset.filter(status='paused').update(status='running')
    resume_campaign.short_description = "Resume selected campaigns"

    def archive_campaigns(self, request, queryset):
        count = queryset.update(is_archived=True)
        self.message_user(request, f"{count} campaigns archived.")
    archive_campaigns.short_description = "Archive selected campaigns"

    def send_campaign_view(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        ok, message = self._queue_campaign_send(campaign, request=request)
        self.message_user(
            request,
            message,
            messages.SUCCESS if ok else messages.WARNING,
        )
        return HttpResponseRedirect(
            request.META.get('HTTP_REFERER')
            or reverse('admin:campaigns_campaign_change', args=[campaign.pk])
        )

    def delete_model(self, request, obj):
        logger.info(
            "Campaign deleted by %s: ID=%s, Name=%s, Status=%s",
            request.user.username if request.user.is_authenticated else "anonymous",
            obj.id,
            obj.name,
            obj.status,
        )
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            logger.info(
                "Campaign deleted by %s: ID=%s, Name=%s, Status=%s",
                request.user.username if request.user.is_authenticated else "anonymous",
                obj.id,
                obj.name,
                obj.status,
            )
        super().delete_queryset(request, queryset)


@admin.register(CampaignLead)
class CampaignLeadAdmin(ModelAdmin):
    list_display = [
        'campaign', 'recipient_email', 'recipient_first_name',
        'recipient_last_name', 'external_user_id', 'status', 'has_dashboard_link',
    ]
    list_filter = ['status', 'source', 'campaign']
    search_fields = [
        'recipient_email', 'recipient_first_name', 'recipient_last_name',
        'external_user_id', 'campaign__name',
    ]
    readonly_fields = [
        'campaign', 'source', 'external_user_id', 'recipient_email',
        'recipient_first_name', 'recipient_last_name', 'dashboard_url',
        'template_variant', 'status', 'retry_count', 'error_message',
        'sent_at', 'opened_at', 'clicked_at', 'unsubscribed_at',
        'created_at', 'updated_at',
    ]
    list_per_page = 50

    def has_dashboard_link(self, obj):
        return bool(obj.dashboard_url)
    has_dashboard_link.boolean = True
    has_dashboard_link.short_description = 'Dashboard link'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
