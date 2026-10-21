import logging
import hashlib
import hmac
import json

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
from .recipient_utils import campaign_recipient_count
from .worker import launch_campaign_worker
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
                       'created_at', 'updated_at', 'selected_recipients_only']
    list_per_page = 25

    fieldsets = (
        ('Campaign Info', {
            'fields': ('name', 'subject', 'template', 'status', 'priority', 'is_archived'),
        }),
        ('Crypgo audience', {
            'fields': ('selected_recipients_only',),
            'description': 'Broadcast campaigns synchronize all active Crypgo users. Targeted sends use only the accounts selected at creation.',
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
                'send-to-users/',
                self.admin_site.admin_view(self.send_to_users_view),
                name='campaigns_campaign_send_to_users',
            ),
            path(
                '<int:campaign_id>/send-now/',
                self.admin_site.admin_view(self.send_campaign_view),
                name='campaigns_campaign_send_now',
            ),
            path(
                '<int:campaign_id>/pause/',
                self.admin_site.admin_view(self.pause_campaign_view),
                name='campaigns_campaign_pause',
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

        if not campaign.selected_recipients_only:
            synced, sync_message = self._sync_crypgo_users(campaign)
            if not synced:
                return False, sync_message

        started, message = launch_campaign_worker(campaign.pk)
        return started, message if started else f"Campaign '{campaign.name}' was not started: {message}"

    def _export_crypgo_accounts(self, campaign_ref, user_ids=None):
        if not settings.CRYPGO_SERVICE_KEY:
            raise RuntimeError('Crypgo account export is not configured.')

        payload = {}
        if user_ids is not None:
            payload['user_ids'] = user_ids
        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        signature = hmac.new(
            settings.CRYPGO_SERVICE_KEY.encode('utf-8'),
            body,
            hashlib.sha256,
        ).hexdigest()
        response = requests.post(
            f'{settings.CRYPGO_API_URL.rstrip("/")}/api/internal/campaigns/{campaign_ref}/accounts/export/',
            data=body,
            headers={
                'Content-Type': 'application/json',
                'X-Bot-Signature': signature,
            },
            timeout=60,
        )
        response.raise_for_status()
        accounts = response.json().get('accounts')
        if not isinstance(accounts, list):
            raise ValueError('Crypgo account export returned an invalid response.')
        for account in accounts:
            if not isinstance(account, dict) or not all(
                isinstance(account.get(field), str) and account[field]
                for field in ('external_user_id', 'email')
            ):
                raise ValueError('Crypgo account export returned an incomplete account.')
            if user_ids is not None and not account.get('dashboard_url'):
                raise ValueError('Crypgo account export returned no campaign access URL.')
        return accounts

    def send_to_users_view(self, request):
        from apps.templates.models import EmailTemplate

        accounts = []
        directory_error = ''
        selected_ids = []
        selected_template_id = request.POST.get('template_id', '')
        if request.method == 'GET':
            try:
                accounts = self._export_crypgo_accounts('targeted-directory')
            except (requests.RequestException, ValueError, TypeError, RuntimeError) as error:
                logger.exception('Could not load Crypgo accounts for targeted email.')
                directory_error = f'Unable to load Crypgo accounts: {error}'

        if request.method == 'POST':
            selected_ids = request.POST.getlist('user_ids')
            try:
                user_ids = list(dict.fromkeys(int(value) for value in selected_ids))
            except (TypeError, ValueError):
                user_ids = []
            if not user_ids or any(user_id <= 0 for user_id in user_ids):
                self.message_user(
                    request,
                    'Select at least one valid Crypgo account before sending.',
                    messages.ERROR,
                )
            else:
                template = get_object_or_404(
                    EmailTemplate,
                    pk=request.POST.get('template_id'),
                    is_active=True,
                )
                campaign = Campaign.objects.create(
                    name=f'Selected send - {template.name} - {timezone.localtime():%Y-%m-%d %H:%M}',
                    subject=template.subject,
                    template=template,
                    status='draft',
                    selected_recipients_only=True,
                    created_by=request.user.get_username(),
                    scheduled_at=timezone.now(),
                )
                try:
                    selected_accounts = self._export_crypgo_accounts(
                        campaign.pk,
                        user_ids,
                    )
                    returned_ids = {
                        int(account['external_user_id'])
                        for account in selected_accounts
                    }
                    if returned_ids != set(user_ids):
                        raise ValueError(
                            'One or more selected accounts are no longer active. No email was queued.'
                        )
                    CampaignLead.objects.bulk_create([
                        CampaignLead(
                            campaign=campaign,
                            source='crypgo_user',
                            external_user_id=account['external_user_id'],
                            recipient_email=account['email'],
                            recipient_first_name=account.get('first_name', ''),
                            recipient_last_name=account.get('last_name', ''),
                            recipient_account_emails=[account['email']],
                            dashboard_url=account['dashboard_url'],
                        )
                        for account in selected_accounts
                    ])
                    campaign.total_leads = campaign_recipient_count(campaign)
                    campaign.save(update_fields=['total_leads', 'updated_at'])
                except (requests.RequestException, KeyError, TypeError, ValueError, RuntimeError) as error:
                    logger.exception(
                        'Could not prepare targeted campaign %s.',
                        campaign.pk,
                    )
                    campaign.delete()
                    self.message_user(
                        request,
                        f'Could not prepare the selected send: {error}',
                        messages.ERROR,
                    )
                else:
                    started, message = launch_campaign_worker(campaign.pk)
                    self.message_user(
                        request,
                        message,
                        messages.SUCCESS if started else messages.ERROR,
                    )
                    if started:
                        return HttpResponseRedirect(
                            reverse('admin:campaigns_campaign_changelist')
                        )

        if not accounts and not directory_error:
            try:
                accounts = self._export_crypgo_accounts('targeted-directory')
            except (requests.RequestException, ValueError, TypeError, RuntimeError) as error:
                logger.exception('Could not load Crypgo accounts for targeted email.')
                directory_error = f'Unable to load Crypgo accounts: {error}'
        return self._render_targeted_send_page(request, {
            'title': 'Send to selected Crypgo accounts',
            'opts': self.model._meta,
            'templates': EmailTemplate.objects.filter(is_active=True).order_by('name'),
            'accounts': accounts,
            'directory_error': directory_error,
            'selected_user_ids': selected_ids,
            'selected_template_id': selected_template_id,
        })

    def _render_targeted_send_page(self, request, context):
        from django.template.response import TemplateResponse

        return TemplateResponse(
            request,
            'admin/campaigns/send_to_users.html',
            self.admin_site.each_context(request) | context,
        )

    def _sync_crypgo_users(self, campaign):
        if campaign.selected_recipients_only:
            return False, 'This targeted campaign is locked to its selected accounts.'

        if settings.CRYPGO_CAMPAIGN_OWNER_EMAIL:
            campaign.save(update_fields=['updated_at'])
            return True, 'Campaign configured to issue links for the selected owner account.'

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
                timeout=60,
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
                    account_emails = recipient.get('account_emails', [recipient['email']])
                    if (
                        not isinstance(account_emails, list)
                        or not account_emails
                        or not all(isinstance(email, str) and email.strip() for email in account_emails)
                    ):
                        return False, 'Crypgo sync returned invalid account email addresses.'
                    campaign_lead, created = CampaignLead.objects.update_or_create(
                        campaign=campaign,
                        external_user_id=recipient['external_user_id'],
                        defaults={
                            'source': 'crypgo_user',
                            'recipient_email': recipient['email'],
                            'recipient_first_name': recipient.get('first_name', ''),
                            'recipient_last_name': recipient.get('last_name', ''),
                            'recipient_account_emails': account_emails,
                            'dashboard_url': recipient['dashboard_url'],
                        },
                    )
                    if created:
                        campaign_lead.status = 'pending'
                        campaign_lead.save(update_fields=['status', 'updated_at'])
            campaign.total_leads = campaign_recipient_count(campaign)
            campaign.save(update_fields=['total_leads', 'updated_at'])
            if not recipients:
                return False, f'Crypgo returned no active users for campaign "{campaign.name}".'
            return True, f'Synchronized {len(recipients)} Crypgo inboxes.'
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

    def pause_campaign_view(self, request, campaign_id):
        campaign = get_object_or_404(Campaign, pk=campaign_id)
        Campaign.objects.filter(pk=campaign.pk).update(
            status='paused',
            is_paused=True,
            updated_at=timezone.now(),
        )
        self.message_user(request, f"Campaign '{campaign.name}' paused.", messages.WARNING)
        return HttpResponseRedirect(
            request.META.get('HTTP_REFERER')
            or reverse('admin:campaigns_campaign_change', args=[campaign.pk])
        )

    def get_deleted_objects(self, objs, request):
        deleted_objects, model_count, perms_needed, protected = super().get_deleted_objects(
            objs,
            request,
        )
        if request.user.has_perm('campaigns.delete_campaign'):
            perms_needed.discard(CampaignLead._meta.verbose_name)
        return deleted_objects, model_count, perms_needed, protected

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
        return super().has_delete_permission(request, obj)
