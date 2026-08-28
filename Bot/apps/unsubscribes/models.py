from django.db import models
from django.utils import timezone


class UnsubscribedLead(models.Model):
    """Record of unsubscribed emails"""
    email = models.EmailField(unique=True, db_index=True)
    reason = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=255, blank=True, null=True, help_text="Where the unsubscribe came from")
    unsubscribed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Unsubscribed Lead"
        verbose_name_plural = "Unsubscribed Leads"
        ordering = ['-unsubscribed_at']

    def __str__(self):
        return self.email