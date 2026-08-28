from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Webhook, WebhookLog


class WebhookLogInline(admin.TabularInline):
    model = WebhookLog
    extra = 0
    readonly_fields = ['payload', 'response_code', 'response_body', 'status', 'error_message', 'attempted_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Webhook)
class WebhookAdmin(ModelAdmin):
    list_display = ['name', 'url', 'event', 'status', 'last_triggered_at']
    list_filter = ['status', 'event', 'created_at']
    search_fields = ['name', 'url']
    readonly_fields = ['retry_count', 'last_triggered_at', 'created_at', 'updated_at']
    inlines = [WebhookLogInline]