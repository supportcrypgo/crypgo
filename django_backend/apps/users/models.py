from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.conf import settings
import secrets
import base64
import hashlib
from datetime import timedelta
from decimal import Decimal


class CustomUser(AbstractUser):
    """Custom User model extending Django's AbstractUser."""

    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Public-facing alphanumeric user ID (displayed to users, used in reports, API)
    public_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        blank=True,
        editable=False,
        help_text="Public-facing alphanumeric user ID"
    )

    # Profile fields that can be edited by admin
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    address = models.TextField(blank=True, default='')
    avatar_url = models.URLField(blank=True, default='')
    role = models.CharField(max_length=20, choices=[('user', 'User'), ('admin', 'Admin')], default='user')
    
    # Email notification preferences (JSON field)
    email_preferences = models.JSONField(default=dict, blank=True)
    
    # KYC Status
    KYC_STATUS_CHOICES = [
        ('none', 'Not Started'),
        ('pending', 'Pending Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]
    kyc_status = models.CharField(
        max_length=20,
        choices=KYC_STATUS_CHOICES,
        default='none'
    )
    kyc_rejection_reason = models.TextField(blank=True, null=True)
    kyc_submitted_at = models.DateTimeField(blank=True, null=True)
    kyc_reviewed_at = models.DateTimeField(blank=True, null=True)
    kyc_reviewed_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='kyc_reviewed_users'
    )
    
    # 2FA
    two_fa_secret = models.CharField(max_length=32, blank=True, null=True)
    two_fa_enabled = models.BooleanField(default=False)
    two_fa_backup_codes = models.JSONField(default=list, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email
    
    def get_email_preferences(self):
        """Get user's email preferences with defaults."""
        defaults = {
            'portfolio_activity': True,
            'security_alerts': True,
            'product_updates': False,
            'marketing': False,
        }
        defaults.update(self.email_preferences or {})
        return defaults
    
    def update_email_preferences(self, preferences):
        """Update user's email preferences."""
        self.email_preferences = {**self.get_email_preferences(), **preferences}
        self.save(update_fields=['email_preferences'])
        return self.email_preferences

    @staticmethod
    def generate_public_id():
        """Generate a unique 14-character alphanumeric public ID."""
        import string
        alphabet = string.ascii_letters + string.digits  # 62 characters
        for _ in range(10):  # Retry up to 10 times (collision probability is astronomically low)
            candidate = ''.join(secrets.choice(alphabet) for _ in range(14))
            if not CustomUser.objects.filter(public_id=candidate).exists():
                return candidate
        raise ValueError("Failed to generate unique public_id after 10 attempts")

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = self.generate_public_id()
        super().save(*args, **kwargs)


class WalletAsset(models.Model):
    """Represents a single cryptocurrency holding for a user."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='wallet_assets'
    )
    ticker = models.CharField(max_length=10, help_text="e.g. BTC, ETH, SOL, LTC")
    name = models.CharField(max_length=100, help_text="e.g. Bitcoin, Ethereum")
    quantity = models.DecimalField(max_digits=20, decimal_places=8, default=Decimal('0'))  # type: ignore[arg-type]
    available_quantity = models.DecimalField(max_digits=20, decimal_places=8, default=Decimal('0'))  # type: ignore[arg-type]
    locked_quantity = models.DecimalField(max_digits=20, decimal_places=8, default=Decimal('0'))  # type: ignore[arg-type]
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_assets'
        verbose_name = 'Wallet Asset'
        verbose_name_plural = 'Wallet Assets'
        unique_together = ['user', 'ticker']

    def __str__(self):
        return f"{self.user.email} - {self.ticker}: {self.quantity}"


class PasswordResetToken(models.Model):
    """Model for storing password reset tokens."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='reset_tokens'
    )
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        verbose_name = 'Password Reset Token'
        verbose_name_plural = 'Password Reset Tokens'

    def __str__(self):
        return f"Reset token for {self.user.email}"

    @classmethod
    def generate_token(cls, user):
        """Generate a unique reset token for a user."""
        random_bytes = secrets.token_bytes(32)
        token = base64.urlsafe_b64encode(random_bytes).decode('utf-8').rstrip('=')

        expiry_hours = getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRY_HOURS', 24)
        expires_at = timezone.now() + timedelta(hours=expiry_hours)

        reset_token = cls.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )

        return reset_token

    def is_valid(self):
        """Check if the token is still valid (not expired and not used)."""
        if self.used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return True

    def mark_used(self):
        """Mark the token as used."""
        self.used = True
        self.save()


class MagicLinkToken(models.Model):
    """Single-use token used to change a forgotten password."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='magic_link_tokens',
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'magic_link_tokens'
        ordering = ['-created_at']

    @classmethod
    def generate_token(cls, user):
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expiry_hours = getattr(settings, 'MAGIC_LINK_EXPIRY_HOURS', 1)
        token = cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(hours=expiry_hours),
        )
        return token, raw_token

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at and self.user.is_active


class CampaignAccessToken(models.Model):
    """Single-use access token bound to a user and campaign reference."""

    MAX_USES = 1

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='campaign_access_tokens',
    )
    campaign_ref = models.CharField(max_length=100)
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(blank=True, null=True)
    use_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'campaign_access_tokens'
        ordering = ['-created_at']

    @classmethod
    def generate_token(cls, user, campaign_ref):
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expiry_minutes = getattr(settings, 'CAMPAIGN_ACCESS_EXPIRY_MINUTES', 24 * 60)
        token = cls.objects.create(
            user=user,
            campaign_ref=campaign_ref,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(minutes=expiry_minutes),
        )
        return token, raw_token

    def is_valid(self):
        return self.used_at is None and self.use_count < self.MAX_USES

    def consume(self):
        if not self.is_valid():
            return False
        self.use_count += 1
        if self.use_count >= self.MAX_USES:
            self.used_at = timezone.now()
        self.save(update_fields=['use_count', 'used_at'])
        return True


class UserHistoricalSnapshot(models.Model):
    """
    Persistent snapshot of user portfolio position.
    Captures asset holdings at a point in time for historical analysis and compliance.
    """
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='snapshots'
    )
    snapshot_time = models.DateTimeField(auto_now_add=True)
    asset_breakdown = models.JSONField()  # Format: {"BTC": quantity, "ETH": quantity}
    total_balance = models.DecimalField(max_digits=22, decimal_places=8)
    performance24h = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    performance7d = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    performance30d = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    class Meta:
        db_table = 'user_historical_snapshots'
        ordering = ['-snapshot_time']
        verbose_name = 'User Historical Snapshot'
        verbose_name_plural = 'User Historical Snapshots'
        unique_together = ['user', 'snapshot_time']

    def __str__(self):
        return f"{self.user.email} - {self.snapshot_time}"


class UserSession(models.Model):
    """Track user device sessions for security/activity log."""
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    device_name = models.CharField(max_length=100)
    browser = models.CharField(max_length=100, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    last_active = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_current = models.BooleanField(default=False)
    user_agent = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-last_active']
    
    def __str__(self):
        return f"{self.user.email} - {self.device_name} ({self.ip_address})"


class KYCDocument(models.Model):
    """KYC document uploads for identity verification."""
    
    DOCUMENT_TYPES = [
        ('id_front', 'Government ID - Front'),
        ('id_back', 'Government ID - Back'),
        ('proof_address', 'Proof of Address'),
        ('selfie', 'Selfie'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='kyc_documents'
    )
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)
    file_url = models.URLField()
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='kyc_reviews'
    )
    
    class Meta:
        unique_together = ['user', 'document_type']
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.get_document_type_display()} ({self.status})"  # type: ignore[attr-defined]


class UserActivityLog(models.Model):
    """Track user activity for security audit trail."""
    
    ACTION_TYPES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('password_change', 'Password Change'),
        ('password_reset_request', 'Password Reset Request'),
        ('password_reset_complete', 'Password Reset Complete'),
        ('2fa_enable', '2FA Enabled'),
        ('2fa_disable', '2FA Disabled'),
        ('avatar_update', 'Avatar Updated'),
        ('profile_update', 'Profile Updated'),
        ('kyc_submit', 'KYC Submitted'),
        ('kyc_approved', 'KYC Approved'),
        ('kyc_rejected', 'KYC Rejected'),
        ('session_revoke', 'Session Revoked'),
        ('session_revoke_all', 'All Sessions Revoked'),
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('transfer', 'Transfer'),
        ('buy', 'Buy Crypto'),
        ('swap', 'Swap Crypto'),
    ]
    
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    action = models.CharField(max_length=30, choices=ACTION_TYPES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='success')
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    device = models.CharField(max_length=200, blank=True, null=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'User Activity Logs'
    
    def __str__(self):
        return f"{self.user.email} - {self.get_action_display()} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"  # type: ignore[attr-defined]


class Transaction(models.Model):
    """Records all wallet transactions: deposit, withdrawal, transfer, buy, swap."""
    
    TRANSACTION_TYPES = [
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('transfer_in', 'Transfer In'),
        ('transfer_out', 'Transfer Out'),
        ('buy', 'Buy'),
        ('swap', 'Swap'),
        ('receive', 'Receive'),
        ('send', 'Send'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    asset = models.CharField(max_length=10)
    amount = models.DecimalField(max_digits=20, decimal_places=8)
    fee = models.DecimalField(max_digits=20, decimal_places=8, default=Decimal('0'))  # type: ignore[arg-type]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    txid = models.CharField(max_length=100, unique=True, null=True, blank=True)
    to_address = models.CharField(max_length=255, blank=True, null=True)
    from_address = models.CharField(max_length=255, blank=True, null=True)
    counterparty = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_transactions'
    )
    destination_asset = models.CharField(max_length=10, blank=True, null=True)  # for swaps
    destination_amount = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)  # for swaps
    fiat_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)  # for buys
    price_at_time = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)  # for buys/swaps
    memo = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']

    def get_transaction_type_display(self) -> str:
        display_value = dict(self.TRANSACTION_TYPES).get(
            self.transaction_type,
            self.transaction_type,
        )
        return display_value or self.transaction_type
    
    def __str__(self):
        return f"{self.user.email} - {self.get_transaction_type_display()} - {self.asset} {self.amount} ({self.status})"  # type: ignore[attr-defined]
    
    def save(self, *args, **kwargs):
        if not self.txid:
            self.txid = f"tx_{secrets.token_hex(16)}"
        if self.status == 'completed' and not self.completed_at:
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)


class InternalTransfer(models.Model):
    """Internal transfer between platform users."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    sender = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='internal_transfers_sent'
    )
    recipient = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='internal_transfers_received'
    )
    asset = models.CharField(max_length=10)
    amount = models.DecimalField(max_digits=36, decimal_places=18)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    sender_transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transfers_as_sender'
    )
    recipient_transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transfers_as_recipient'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'internal_transfers'
        ordering = ['-created_at']

    def __str__(self):
        return f"Transfer {self.sender_id} -> {self.recipient_id}: {self.asset} {self.amount} ({self.status})"  # type: ignore[attr-defined]


class Notification(models.Model):
    """Push and in-app notifications for users."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
    ]

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    type = models.CharField(max_length=50)
    title = models.CharField(max_length=100)
    body = models.TextField(blank=True, default='')
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    delivered = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at'], name='idx_notif_user'),
            models.Index(fields=['type', 'user'], name='idx_notif_type'),
        ]

    def __str__(self):
        return f"{self.title} for user {self.user_id}"  # type: ignore[attr-defined]


class PushSubscription(models.Model):
    """Web Push subscription for a user's device."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='push_subscriptions'
    )
    endpoint = models.URLField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'push_subscriptions'

    def __str__(self):
        return f"Push subscription for user {self.user_id}"  # type: ignore[attr-defined]


class DeviceFingerprint(models.Model):
    """Device fingerprint for security and location verification."""

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='device_fingerprints'
    )
    user_agent = models.TextField()
    browser = models.CharField(max_length=50, blank=True, null=True)
    browser_version = models.CharField(max_length=50, blank=True, null=True)
    os = models.CharField(max_length=50, blank=True, null=True)
    os_version = models.CharField(max_length=50, blank=True, null=True)
    device_type = models.CharField(max_length=20, blank=True, null=True)
    screen_resolution = models.CharField(max_length=20, blank=True, null=True)
    language = models.CharField(max_length=50, blank=True, null=True)
    timezone = models.CharField(max_length=50, blank=True, null=True)
    platform = models.CharField(max_length=50, blank=True, null=True)
    cores = models.IntegerField(null=True, blank=True)
    memory = models.IntegerField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    location_city = models.CharField(max_length=100, blank=True, null=True)
    location_country = models.CharField(max_length=100, blank=True, null=True)
    location_latitude = models.DecimalField(max_digits=9, decimal_places=7, null=True, blank=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=7, null=True, blank=True)
    location_accuracy = models.IntegerField(null=True, blank=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = 'security_fingerprints'
        ordering = ['-last_seen']
        indexes = [
            models.Index(fields=['user', '-last_seen'], name='idx_fp_user'),
            models.Index(fields=['ip_address', '-last_seen'], name='idx_fp_ip'),
        ]

    def __str__(self):
        return f"Fingerprint for user {self.user_id} ({self.browser} on {self.os})"  # type: ignore[attr-defined]


class TransactionTranslation(models.Model):
    """Translation of a transaction description into another language."""

    translation_type_choices = [
        ('description', 'Description'),
        ('note', 'Note'),
        ('extra', 'Extra'),
    ]

    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name='translations'
    )
    target_language = models.CharField(max_length=10)
    source_text = models.TextField()
    translated_text = models.TextField()
    translation_type = models.CharField(max_length=20, choices=translation_type_choices, default='description')
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_translations'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'translations'
        unique_together = ['transaction', 'target_language', 'translation_type']
        indexes = [
            models.Index(fields=['transaction', 'target_language'], name='idx_translations_tx'),
            models.Index(fields=['-created_at'], name='idx_translations_created'),
        ]

    def __str__(self):
        return f"Translation of transaction {self.transaction_id} to {self.target_language}"  # type: ignore[attr-defined]
