from django.db import models


class Webhook(models.Model):
    """Webhook configuration for external integrations"""
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('failed', 'Failed'),
    )
    EVENT_CHOICES = (
        ('campaign_started', 'Campaign Started'),
        ('campaign_completed', 'Campaign Completed'),
        ('email_sent', 'Email Sent'),
        ('email_opened', 'Email Opened'),
        ('email_clicked', 'Email Clicked'),
        ('email_bounced', 'Email Bounced'),
        ('lead_unsubscribed', 'Lead Unsubscribed'),
    )
    name = models.CharField(max_length=255)
    url = models.URLField()
    event = models.CharField(max_length=50, choices=EVENT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    secret_key = models.CharField(max_length=255, blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    last_triggered_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Webhook"
        verbose_name_plural = "Webhooks"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.get_event_display()}"


class WebhookLog(models.Model):
    """Log of webhook deliveries"""
    STATUS_CHOICES = (
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    )
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='logs')
    payload = models.JSONField()
    response_code = models.IntegerField(blank=True, null=True)
    response_body = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Webhook Log"
        verbose_name_plural = "Webhook Logs"
        ordering = ['-attempted_at']

    def __str__(self):
        return f"{self.webhook.name} - {self.status}"