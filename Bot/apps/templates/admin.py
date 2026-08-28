from django.contrib import admin
from unfold.admin import ModelAdmin
from tinymce.widgets import TinyMCE
from django.db import models
from .models import EmailTemplate


@admin.register(EmailTemplate)
class EmailTemplateAdmin(ModelAdmin):
    list_display = ['name', 'subject', 'is_active', 'spam_score', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'subject']
    formfield_overrides = {
        models.TextField: {'widget': TinyMCE(attrs={'cols': 80, 'rows': 30})},
    }

    fieldsets = [
        ('Basic Information', {
            'fields': ['name', 'subject', 'is_active']
        }),
        ('HTML Content (Rich Text)', {
            'fields': ['html_content'],
            'classes': ['wide'],
            'description': 'Use the rich text editor below to design your HTML email.'
        }),
        ('Plain Text Fallback', {
            'fields': ['plain_text'],
            'classes': ['collapse'],
            'description': 'Plain text version for email clients that don\'t support HTML.'
        }),
        ('Attachment & Spam', {
            'fields': ['attachment', 'spam_score'],
            'classes': ['collapse']
        }),
    ]
