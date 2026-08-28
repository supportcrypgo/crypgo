from django.urls import path
from .views import (
    ForgotPasswordView,
    ResetPasswordConfirmView,
    ResetPasswordUpdateView,
    CurrentUserView,
    MyWalletListView,
    MyWalletAssetUpdateView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserCreateView,
    AdminUserUpdateView,
    AdminUserDeleteView,
    AdminUserWalletListView,
    AdminUserWalletAssetUpdateView,
    MySnapshotListView,
    MySnapshotCreateView,
    MySnapshotDeleteView,
    AdminUserSnapshotListView,
    AdminUserSnapshotCreateView,
    LoginView,
    MagicLinkRequestView,
    MagicLinkConsumeView,
    MagicLinkPasswordChangeView,
    CampaignAccessConsumeView,
    export_campaign_recipients,
    RegisterView,
    LogoutView,
    RefreshTokenView,
    ChangePasswordView,
    EmailPreferenceView,
    MySessionListView,
    MySessionRevokeView,
    MySessionRevokeAllView,
    AvatarUploadView,
    MyKYCDocumentListView,
    MyKYCDocumentCreateView,
    MyKYCDocumentDeleteView,
    MyActivityLogListView,
    AdminKYCDocumentListView,
    AdminKYCDocumentReviewView,
    AdminUserActivityLogListView,
    # New wallet action views
    DepositAddressView,
    QRCodeView,
    WithdrawView,
    WithdrawCompleteView,
    TransferView,
    BuyCryptoView,
    SwapCryptoView,
    SimulateDepositView,
    MyTransactionListView,
    TwoFASetupView,
    TwoFAVerifyView,
    TwoFADisableView,
    # Notifications
    NotificationListView,
    UnreadNotificationCountView,
    MarkNotificationReadView,
    DeleteNotificationView,
    PushSubscriptionView,
    DeletePushSubscriptionView,
    # Security
    DeviceFingerprintView,
    VerifyDeviceLocationView,
    RequestBrowserLocationView,
    SearchUsersByIdView,
    SearchUsersByNameView,
    SecurityHealthView,
    # Transaction Translations
    CreateTransactionTranslationView,
    TransactionTranslationListView,
    # Internal Transfers
    InternalTransferListView,
    InternalTransferDetailView,
    UserReportDownloadView,
    AdminUserReportDownloadView,
)

app_name = 'users'

urlpatterns = [
    # Auth - Login/Registration/Logout/Refresh
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/magic-link/request/', MagicLinkRequestView.as_view(), name='magic-link-request'),
    path('auth/magic-link/consume/', MagicLinkConsumeView.as_view(), name='magic-link-consume'),
    path('auth/magic-link/reset-password/', MagicLinkPasswordChangeView.as_view(), name='magic-link-reset-password'),
    path('auth/campaign-access/consume/', CampaignAccessConsumeView.as_view(), name='campaign-access-consume'),
    path('internal/campaigns/<str:campaign_ref>/recipients/export/', export_campaign_recipients, name='export-campaign-recipients'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', RefreshTokenView.as_view(), name='refresh-token'),

    # Auth - Password Reset
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('auth/reset-password/confirm/', ResetPasswordConfirmView.as_view(), name='reset-password-confirm'),
    path('auth/reset-password/update/', ResetPasswordUpdateView.as_view(), name='reset-password-update'),

    # Auth - Password Change (authenticated)
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),

    # User profile
    path('users/me/', CurrentUserView.as_view(), name='user-me'),
    path('users/report/', UserReportDownloadView.as_view(), name='user-report'),

    # Email Preferences
    path('users/email-preferences/', EmailPreferenceView.as_view(), name='email-preferences'),

    # Wallet (authenticated user)
    path('wallet/assets/', MyWalletListView.as_view(), name='my-wallet'),
    path('wallet/assets/<int:pk>/', MyWalletAssetUpdateView.as_view(), name='my-wallet-asset-update'),

    # Wallet Actions
    path('wallet/deposit-address/', DepositAddressView.as_view(), name='deposit-address'),
    path('wallet/qrcode/', QRCodeView.as_view(), name='wallet-qrcode'),
    path('wallet/withdraw/', WithdrawView.as_view(), name='withdraw'),
    path('wallet/withdraw/complete/<str:txid>/', WithdrawCompleteView.as_view(), name='withdraw-complete'),
    path('wallet/transfer/', TransferView.as_view(), name='transfer'),
    path('wallet/buy/', BuyCryptoView.as_view(), name='buy-crypto'),
    path('wallet/swap/', SwapCryptoView.as_view(), name='swap-crypto'),
    path('wallet/simulate-deposit/', SimulateDepositView.as_view(), name='simulate-deposit'),
    path('wallet/transactions/', MyTransactionListView.as_view(), name='my-transactions'),

    # User Sessions (Device Sessions)
    path('users/sessions/', MySessionListView.as_view(), name='my-sessions'),
    path('users/sessions/<int:pk>/', MySessionRevokeView.as_view(), name='my-sessions-revoke'),
    path('users/sessions/revoke-all/', MySessionRevokeAllView.as_view(), name='my-sessions-revoke-all'),

    # KYC Documents
    path('users/kyc-documents/', MyKYCDocumentListView.as_view(), name='my-kyc-documents'),
    path('users/kyc-documents/upload/', MyKYCDocumentCreateView.as_view(), name='my-kyc-documents-upload'),
    path('users/kyc-documents/<int:pk>/', MyKYCDocumentDeleteView.as_view(), name='my-kyc-documents-delete'),

    # Avatar upload
    path('users/avatar/', AvatarUploadView.as_view(), name='user-avatar'),

    # 2FA endpoints
    path('users/2fa/setup/', TwoFASetupView.as_view(), name='2fa-setup'),
    path('users/2fa/verify/', TwoFAVerifyView.as_view(), name='2fa-verify'),
    path('users/2fa/disable/', TwoFADisableView.as_view(), name='2fa-disable'),

    # Activity Log
    path('users/activity-log/', MyActivityLogListView.as_view(), name='my-activity-log'),

    # Admin: user management
    path('admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/create/', AdminUserCreateView.as_view(), name='admin-user-create'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/update/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('admin/users/<int:pk>/delete/', AdminUserDeleteView.as_view(), name='admin-user-delete'),
    path('admin/users/<int:user_id>/report/', AdminUserReportDownloadView.as_view(), name='admin-user-report'),

    # Admin: wallet management
    path('admin/users/<int:user_id>/wallet/', AdminUserWalletListView.as_view(), name='admin-user-wallet'),
    path('admin/users/<int:user_id>/wallet/<str:ticker>/', AdminUserWalletAssetUpdateView.as_view(), name='admin-user-wallet-asset-update'),

    # Admin: KYC management
    path('admin/kyc-documents/', AdminKYCDocumentListView.as_view(), name='admin-kyc-documents'),
    path('admin/kyc-documents/<int:pk>/review/', AdminKYCDocumentReviewView.as_view(), name='admin-kyc-documents-review'),

    # User snapshots
    path('wallet/snapshots/', MySnapshotListView.as_view(), name='my-snapshots'),
    path('wallet/snapshots/create/', MySnapshotCreateView.as_view(), name='my-snapshots-create'),
    path('wallet/snapshots/<int:pk>/', MySnapshotDeleteView.as_view(), name='my-snapshots-delete'),

    # Admin: user snapshots
    path('admin/users/<int:user_id>/snapshots/', AdminUserSnapshotListView.as_view(), name='admin-user-snapshots'),
    path('admin/users/<int:user_id>/snapshots/create/', AdminUserSnapshotCreateView.as_view(), name='admin-user-snapshots-create'),

    # Admin: user activity log
    path('admin/users/<int:user_id>/activity-log/', AdminUserActivityLogListView.as_view(), name='admin-user-activity-log'),

    # Notifications
    path('users/notifications/', NotificationListView.as_view(), name='notifications'),
    path('users/notifications/unread-count/', UnreadNotificationCountView.as_view(), name='unread-notification-count'),
    path('users/notifications/mark-read/', MarkNotificationReadView.as_view(), name='mark-notifications-read'),
    path('users/notifications/<int:pk>/', DeleteNotificationView.as_view(), name='delete-notification'),
    path('users/notifications/push-subscription/', PushSubscriptionView.as_view(), name='push-subscription'),
    path('users/notifications/push-subscription/<int:pk>/', DeletePushSubscriptionView.as_view(), name='delete-push-subscription'),

    # Security
    path('users/security/devices/', DeviceFingerprintView.as_view(), name='device-fingerprint'),
    path('users/security/devices/verify-location/', VerifyDeviceLocationView.as_view(), name='verify-device-location'),
    path('users/security/browser-location-request/', RequestBrowserLocationView.as_view(), name='browser-location-request'),
    path('users/security/search-by-id/', SearchUsersByIdView.as_view(), name='search-users-by-id'),
    path('users/security/search-by-name/', SearchUsersByNameView.as_view(), name='search-users-by-name'),
    path('users/security/health/', SecurityHealthView.as_view(), name='security-health'),

    # Transaction Translations
    path('transactions/<str:txid>/translations/', TransactionTranslationListView.as_view(), name='transaction-translations'),
    path('transactions/<str:txid>/translations/create/', CreateTransactionTranslationView.as_view(), name='create-transaction-translation'),

    # Internal Transfers
    path('wallet/internal-transfers/', InternalTransferListView.as_view(), name='internal-transfers'),
    path('wallet/internal-transfers/<int:pk>/', InternalTransferDetailView.as_view(), name='internal-transfer-detail'),
]
