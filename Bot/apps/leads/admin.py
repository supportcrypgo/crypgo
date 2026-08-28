from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import BlacklistedLead


@admin.register(BlacklistedLead)
class BlacklistedLeadAdmin(ModelAdmin):
    list_display = ['email', 'reason', 'created_at']
    search_fields = ['email', 'reason']
    readonly_fields = ['created_at']