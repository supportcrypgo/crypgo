from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from .models import CustomUser, PasswordResetToken, WalletAsset, UserHistoricalSnapshot


class CustomUserAdmin(UserAdmin, ModelAdmin):
    """Admin configuration for CustomUser model with Django Unfold styling."""

    list_display = ('email', 'username', 'is_active', 'is_staff', 'date_joined', 'get_reset_tokens_count')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('username', 'first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2'),
        }),
    )

    def get_reset_tokens_count(self, obj):
        """Display count of password reset tokens for the user."""
        count = obj.reset_tokens.count()
        return format_html('<span style="color: #000000; font-weight: bold;">{}</span>', count)

    get_reset_tokens_count.short_description = 'Reset Tokens'


class PasswordResetTokenAdmin(ModelAdmin):
    """Admin configuration for PasswordResetToken model with Django Unfold."""

    list_display = ('user', 'token_short', 'created_at', 'expires_at', 'is_valid_display', 'used')
    list_filter = ('used', 'created_at', 'expires_at')
    search_fields = ('user__email', 'token')
    readonly_fields = ('token', 'created_at', 'expires_at')
    ordering = ('-created_at',)

    def token_short(self, obj):
        """Display shortened token for readability."""
        return obj.token[:12] + '...'
    token_short.short_description = 'Token'

    def is_valid_display(self, obj):
        """Display whether the token is still valid with color coding."""
        if obj.used:
            return format_html('<span style="color: #dc3545;">Used</span>')
        if not obj.is_valid():
            return format_html('<span style="color: #ffc107;">Expired</span>')
        return format_html('<span style="color: #28a745;">Valid</span>')
    is_valid_display.short_description = 'Status'


# Register models with admin

class WalletAssetAdmin(ModelAdmin):
    """Admin configuration for WalletAsset model with Django Unfold."""

    list_display = ('user', 'ticker', 'name', 'quantity', 'available_quantity', 'locked_quantity', 'updated_at')
    list_filter = ('ticker', 'updated_at')
    search_fields = ('user__email', 'user__username', 'ticker')
    ordering = ('-updated_at',)


class UserHistoricalSnapshotAdmin(ModelAdmin):
    """Admin configuration for UserHistoricalSnapshot model with Django Unfold."""

    list_display = ('user', 'snapshot_time', 'total_balance', 'performance24h')
    list_filter = ('snapshot_time',)
    search_fields = ('user__email', 'user__username')
    ordering = ('-snapshot_time',)
    readonly_fields = ('snapshot_time',)


admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(PasswordResetToken, PasswordResetTokenAdmin)
admin.site.register(WalletAsset, WalletAssetAdmin)
admin.site.register(UserHistoricalSnapshot, UserHistoricalSnapshotAdmin)
