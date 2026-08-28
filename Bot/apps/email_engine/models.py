from django.db import models
from django.utils import timezone


class EmailLog(models.Model):
    """Log of every email sent"""
    STATUS_CHOICES = (
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    )
    campaign = models.ForeignKey('campaigns.Campaign', on_delete=models.SET_NULL, null=True, blank=True)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Tracking
    message_id = models.CharField(max_length=500, blank=True, null=True, db_index=True)
    tracking_id = models.CharField(max_length=255, unique=True, db_index=True)
    opened_at = models.DateTimeField(blank=True, null=True)
    clicked_at = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    sent_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Email Log"
        verbose_name_plural = "Email Logs"
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['tracking_id']),
            models.Index(fields=['status']),
            models.Index(fields=['sent_at']),
        ]

    def __str__(self):
        return f"{self.recipient_email} - {self.status}"


class Bounce(models.Model):
    """Record of bounced emails"""
    BOUNCE_TYPES = (
        ('hard', 'Hard Bounce'),
        ('soft', 'Soft Bounce'),
        ('spam', 'Spam Report'),
        ('blocked', 'Blocked'),
    )
    email = models.EmailField()
    bounce_type = models.CharField(max_length=20, choices=BOUNCE_TYPES)
    reason = models.TextField(blank=True, null=True)
    bounce_count = models.IntegerField(default=1)
    last_bounce_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Bounce"
        verbose_name_plural = "Bounces"
        ordering = ['-last_bounce_at']
        unique_together = ['email', 'bounce_type']

    def __str__(self):
        return f"{self.email} - {self.get_bounce_type_display()}"


class Tracking(models.Model):
    """Email open/click tracking details"""
    TRACKING_TYPES = (
        ('open', 'Open'),
        ('click', 'Click'),
    )
    email_log = models.ForeignKey(EmailLog, on_delete=models.CASCADE, related_name='tracking_events')
    tracking_type = models.CharField(max_length=10, choices=TRACKING_TYPES)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    url_clicked = models.URLField(blank=True, null=True)
    tracked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tracking Event"
        verbose_name_plural = "Tracking Events"
        ordering = ['-tracked_at']

    def __str__(self):
        return f"{self.get_tracking_type_display()} - {self.email_log.recipient_email}"