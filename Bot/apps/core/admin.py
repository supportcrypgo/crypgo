from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Setting, SystemLog


@admin.register(Setting)
class SettingAdmin(ModelAdmin):
    list_display = ['key', 'value', 'updated_at']
    search_fields = ['key', 'value']
    list_filter = ['created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(SystemLog)
class SystemLogAdmin(ModelAdmin):
    list_display = ['level', 'source', 'message', 'created_at']
    list_filter = ['level', 'source', 'created_at']
    search_fields = ['message', 'source']
    readonly_fields = ['created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False