from django.db import models
from django.utils import timezone


class Setting(models.Model):
    """System-wide settings"""
    key = models.CharField(max_length=255, unique=True)
    value = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Setting"
        verbose_name_plural = "Settings"

    def __str__(self):
        return self.key


class SystemLog(models.Model):
    """System-wide activity log"""
    LOG_LEVELS = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('debug', 'Debug'),
    )
    level = models.CharField(max_length=20, choices=LOG_LEVELS, default='info')
    source = models.CharField(max_length=255, blank=True, null=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "System Log"
        verbose_name_plural = "System Logs"
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.level}] {self.message[:50]}"