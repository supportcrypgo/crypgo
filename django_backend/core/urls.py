from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def health_check(request):
    return HttpResponse('OK', status=200)


def api_root(request):
    """Root API endpoint that manually builds API root with all available endpoints"""
    
    root_content = {
        # Auth endpoints
        "auth/login": {
            "POST": "https://crypgo-api.onrender.com/api/auth/login/",
            "description": "Login with email/password"
        },
        "auth/register": {
            "POST": "https://crypgo-api.onrender.com/api/auth/register/",
            "description": "Create a new user account"
        },
        "auth/logout": {
            "POST": "https://crypgo-api.onrender.com/api/auth/logout/",
            "description": "Logout and clear auth cookies"
        },
        "auth/refresh": {
            "POST": "https://crypgo-api.onrender.com/api/auth/refresh/",
            "description": "Refresh access token using refresh token"
        },
        "auth/magic-link/request": {
            "POST": "https://crypgo-api.onrender.com/api/auth/magic-link/request/",
            "description": "Request magic link sign-in"
        },
        "auth/magic-link/consume": {
            "POST": "https://crypgo-api.onrender.com/api/auth/magic-link/consume/",
            "description": "Consume magic link to sign in"
        },
        "auth/campaign-access/consume": {
            "POST": "https://crypgo-api.onrender.com/api/auth/campaign-access/consume/",
            "description": "Consume campaign access link"
        },
        "auth/forgot-password": {
            "POST": "https://crypgo-api.onrender.com/api/auth/forgot-password/",
            "description": "Request password reset email"
        },
        "auth/reset-password/confirm": {
            "GET": "https://crypgo-api.onrender.com/api/auth/reset-password/confirm/",
            "description": "Validate password reset token"
        },
        "auth/reset-password/update": {
            "POST": "https://crypgo-api.onrender.com/api/auth/reset-password/update/",
            "description": "Update password with reset token"
        },
        "auth/change-password": {
            "POST": "https://crypgo-api.onrender.com/api/auth/change-password/",
            "description": "Change authenticated user's password"
        },
        # User profile
        "users/me": {
            "GET": "https://crypgo-api.onrender.com/api/users/me/",
            "PUT": "https://crypgo-api.onrender.com/api/users/me/",
            "description": "Get or update authenticated user's profile"
        },
        "users/email-preferences": {
            "GET": "https://crypgo-api.onrender.com/api/users/email-preferences/",
            "PUT": "https://crypgo-api.onrender.com/api/users/email-preferences/",
            "description": "Get or update email notification preferences"
        },
        "users/sessions": {
            "GET": "https://crypgo-api.onrender.com/api/users/sessions/",
            "description": "List authenticated user's device sessions"
        },
        "users/sessions/<id>/": {
            "DELETE": "https://crypgo-api.onrender.com/api/users/sessions/<id>/",
            "description": "Revoke a specific session"
        },
        "users/sessions/revoke-all": {
            "POST": "https://crypgo-api.onrender.com/api/users/sessions/revoke-all/",
            "description": "Revoke all sessions except current"
        },
        "users/kyc-documents": {
            "GET": "https://crypgo-api.onrender.com/api/users/kyc-documents/",
            "description": "List authenticated user's KYC documents"
        },
        "users/kyc-documents/upload": {
            "POST": "https://crypgo-api.onrender.com/api/users/kyc-documents/upload/",
            "description": "Upload a KYC document"
        },
        "users/avatar": {
            "POST": "https://crypgo-api.onrender.com/api/users/avatar/",
            "description": "Upload user avatar"
        },
        "users/2fa/setup": {
            "POST": "https://crypgo-api.onrender.com/api/users/2fa/setup/",
            "description": "Setup 2FA authentication"
        },
        "users/2fa/verify": {
            "POST": "https://crypgo-api.onrender.com/api/users/2fa/verify/",
            "description": "Verify 2FA code"
        },
        "users/2fa/disable": {
            "POST": "https://crypgo-api.onrender.com/api/users/2fa/disable/",
            "description": "Disable 2FA authentication"
        },
        # Wallet
        "wallet/assets": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/assets/",
            "description": "Return authenticated user's wallet assets"
        },
        "wallet/assets/<id>/": {
            "PUT": "https://crypgo-api.onrender.com/api/wallet/assets/<id>/",
            "description": "Update a single asset quantity"
        },
        "wallet/deposit-address": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/deposit-address/",
            "description": "Get deposit address for a coin"
        },
        "wallet/qrcode": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/qrcode/",
            "description": "Get QR code for deposit address"
        },
        "wallet/withdraw": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/withdraw/",
            "description": "Request withdrawal"
        },
        "wallet/withdraw/complete/<txid>/": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/withdraw/complete/<txid>/",
            "description": "Complete withdrawal (admin only, in some flows)"
        },
        "wallet/transfer": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/transfer/",
            "description": "Transfer between your assets"
        },
        "wallet/buy": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/buy/",
            "description": "Buy cryptocurrency using fiat"
        },
        "wallet/swap": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/swap/",
            "description": "Swap one asset for another"
        },
        "wallet/simulate-deposit": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/simulate-deposit/",
            "description": "Simulate incoming deposit (testing mode)"
        },
        "wallet/transactions": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/transactions/",
            "description": "List user transaction history"
        },
        "wallet/snapshots": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/snapshots/",
            "description": "List user portfolio snapshots"
        },
        "wallet/snapshots/create": {
            "POST": "https://crypgo-api.onrender.com/api/wallet/snapshots/create/",
            "description": "Create a new portfolio snapshot"
        },
        "wallet/snapshots/<id>/": {
            "DELETE": "https://crypgo-api.onrender.com/api/wallet/snapshots/<id>/",
            "description": "Delete a snapshot"
        },
        "wallet/internal-transfers": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/internal-transfers/",
            "description": "List internal transfers"
        },
        "wallet/internal-transfers/<id>/": {
            "GET": "https://crypgo-api.onrender.com/api/wallet/internal-transfers/<id>/",
            "description": "Get detail of internal transfer"
        },
        # Public endpoints (no auth required)
        "users/activity-log": {
            "GET": "https://crypgo-api.onrender.com/api/users/activity-log/",
            "description": "List user activity logs",
            "requires_auth": False
        },
        "admin/users": {
            "GET": "https://crypgo-api.onrender.com/api/admin/users/",
            "description": "List all users (admin only)",
            "requires_auth": True,
            "requires_admin": True
        },
        "admin/users/<id>/": {
            "GET": "https://crypgo-api.onrender.com/api/admin/users/<id>/",
            "description": "Get user details (admin only)",
            "requires_auth": True,
            "requires_admin": True
        },
        "admin/users/<id>/wallet/": {
            "GET": "https://crypgo-api.onrender.com/api/admin/users/<id>/wallet/",
            "description": "View user's wallet assets (admin only)",
            "requires_auth": True,
            "requires_admin": True
        },
        "admin/users/<id>/wallet/<ticker>/": {
            "PUT": "https://crypgo-api.onrender.com/api/admin/users/<id>/wallet/<ticker>/",
            "description": "Admin update user's asset (admin only)",
            "requires_auth": True,
            "requires_admin": True
        },
    }
    
    return JsonResponse(root_content, status=200)


urlpatterns = [
    path('', api_root, name='root'),
    re_path(r'^api/$', api_root, name='api-root'),
    path('api/', include('apps.users.urls')),
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),
]

if settings.DEBUG:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]

    # Serve media files during development
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
