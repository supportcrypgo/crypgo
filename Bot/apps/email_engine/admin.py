from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import EmailLog, Bounce, Tracking


class TrackingInline(admin.TabularInline):
    model = Tracking
    extra = 0
    readonly_fields = ['tracking_type', 'ip_address', 'user_agent', 'url_clicked', 'tracked_at']
    can_delete = False


@admin.register(EmailLog)
class EmailLogAdmin(ModelAdmin):
    list_display = ['recipient_email', 'subject', 'status', 'campaign', 'sent_at']
    list_filter = ['status', 'sent_at']
    search_fields = ['recipient_email', 'subject', 'tracking_id']
    readonly_fields = ['tracking_id', 'sent_at', 'created_at']
    inlines = [TrackingInline]
    list_per_page = 50

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Bounce)
class BounceAdmin(ModelAdmin):
    list_display = ['email', 'bounce_type', 'bounce_count', 'last_bounce_at']
    list_filter = ['bounce_type', 'last_bounce_at']
    search_fields = ['email', 'reason']
    readonly_fields = ['created_at']


@admin.register(Tracking)
class TrackingAdmin(ModelAdmin):
    list_display = ['email_log', 'tracking_type', 'ip_address', 'tracked_at']
    list_filter = ['tracking_type', 'tracked_at']
    search_fields = ['email_log__recipient_email', 'ip_address']
    readonly_fields = ['tracked_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False