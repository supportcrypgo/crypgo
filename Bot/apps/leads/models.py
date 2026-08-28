from django.db import models
from django.utils import timezone


class BlacklistedLead(models.Model):
    """Blacklisted emails"""
    email = models.EmailField(unique=True)
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Blacklisted Lead"
        verbose_name_plural = "Blacklisted Leads"

    def __str__(self):
        return self.email