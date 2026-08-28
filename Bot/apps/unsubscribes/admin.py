from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import UnsubscribedLead


@admin.register(UnsubscribedLead)
class UnsubscribedLeadAdmin(ModelAdmin):
    list_display = ['email', 'source', 'unsubscribed_at']
    list_filter = ['source', 'unsubscribed_at']
    search_fields = ['email', 'reason']
    readonly_fields = ['unsubscribed_at', 'created_at']