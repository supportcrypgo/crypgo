import logging

from django.db import models
from django.utils import timezone
from django.db.models.signals import pre_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)


class Campaign(models.Model):
    """Email campaign definition"""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('running', 'Running'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    PRIORITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    )
    name = models.CharField(max_length=500)
    subject = models.CharField(max_length=500)
    template = models.ForeignKey('app_templates.EmailTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='campaigns_template_a')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    
    # Scheduling
    scheduled_at = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Batch & Processing (resume support)
    batch_size = models.IntegerField(default=50, help_text="Number of emails per batch")
    last_processed_index = models.IntegerField(default=0, help_text="Last lead ID processed for resume support")
    current_document_id = models.IntegerField(default=1, help_text="Currently processing document (1-20)")
    
    # Rate limiting per campaign
    email_per_hour = models.IntegerField(default=50)
    email_per_day = models.IntegerField(default=450)
    throttle_per_minute = models.IntegerField(default=5)
    
    # A/B Testing
    template_b = models.ForeignKey(
        'app_templates.EmailTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaigns_template_b'
    )
    split_ratio = models.FloatField(default=0.5, help_text="Ratio for template A vs B (0.5 = 50/50)")
    
    # Control flags
    is_paused = models.BooleanField(default=False)
    is_archived = models.BooleanField(
        default=False,
        help_text="Archived campaigns are hidden from normal workflows",
    )
    
    # Stats
    total_leads = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    opened_count = models.IntegerField(default=0)
    clicked_count = models.IntegerField(default=0)
    bounced_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    unsubscribe_count = models.IntegerField(default=0)
    
    created_by = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Campaign"
        verbose_name_plural = "Campaigns"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    def open_rate(self):
        if self.sent_count > 0:
            return round((self.opened_count / self.sent_count) * 100, 2)
        return 0.0

    def click_rate(self):
        if self.sent_count > 0:
            return round((self.clicked_count / self.sent_count) * 100, 2)
        return 0.0

    def bounce_rate(self):
        if self.total_leads > 0:
            return round((self.bounced_count / self.total_leads) * 100, 2)
        return 0.0


@receiver(pre_delete, sender=Campaign)
def log_campaign_deletion(sender, instance, **kwargs):
    """Write an audit log whenever a campaign is deleted."""
    logger.warning(
        "Campaign DELETED: ID=%s, Name=%s, Status=%s",
        instance.id,
        instance.name,
        instance.status,
    )


class CampaignLead(models.Model):
    """Per-lead tracking within a campaign"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('queued', 'Queued'),
        ('sent', 'Sent'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
        ('unsubscribed', 'Unsubscribed'),
    ]
    
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='campaign_leads')
    source = models.CharField(max_length=30, default='crypgo_user')
    external_user_id = models.CharField(max_length=100, blank=True, null=True)
    recipient_email = models.EmailField(blank=True, null=True)
    recipient_first_name = models.CharField(max_length=255, blank=True, null=True)
    recipient_last_name = models.CharField(max_length=255, blank=True, null=True)
    dashboard_url = models.URLField(max_length=1000, blank=True, null=True)
    
    # Variant tracking for A/B testing
    template_variant = models.CharField(
        max_length=1, default='A',
        choices=[('A', 'Variant A'), ('B', 'Variant B')]
    )
    
    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    retry_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    
    # Timestamps
    sent_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Campaign Lead"
        verbose_name_plural = "Campaign Leads"
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'external_user_id'],
                condition=models.Q(external_user_id__isnull=False),
                name='unique_crypgo_campaign_recipient',
            ),
        ]
        indexes = [
            models.Index(fields=['campaign', 'status']),
            models.Index(fields=['campaign', 'sent_at']),
        ]
    
    def __str__(self):
        email = self.recipient_email or 'unknown recipient'
        return f"{self.campaign.name} - {email}"
