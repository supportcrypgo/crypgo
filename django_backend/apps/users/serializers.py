from rest_framework import serializers
from django.contrib.auth import get_user_model
from decimal import Decimal
from .models import (
    WalletAsset, UserHistoricalSnapshot, UserSession, KYCDocument, 
    UserActivityLog, Transaction, Notification, PushSubscription,
    DeviceFingerprint, TransactionTranslation, InternalTransfer
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'phone', 'country', 'city', 'address', 'avatar_url',
            'role', 'date_joined', 'is_active',
            'kyc_status', 'kyc_rejection_reason', 'two_fa_enabled',
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            'email', 'username', 'password', 'first_name', 'last_name',
            'phone', 'country', 'city', 'address', 'avatar_url', 'role',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class WalletAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletAsset
        fields = [
            'id', 'user', 'ticker', 'name', 'quantity',
            'available_quantity', 'locked_quantity',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class WalletAssetUpdateSerializer(serializers.ModelSerializer):
    """Used by admin to edit a user's asset quantities."""

    class Meta:
        model = WalletAsset
        fields = ['quantity', 'available_quantity', 'locked_quantity']


class UserHistoricalSnapshotSerializer(serializers.ModelSerializer):
    """Serializer for UserHistoricalSnapshot with performance metrics."""

    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserHistoricalSnapshot
        fields = [
            'id', 'user', 'user_email', 'snapshot_time',
            'asset_breakdown', 'total_balance',
            'performance24h', 'performance7d', 'performance30d',
        ]
        read_only_fields = ['id', 'user', 'snapshot_time']


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(
        help_text="The email address associated with the user account requesting a password reset."
    )


class ResetPasswordConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(
        help_text="The password reset token received via email."
    )


class ResetPasswordUpdateSerializer(serializers.Serializer):
    token = serializers.CharField(
        help_text="The password reset token received via email."
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        help_text="The new password (minimum 8 characters)."
    )
    confirm_password = serializers.CharField(
        write_only=True,
        min_length=8,
        help_text="Must match the new_password field."
    )

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return attrs


class LoginSerializer(serializers.Serializer):
    """Serializer for user login with email and password."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        from django.contrib.auth import authenticate
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(email=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password.")
            if not user.is_active:
                raise serializers.ValidationError("Account is inactive.")
            attrs['user'] = user
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8, required=False)
    
    class Meta:
        model = User
        fields = [
            'email', 'username', 'password', 'confirm_password', 
            'first_name', 'last_name', 'phone', 'country', 'city', 'address'
        ]
    
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def validate(self, attrs):
        confirm_password = attrs.get('confirm_password')
        if confirm_password is not None and attrs['password'] != confirm_password:
            raise serializers.ValidationError("Passwords do not match.")
        if confirm_password is None:
            attrs['confirm_password'] = attrs['password']
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password when user knows current password."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        
        # Validate current password against the authenticated user
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user and request.user.is_authenticated:  # type: ignore[union-attr]
            if not request.user.check_password(attrs['current_password']):
                raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        return attrs
    
    def save(self, **kwargs):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Authentication required")
        user = request.user
        if user is None:
            raise serializers.ValidationError("Authentication required")
        validated = getattr(self, 'validated_data', None)
        if not isinstance(validated, dict):
            raise serializers.ValidationError("Invalid serializer state")
        user.set_password(validated.get('new_password'))
        user.save()
        return user


class EmailPreferenceSerializer(serializers.Serializer):
    """Serializer for updating email notification preferences."""
    portfolio_activity = serializers.BooleanField(required=False, default=True)
    security_alerts = serializers.BooleanField(required=False, default=True)
    product_updates = serializers.BooleanField(required=False, default=False)
    marketing = serializers.BooleanField(required=False, default=False)
    
    def update(self, instance, validated_data):
        instance.update_email_preferences(validated_data)
        return instance


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for user device sessions."""
    class Meta:
        model = UserSession
        fields = [
            'id', 'device_name', 'browser', 'ip_address', 'location',
            'last_active', 'created_at', 'is_current', 'user_agent',
        ]
        read_only_fields = ['id', 'created_at', 'last_active']


class KYCDocumentSerializer(serializers.ModelSerializer):
    """Serializer for KYC document uploads."""
    class Meta:
        model = KYCDocument
        fields = [
            'id', 'document_type', 'file_url', 'original_filename',
            'file_size', 'status', 'rejection_reason',
            'uploaded_at', 'reviewed_at',
        ]
        read_only_fields = ['id', 'status', 'rejection_reason', 'uploaded_at', 'reviewed_at']


class AvatarUploadSerializer(serializers.Serializer):
    """Serializer for avatar upload endpoint (multipart/form-data)."""
    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        # Basic size check (limit to 5MB)
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('Avatar file too large (max 5MB).')
        return value


class UserActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for user activity log."""
    action_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'action', 'action_display', 'status', 'status_display',
            'ip_address', 'device', 'location', 'metadata', 'created_at',
        ]
        read_only_fields = fields
    
    def get_action_display(self, obj):
        return obj.get_action_display()
    
    def get_status_display(self, obj):
        return obj.get_status_display()


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for wallet transactions."""
    transaction_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_type', 'transaction_type_display',
            'asset', 'amount', 'fee', 'status', 'status_display',
            'txid', 'to_address', 'from_address',
            'counterparty', 'destination_asset', 'destination_amount',
            'fiat_amount', 'price_at_time', 'memo', 'metadata',
            'created_at', 'updated_at', 'completed_at',
        ]
        read_only_fields = ['id', 'txid', 'created_at', 'updated_at', 'completed_at']
    
    def get_transaction_type_display(self, obj):
        return obj.get_transaction_type_display()
    
    def get_status_display(self, obj):
        return obj.get_status_display()


class DepositSerializer(serializers.Serializer):
    """Serializer for generating deposit address."""
    asset = serializers.CharField(max_length=10)
    
    def validate_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value


class WithdrawSerializer(serializers.Serializer):
    """Serializer for withdrawal requests."""
    asset = serializers.CharField(max_length=10)
    amount = serializers.DecimalField(max_digits=20, decimal_places=8)
    destination_address = serializers.CharField(max_length=255, required=False, allow_blank=False)
    to_address = serializers.CharField(max_length=255, required=False, allow_blank=False)
    
    def validate_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value
    
    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
    
    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user  # type: ignore[union-attr]
        asset = attrs['asset']
        amount = attrs['amount']
        address = attrs.get('destination_address') or attrs.get('to_address')
        if not address:
            raise serializers.ValidationError({"destination_address": "Destination address is required."})

        try:
            wallet = WalletAsset.objects.get(user=user, ticker=asset)
        except WalletAsset.DoesNotExist:
            raise serializers.ValidationError(f"No {asset} wallet found.")
        
        fee = amount * Decimal('0.001')  # 0.1% fee
        total_deduction = amount + fee
        
        if wallet.available_quantity < total_deduction:
            raise serializers.ValidationError(
                f"Insufficient balance. You have {wallet.available_quantity} {asset} available."
            )
        
        attrs['fee'] = fee
        attrs['wallet'] = wallet
        attrs['destination_address'] = address
        return attrs


class TransferSerializer(serializers.Serializer):
    """Serializer for internal transfers between users."""
    recipient = serializers.CharField(max_length=150)
    asset = serializers.CharField(max_length=10)
    amount = serializers.DecimalField(max_digits=20, decimal_places=8)
    memo = serializers.CharField(required=False, allow_blank=True, max_length=500)
    
    def validate_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value
    
    def validate_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
    
    def validate_recipient(self, value):
        # Try to find recipient by email first, then username
        recipient = User.objects.filter(email__iexact=value).first()
        if not recipient:
            recipient = User.objects.filter(username__iexact=value).first()
        if not recipient:
            raise serializers.ValidationError("Recipient not found.")
        
        request = self.context.get('request')
        if recipient == request.user:  # type: ignore[union-attr]
            raise serializers.ValidationError("Cannot transfer to yourself.")
        
        return recipient
    
    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user  # type: ignore[union-attr]
        asset = attrs['asset']
        amount = attrs['amount']
        
        try:
            wallet = WalletAsset.objects.get(user=user, ticker=asset)
        except WalletAsset.DoesNotExist:
            raise serializers.ValidationError(f"No {asset} wallet found.")
        
        if wallet.available_quantity < amount:
            raise serializers.ValidationError(
                f"Insufficient balance. You have {wallet.available_quantity} {asset} available."
            )
        
        attrs['wallet'] = wallet
        return attrs


class BuySerializer(serializers.Serializer):
    """Serializer for buying crypto with fiat."""
    asset = serializers.CharField(max_length=10)
    amount_usd = serializers.DecimalField(max_digits=15, decimal_places=2)
    
    def validate_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value
    
    def validate_amount_usd(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
    
    def validate(self, attrs):
        # Fiat balance check removed - using simulated prices only
        return attrs


class SwapSerializer(serializers.Serializer):
    """Serializer for swapping between crypto assets."""
    from_asset = serializers.CharField(max_length=10)
    to_asset = serializers.CharField(max_length=10)
    amount = serializers.DecimalField(max_digits=20, decimal_places=8)
    
    def validate_from_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value
    
    def validate_to_asset(self, value):
        value = value.upper()
        valid_assets = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'LTC']
        if value not in valid_assets:
            raise serializers.ValidationError(f"Unsupported asset. Valid: {', '.join(valid_assets)}")
        return value
    
    def validate(self, attrs):
        if attrs['from_asset'] == attrs['to_asset']:
            raise serializers.ValidationError("Cannot swap to the same asset.")
        
        request = self.context.get('request')
        amount = attrs['amount']
        
        try:
            wallet = WalletAsset.objects.get(user=request.user, ticker=attrs['from_asset'])  # type: ignore[union-attr]
        except WalletAsset.DoesNotExist:
            raise serializers.ValidationError(f"No {attrs['from_asset']} wallet found.")
        
        if wallet.available_quantity < amount:
            raise serializers.ValidationError(
                f"Insufficient balance. You have {wallet.available_quantity} {attrs['from_asset']} available."
            )
        
        attrs['wallet'] = wallet
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications."""
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'body', 'data',
            'is_read', 'read_at', 'delivered', 'delivered_at',
            'status', 'status_display', 'created_at',
        ]
        read_only_fields = fields
    
    def get_status_display(self, obj):
        return obj.get_status_display()


class MarkNotificationReadSerializer(serializers.Serializer):
    """Serializer for marking notification as read."""
    notification_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for push subscriptions."""
    
    class Meta:
        model = PushSubscription
        fields = ['id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at']
        read_only_fields = ['id', 'created_at']


class SubscribePushSerializer(serializers.Serializer):
    """Serializer for subscribing to push notifications."""
    endpoint = serializers.URLField()
    p256dh = serializers.CharField(max_length=255)
    auth = serializers.CharField(max_length=255)
    user_agent = serializers.CharField(required=False, allow_blank=True)


class DeviceFingerprintSerializer(serializers.ModelSerializer):
    """Serializer for device fingerprints."""
    
    class Meta:
        model = DeviceFingerprint
        fields = [
            'id', 'user', 'user_agent', 'browser', 'browser_version',
            'os', 'os_version', 'device_type', 'screen_resolution',
            'language', 'timezone', 'platform', 'cores', 'memory',
            'first_seen', 'last_seen', 'ip_address',
            'location_city', 'location_country',
            'location_latitude', 'location_longitude', 'location_accuracy',
            'is_current',
        ]
        read_only_fields = fields


class VerifyDeviceLocationSerializer(serializers.Serializer):
    """Serializer for verifying device location."""
    latitude = serializers.DecimalField(max_digits=9, decimal_places=7)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=7)
    accuracy = serializers.IntegerField(required=False)
    fingerprint_id = serializers.IntegerField(required=False)


class RequestBrowserLocationSerializer(serializers.Serializer):
    """Serializer for requesting browser location permission."""
    permission = serializers.ChoiceField(choices=[('granted', 'Granted'), ('denied', 'Denied')])


class SearchUsersByIdSerializer(serializers.Serializer):
    """Serializer for searching users by device ID prefix."""
    prefix = serializers.CharField(max_length=50)


class SearchUsersByNameSerializer(serializers.Serializer):
    """Serializer for searching users by name/username/email."""
    query = serializers.CharField(max_length=100)


class AdvertiserStatsSerializer(serializers.Serializer):
    """Serializer for advertiser statistics."""
    total_reviews = serializers.IntegerField()
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    rating_distribution = serializers.DictField(
        child=serializers.IntegerField(),
        required=False
    )
    total_volume = serializers.DecimalField(max_digits=36, decimal_places=18)
    completed_trades = serializers.IntegerField()
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False)


class TransactionTranslationSerializer(serializers.ModelSerializer):
    """Serializer for transaction translations."""
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True, allow_null=True)
    translation_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TransactionTranslation
        fields = [
            'id', 'transaction', 'target_language', 'source_text',
            'translated_text', 'translation_type', 'translation_type_display',
            'created_by', 'created_by_email', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_translation_type_display(self, obj):
        return obj.get_translation_type_display()


class InternalTransferSerializer(serializers.ModelSerializer):
    """Serializer for internal transfers."""
    sender_email = serializers.EmailField(source='sender.email', read_only=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = InternalTransfer
        fields = [
            'id', 'sender', 'sender_email', 'recipient', 'recipient_email',
            'asset', 'amount', 'status', 'status_display',
            'sender_transaction', 'recipient_transaction',
            'created_at', 'completed_at',
        ]
        read_only_fields = ['id', 'sender', 'recipient', 'status', 'created_at', 'completed_at']
    
    def get_status_display(self, obj):
        return obj.get_status_display()


class TwoFASetupSerializer(serializers.Serializer):
    """Initiate 2FA setup (returns secret)."""
    otp_secret = serializers.CharField(read_only=True)


class TwoFAVerifySerializer(serializers.Serializer):
    """Verify 2FA code during setup or authentication."""
    code = serializers.CharField(max_length=10)
    otp_secret = serializers.CharField(max_length=64, required=False)


class TwoFADisableSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10)
