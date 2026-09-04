from typing import Any, cast

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions, serializers
from rest_framework.request import Request
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from .models import (
    CustomUser,
    PasswordResetToken, MagicLinkToken, CampaignAccessToken, WalletAsset, UserHistoricalSnapshot, UserSession, KYCDocument,
    UserActivityLog, Transaction,
    Notification, PushSubscription, DeviceFingerprint,
    TransactionTranslation, InternalTransfer,
)
from .serializers import (
    LoginSerializer, RegisterSerializer, ChangePasswordSerializer,
    EmailPreferenceSerializer, ForgotPasswordSerializer, ResetPasswordUpdateSerializer,
    WalletAssetSerializer, UserCreateSerializer, WalletAssetUpdateSerializer,
    UserHistoricalSnapshotSerializer, UserSerializer, UserSessionSerializer,
    KYCDocumentSerializer, UserActivityLogSerializer, DepositSerializer, WithdrawSerializer,
    TransactionSerializer, TransferSerializer, BuySerializer, SwapSerializer, NotificationSerializer,
    MarkNotificationReadSerializer, SubscribePushSerializer, PushSubscriptionSerializer,
    VerifyDeviceLocationSerializer, RequestBrowserLocationSerializer, DeviceFingerprintSerializer,
    SearchUsersByIdSerializer, SearchUsersByNameSerializer, TransactionTranslationSerializer,
    InternalTransferSerializer, ResetPasswordConfirmSerializer, TwoFASetupSerializer,
    TwoFAVerifySerializer, TwoFADisableSerializer, AvatarUploadSerializer,
)
from .services import send_reset_password_email, send_magic_link_email, build_campaign_access_url
import logging
import time
import hashlib
import hmac
from decimal import Decimal
from datetime import timedelta
from django.db import transaction, models
from django.utils.crypto import get_random_string

logger = logging.getLogger(__name__)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
import os
import io
from PIL import Image
import pyotp
import base64
import qrcode  # type: ignore[reportMissingModuleSource]
from qrcode.constants import ERROR_CORRECT_L  # type: ignore[reportMissingModuleSource]

User = get_user_model()


def issue_auth_response(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    refresh_token_obj = cast(Any, refresh)
    access_token = str(refresh_token_obj.access_token)
    refresh_token = str(refresh)
    response = Response({
        'success': True,
        'user': UserSerializer(user).data,
        'access_token': access_token,
    }, status=status.HTTP_200_OK)
    cookie_settings = getattr(settings, 'SIMPLE_JWT', {})
    response.set_cookie('access_token', access_token, httponly=True,
                        secure=cookie_settings.get('AUTH_COOKIE_SECURE', False),
                        samesite=cookie_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
                        max_age=15 * 60, path='/')
    response.set_cookie('refresh_token', refresh_token, httponly=True,
                        secure=cookie_settings.get('AUTH_COOKIE_SECURE', False),
                        samesite=cookie_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
                        max_age=7 * 24 * 60 * 60, path='/')
    return response


def get_validated_data(serializer: Any) -> dict[str, Any]:
    """Return validated data as a reliable dictionary for downstream type checking."""
    validated = getattr(serializer, 'validated_data', None)
    if not isinstance(validated, dict):
        return {}
    return cast(dict[str, Any], validated)


def get_request_data(request: Request) -> dict[str, Any]:
    """Normalize DRF request payloads so missing or empty bodies are treated as empty dictionaries."""
    payload = request.data
    if payload is None:
        return {}
    if isinstance(payload, dict):
        return payload
    return cast(dict[str, Any], payload)


# ---------- Permission helpers ----------

class IsAdminUser(permissions.BasePermission):
    """Grant access only to admin users (staff)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff


def build_user_report_response(user):
    from django.utils.text import slugify
    from generate_user_report import generate_user_report_bytes

    report_bytes = generate_user_report_bytes(user)
    report_date = timezone.now().strftime('%Y-%m-%d')
    user_identifier = slugify(user.public_id or str(user.pk)) or str(user.pk)
    response = HttpResponse(report_bytes, content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="Crypgo_Portfolio_Report_{user_identifier}_{report_date}.pdf"'
    )
    return response


class UserReportDownloadView(APIView):
    """GET /api/users/report/ - Download the authenticated user's PDF report."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return build_user_report_response(request.user)


class AdminUserReportDownloadView(APIView):
    """GET /api/admin/users/<user_id>/report/ - Download a user's report as an admin."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request: Request, user_id: int):
        target_user = get_object_or_404(User, pk=user_id)
        return build_user_report_response(target_user)


# ---------- Auth Login/Registration ----------

class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticate user and return JWT tokens as http-only cookies.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        summary="Login",
        description="Authenticate with email/password. JWT tokens returned as http-only cookies.",
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Login successful"),
            400: OpenApiResponse(description="Invalid input"),
            401: OpenApiResponse(description="Invalid credentials"),
        },
        tags=["auth"]
    )
    def post(self, request: Request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        user = validated_data.get('user')
        if user is None:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)
        return issue_auth_response(user)


class MagicLinkRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request: Request):
        try:
            serializer = ForgotPasswordSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            email = get_validated_data(serializer)['email']
            user = User.objects.filter(email__iexact=email, is_active=True).first()
            
            if user:
                try:
                    _, raw_token = MagicLinkToken.generate_token(user)
                    email_sent = send_magic_link_email(user, raw_token)
                    if not email_sent:
                        logger.error(f'Failed to send magic link email to {user.email}')
                        return Response(
                            {'error': 'Failed to send email. Please try again later.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                except Exception as e:
                    logger.exception(f'Error generating or sending magic link to {email}: {str(e)}')
                    return Response(
                        {'error': 'An error occurred while processing your request.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Always return success message (don't reveal if email exists)
            return Response({
                'success': True,
                'message': 'If an account exists with this email, a sign-in link has been sent.'
            })
        except Exception as e:
            logger.exception(f'Unexpected error in MagicLinkRequestView: {str(e)}')
            return Response(
                {'error': 'An unexpected error occurred.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MagicLinkConsumeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request: Request):
        try:
            raw_token = get_request_data(request).get('token')
            if not isinstance(raw_token, str) or not raw_token:
                return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            try:
                with transaction.atomic():
                    token = MagicLinkToken.objects.select_for_update().select_related('user').get(token_hash=token_hash)
                    if not token.is_valid():
                        logger.warning(f'Expired or already-used magic link token attempted for user {token.user.email}')
                        return Response({'error': 'Sign-in link has expired or already been used.'}, status=status.HTTP_400_BAD_REQUEST)
                    if not token.user.is_active:
                        logger.warning(f'Magic link used for inactive user {token.user.email}')
                        return Response({'error': 'User account is not active.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    token.used_at = timezone.now()
                    token.save(update_fields=['used_at'])
                    
                    # Issue auth response
                    auth_response = issue_auth_response(token.user)
                    if isinstance(auth_response, Response) and auth_response.status_code >= 400:
                        logger.error(f'Failed to issue auth response for user {token.user.email}')
                        return Response(
                            {'error': 'Failed to authenticate. Please try signing in again.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                    logger.info(f'Successful magic link login for user {token.user.email}')
                    return auth_response
                    
            except MagicLinkToken.DoesNotExist:
                logger.warning(f'Invalid magic link token attempted: {token_hash[:20]}...')
                return Response({'error': 'Invalid or expired sign-in link.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f'Unexpected error in MagicLinkConsumeView: {str(e)}')
            return Response(
                {'error': 'An unexpected error occurred during sign-in.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CampaignAccessConsumeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request: Request):
        raw_token = get_request_data(request).get('token')
        if not isinstance(raw_token, str) or not raw_token:
            return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        try:
            with transaction.atomic():
                token = CampaignAccessToken.objects.select_for_update().select_related('user').get(token_hash=token_hash)
                if not token.user.is_active or not token.is_valid():
                    raise CampaignAccessToken.DoesNotExist
                if not token.consume():
                    raise CampaignAccessToken.DoesNotExist
        except CampaignAccessToken.DoesNotExist:
            return Response({'error': 'Invalid or expired campaign link.'}, status=status.HTTP_400_BAD_REQUEST)
        return issue_auth_response(token.user)


@api_view(['POST'])
@permission_classes([AllowAny])
def export_campaign_recipients(request, campaign_ref):
    print(f'DEBUG: Received signature: {request.headers.get("X-Bot-Signature", "")!r}')
    print(f'DEBUG: Request body: {request.body!r}')
    print(f'DEBUG: BOT_SERVICE_KEY: {settings.BOT_SERVICE_KEY!r}')
    
    signature = request.headers.get('X-Bot-Signature', '')
    expected = hmac.new(
        settings.BOT_SERVICE_KEY.encode('utf-8'), request.body, hashlib.sha256
    ).hexdigest()
    print(f'DEBUG: Expected signature: {expected}')
    print(f'DEBUG: Match: {hmac.compare_digest(signature, expected)}')
    
    if not settings.BOT_SERVICE_KEY or not hmac.compare_digest(signature, expected):
        print('DEBUG: Authorization failed')
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    recipients = []
    for user in User.objects.filter(is_active=True).order_by('pk'):
        user = cast(CustomUser, user)
        recipients.append({
            'external_user_id': user.public_id or str(user.pk),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'dashboard_url': build_campaign_access_url(user, str(campaign_ref)),
        })
    return Response({'recipients': recipients})


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Create a new user account.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'register'

    @extend_schema(
        summary="Register",
        description="Create a new user account. Passwords are hashed on the backend.",
        request=RegisterSerializer,
        responses={
            201: OpenApiResponse(description="User created successfully"),
            400: OpenApiResponse(description="Invalid input"),
        },
        tags=["auth"]
    )
    def post(self, request: Request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'success': True,
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklist refresh token and clear auth cookies.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Logout",
        description="Blacklist the refresh token and clear http-only cookies.",
        responses={200: OpenApiResponse(description="Logout successful")},
        tags=["auth"]
    )
    def post(self, request: Request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError

        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass

        response = Response({'success': True, 'message': 'Logged out successfully'})
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


class RefreshTokenView(APIView):
    """
    POST /api/auth/refresh/
    Refresh the access token using the http-only refresh token cookie.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Refresh token",
        description="Refresh the access token using the http-only refresh token cookie.",
        responses={200: OpenApiResponse(description="Token refreshed")},
        tags=["auth"]
    )
    def post(self, request: Request):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError

        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'No refresh token provided'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            token = RefreshToken(refresh_token)
            access_token = str(getattr(token, 'access_token', ''))

            response = Response({
                'success': True,
                'access_token': access_token,
            })
            
            from django.conf import settings
            cookie_secure = getattr(settings, 'SIMPLE_JWT', {}).get('AUTH_COOKIE_SECURE', False)
            cookie_samesite = getattr(settings, 'SIMPLE_JWT', {}).get('AUTH_COOKIE_SAMESITE', 'Lax')

            response.set_cookie(
                'access_token',
                access_token,
                httponly=True,
                secure=cookie_secure,
                samesite=cookie_samesite,
                max_age=15 * 60,
                path='/',
            )
            return response
        except TokenError:
            return Response({'error': 'Invalid or expired refresh token'}, status=status.HTTP_401_UNAUTHORIZED)


# ---------- Password Change ----------

class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Change the authenticated user's password.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Change password",
        description="Change the authenticated user's password. Requires current password.",
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed successfully"),
            400: OpenApiResponse(description="Invalid input or current password incorrect"),
        },
        tags=["auth"]
    )
    def post(self, request: Request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Invalidate existing refresh tokens by blacklisting
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass

        response = Response({
            'success': True,
            'message': 'Password changed successfully. Please log in again.'
        })
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


# ---------- Email Preferences ----------

class EmailPreferenceView(APIView):
    """
    GET/PUT /api/users/email-preferences/
    Get or update the authenticated user's email notification preferences.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get email preferences",
        description="Get the authenticated user's current email notification preferences.",
        responses={200: EmailPreferenceSerializer},
        tags=["users"]
    )
    def get(self, request: Request):
        preferences = request.user.get_email_preferences()
        serializer = EmailPreferenceSerializer(data=preferences)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

    @extend_schema(
        summary="Update email preferences",
        description="Update the authenticated user's email notification preferences.",
        request=EmailPreferenceSerializer,
        responses={200: EmailPreferenceSerializer},
        tags=["users"]
    )
    def put(self, request: Request):
        serializer = EmailPreferenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        preferences = request.user.update_email_preferences(serializer.validated_data)
        return Response(preferences)


# ---------- Auth / Password Reset ----------

class ForgotPasswordView(APIView):
    """
    API endpoint for requesting a password reset.

    POST /api/auth/forgot-password/
    Request: { "email": "user@example.com" }
    Response: { "success": true, "message": "Reset link sent if email exists" }
    """

    permission_classes = []
    throttle_scope = 'password_reset'

    @extend_schema(
        summary="Request password reset",
        description="Send a password reset email to the user if the email exists in the system.",
        request=ForgotPasswordSerializer,
        responses={
            200: OpenApiResponse(
                response={
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "message": {"type": "string"}
                    }
                },
                description="Reset link sent successfully"
            ),
            400: OpenApiResponse(
                description="Invalid request"
            ),
        },
        tags=["auth"]
    )
    def post(self, request: Request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        email = validated_data['email']

        try:
            user = User.objects.get(email=email)

            reset_token = PasswordResetToken.generate_token(user)

            email_sent = send_reset_password_email(user, reset_token)

            if not email_sent:
                print(f"Failed to send password reset email to {email}")

        except User.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': 'If an account exists with this email, a reset link has been sent.'
        }, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(APIView):
    """
    API endpoint for validating a reset token.

    GET /api/auth/reset-password/confirm/?token=abc123
    Response: { "valid": true, "user": { "email": "..." } }
    """

    permission_classes = []
    throttle_scope = 'password_reset'

    @extend_schema(
        summary="Validate reset token",
        description="Check if a password reset token is valid and not expired.",
        parameters=[
            OpenApiParameter(
                name="token",
                description="The password reset token from the email",
                required=True,
                type=str,
                location=OpenApiParameter.QUERY
            )
        ],
        responses={
            200: OpenApiResponse(
                response={
                    "type": "object",
                    "properties": {
                        "valid": {"type": "boolean"},
                        "user": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "integer"},
                                "email": {"type": "string"},
                                "username": {"type": "string"},
                                "date_joined": {"type": "string"}
                            }
                        }
                    }
                },
                description="Token validation result"
            ),
            400: OpenApiResponse(
                description="Token missing or invalid"
            ),
            404: OpenApiResponse(
                description="Token not found"
            ),
        },
        tags=["auth"]
    )
    def get(self, request: Request):
        token = request.GET.get('token')

        if not token:
            return Response({
                'valid': False,
                'error': 'Token is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            reset_token = PasswordResetToken.objects.get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Invalid token'
            }, status=status.HTTP_404_NOT_FOUND)

        if not reset_token.is_valid():
            return Response({
                'valid': False,
                'error': 'Token has expired or has been used'
            }, status=status.HTTP_400_BAD_REQUEST)

        user_serializer = UserSerializer(reset_token.user)

        return Response({
            'valid': True,
            'user': user_serializer.data
        }, status=status.HTTP_200_OK)


class ResetPasswordUpdateView(APIView):
    """
    API endpoint for updating password with reset token.

    POST /api/auth/reset-password/update/
    Request: {
        "token": "abc123",
        "new_password": "newpass123",
        "confirm_password": "newpass123"
    }
    Response: { "success": true, "message": "Password updated successfully" }
    """

    permission_classes = []
    throttle_scope = 'password_reset'

    @extend_schema(
        summary="Update password with reset token",
        description="Set a new password using a valid password reset token.",
        request=ResetPasswordUpdateSerializer,
        responses={
            200: OpenApiResponse(
                response={
                    "type": "object",
                    "properties": {
                        "success": {"type": "boolean"},
                        "message": {"type": "string"}
                    }
                },
                description="Password updated successfully"
            ),
            400: OpenApiResponse(
                description="Invalid request"
            ),
            404: OpenApiResponse(
                description="Token not found"
            ),
        },
        tags=["auth"]
    )
    def post(self, request: Request):
        try:
            serializer = ResetPasswordUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            validated_data = get_validated_data(serializer)
            token = validated_data['token']
            new_password = validated_data['new_password']

            try:
                reset_token = PasswordResetToken.objects.get(token=token)
            except PasswordResetToken.DoesNotExist:
                logger.warning(f'Invalid password reset token attempted: {token[:20]}...')
                return Response(
                    {'error': 'Invalid or expired reset token.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if token is valid and not already used
            if not reset_token.is_valid():
                logger.warning(f'Expired password reset token for user {reset_token.user.email}')
                return Response(
                    {'error': 'Reset link has expired or already been used.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                with transaction.atomic():
                    user = reset_token.user
                    user.set_password(new_password)
                    user.save()
                    
                    reset_token.mark_used()
                    logger.info(f'Password successfully reset for user {user.email}')
                    
                return Response({
                    'success': True,
                    'message': 'Password updated successfully. Please sign in with your new password.'
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.exception(f'Error updating password for user: {str(e)}')
                return Response(
                    {'error': 'Failed to update password. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception as e:
            logger.exception(f'Unexpected error in ResetPasswordUpdateView: {str(e)}')
            return Response(
                {'error': 'An unexpected error occurred.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ---------- User Profile ----------

class CurrentUserView(generics.RetrieveUpdateAPIView):
    """GET/PUT /api/users/me/ — Return and update the authenticated user's profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = 'user_me'

    def get_object(self):
        return self.request.user

    def put(self, request, *args, **kwargs):
        user = self.get_object()
        data = request.data.copy()
        field_map = {
            'firstName': 'first_name',
            'lastName': 'last_name',
            'location': 'country',
        }
        for source, target in field_map.items():
            if source in data and target not in data:
                data[target] = data[source]
        serializer = self.get_serializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ---------- Authenticated Wallet ----------

class MyWalletListView(generics.ListAPIView):
    """GET /api/wallet/assets/ — Return authenticated user's wallet assets."""
    serializer_class = WalletAssetSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = 'wallet_assets'

    def get_queryset(self):
        return WalletAsset.objects.filter(user=self.request.user)


class MyWalletAssetUpdateView(generics.UpdateAPIView):
    """
    PUT /api/wallet/assets/<id>/ — Update a single asset quantity (e.g. after rebalance).
    Only allowed for the asset's owner or an admin.
    """
    serializer_class = WalletAssetUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WalletAsset.objects.filter(user=self.request.user)


# ---------- Admin: User Management ----------

class AdminUserListView(generics.ListAPIView):
    """GET /api/admin/users/ — List all users (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class AdminUserDetailView(generics.RetrieveAPIView):
    """GET /api/admin/users/<id>/ — Get a specific user's profile (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class AdminUserCreateView(generics.CreateAPIView):
    """POST /api/admin/users/ — Create a new user (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class AdminUserUpdateView(generics.UpdateAPIView):
    """PUT /api/admin/users/<id>/ — Update a user's profile (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class AdminUserDeleteView(generics.DestroyAPIView):
    """DELETE /api/admin/users/<id>/ — Delete a user (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


# ---------- Admin: Wallet Management ----------

class AdminUserWalletListView(generics.ListAPIView):
    """GET /api/admin/users/<user_id>/wallet/ — View a specific user's wallet (admin only)."""
    serializer_class = WalletAssetSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return WalletAsset.objects.filter(user_id=user_id)


class AdminUserWalletAssetUpdateView(APIView):
    """
    PUT /api/admin/users/<user_id>/wallet/<ticker>/ — Admin edits a user's asset by ticker.
    Accepts partial update of quantity, available_quantity, locked_quantity.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        summary="Admin update user wallet asset",
        description="Update a specific asset quantities for a given user by ticker. Admin only.",
        request=WalletAssetUpdateSerializer,
        responses={200: WalletAssetSerializer},
        tags=["admin"],
    )
    def put(self, request, user_id, ticker):
        asset = get_object_or_404(WalletAsset, ticker=ticker.upper(), user_id=user_id)
        serializer = WalletAssetUpdateSerializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WalletAssetSerializer(asset).data, status=status.HTTP_200_OK)


# ---------- User Historical Snapshots ----------

class MySnapshotListView(generics.ListAPIView):
    """
    GET /api/wallet/snapshots/ — List authenticated user's own snapshots.
    """

    serializer_class = UserHistoricalSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserHistoricalSnapshot.objects.filter(user=self.request.user)


class MySnapshotCreateView(generics.CreateAPIView):
    """
    POST /api/wallet/snapshots/ — Create a snapshot for the authenticated user.
    The API auto-computes user from request.user.
    """

    serializer_class = UserHistoricalSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MySnapshotDeleteView(generics.DestroyAPIView):
    """
    DELETE /api/wallet/snapshots/<id>/ — Delete one of the authenticated user's own snapshots.
    """

    serializer_class = UserHistoricalSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserHistoricalSnapshot.objects.filter(user=self.request.user)


# ---------- Admin: User Snapshots ----------

class AdminUserSnapshotListView(generics.ListAPIView):
    """
    GET /api/admin/users/<user_id>/snapshots/ — List all snapshots for a specific user (admin only).
    """

    serializer_class = UserHistoricalSnapshotSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return UserHistoricalSnapshot.objects.filter(user_id=user_id)


class AdminUserSnapshotCreateView(generics.CreateAPIView):
    """
    POST /api/admin/users/<user_id>/snapshots/ — Admin creates a snapshot for a specific user.
    """

    serializer_class = UserHistoricalSnapshotSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_create(self, serializer):
        user_id = self.kwargs['user_id']
        user = get_object_or_404(User, pk=user_id)
        serializer.save(user=user)


# ---------- User Sessions (Device Sessions) ----------

class MySessionListView(generics.ListAPIView):
    """
    GET /api/users/sessions/ — List authenticated user's device sessions.
    """
    serializer_class = UserSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserSession.objects.filter(user=self.request.user).order_by('-last_active')


class MySessionRevokeView(APIView):
    """
    DELETE /api/users/sessions/<id>/ — Revoke a specific session.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Revoke session",
        description="Revoke a specific device session for the authenticated user.",
        responses={200: OpenApiResponse(description="Session revoked")},
        tags=["users"]
    )
    def delete(self, request, pk):
        session = get_object_or_404(UserSession, pk=pk, user=request.user)
        session.delete()
        return Response({'success': True, 'message': 'Session revoked successfully'})


class MySessionRevokeAllView(APIView):
    """
    POST /api/users/sessions/revoke-all/ — Revoke all sessions except current.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Revoke all sessions",
        description="Revoke all device sessions except the current one.",
        responses={200: OpenApiResponse(description="All other sessions revoked")},
        tags=["users"]
    )
    def post(self, request: Request):
        UserSession.objects.filter(user=request.user).exclude(is_current=True).delete()
        return Response({'success': True, 'message': 'All other sessions revoked successfully'})


# ---------- KYC Documents ----------

class MyKYCDocumentListView(generics.ListAPIView):
    """
    GET /api/users/kyc-documents/ — List authenticated user's KYC documents.
    """
    serializer_class = KYCDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return KYCDocument.objects.filter(user=self.request.user).order_by('-uploaded_at')


class MyKYCDocumentCreateView(generics.CreateAPIView):
    """
    POST /api/users/kyc-documents/ — Upload a KYC document.
    """
    serializer_class = KYCDocumentSerializer
    permission_classes = [IsAuthenticated]
    def perform_create(self, serializer):
        # Not used when uploading via files; kept for completeness
        serializer.save(user=self.request.user)

    @extend_schema(
        summary="Upload KYC document",
        description="Upload a KYC document for identity verification. Document types: id_front, id_back, proof_address, selfie",
        request=serializers.Serializer,
        responses={201: KYCDocumentSerializer},
        tags=["users"]
    )
    def post(self, request, *args, **kwargs):
        # Expect multipart/form-data with 'document_type' and 'file'
        document_type = request.data.get('document_type')
        upload_file = request.FILES.get('file')

        if not document_type or not upload_file:
            return Response({'error': 'document_type and file are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure valid document_type
        valid_types = [choice[0] for choice in KYCDocument.DOCUMENT_TYPES]
        if document_type not in valid_types:
            return Response({'error': f'Invalid document_type. Valid: {valid_types}'}, status=status.HTTP_400_BAD_REQUEST)

        # Process image files with Pillow when possible
        filename = upload_file.name
        ext = os.path.splitext(filename)[1].lower()

        # Create target path
        timestamp = int(time.time())
        target_dir = f"kyc/user_{request.user.id}"
        target_filename = f"{document_type}_{timestamp}{ext}"
        target_path = os.path.join(target_dir, target_filename)

        # If it's an image, compress/resize a bit
        try:
            if ext in ['.jpg', '.jpeg', '.png', '.webp']:
                img = Image.open(upload_file)
                img = img.convert('RGB')
                # Keep reasonable max dimension
                max_dim = 1600
                if max(img.size) > max_dim:
                    ratio = max_dim / float(max(img.size))
                    new_size = (int(img.size[0]*ratio), int(img.size[1]*ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                img.save(buffer, format='WEBP', quality=80)
                buffer.seek(0)
                saved_path = default_storage.save(target_path + '.webp', ContentFile(buffer.read()))
                saved_size = default_storage.size(saved_path)
                file_url = os.path.join(settings.MEDIA_URL, saved_path).replace('\\', '/')
                original_filename = filename
            else:
                # Save raw file
                saved_path = default_storage.save(target_path, upload_file)
                saved_size = default_storage.size(saved_path)
                file_url = os.path.join(settings.MEDIA_URL, saved_path).replace('\\', '/')
                original_filename = filename
        except Exception as exc:
            return Response({'error': 'Failed to process upload', 'details': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Create KYCDocument record
        doc = KYCDocument.objects.create(
            user=request.user,
            document_type=document_type,
            file_url=file_url,
            original_filename=original_filename,
            file_size=saved_size,
            status='pending'
        )

        UserActivityLog.objects.create(
            user=request.user,
            action='kyc_submit',
            status='success',
            metadata={'document_id': doc.pk, 'document_type': document_type}
        )

        serializer = KYCDocumentSerializer(doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AvatarUploadView(APIView):
    """
    POST /api/users/avatar/
    Upload and process a user avatar image. Resizes to 200x200 and stores as webp in media/avatars/.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Upload avatar",
        description="Upload avatar image. Returns avatar URL.",
        request=serializers.Serializer,
        responses={200: OpenApiResponse(description="Avatar uploaded")},
        tags=["users"]
    )
    def post(self, request: Request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = get_validated_data(serializer)
        avatar_file = validated_data['avatar']

        # Process image with Pillow
        img = Image.open(avatar_file)
        img = img.convert('RGB')
        img = img.resize((200, 200), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format='WEBP', quality=80)
        buffer.seek(0)

        filename = f"avatars/user_{request.user.id}_{int(time.time())}.webp"
        saved_path = default_storage.save(filename, ContentFile(buffer.read()))

        # Build URL
        from django.conf import settings
        avatar_url = os.path.join(settings.MEDIA_URL, saved_path).replace('\\', '/')

        # Update user
        request.user.avatar_url = avatar_url
        request.user.save(update_fields=['avatar_url'])

        UserActivityLog.objects.create(
            user=request.user,
            action='avatar_update',
            status='success',
            metadata={'avatar_url': avatar_url},
        )

        return Response({'success': True, 'avatar_url': avatar_url})


class MyKYCDocumentDeleteView(generics.DestroyAPIView):
    """
    DELETE /api/users/kyc-documents/<id>/ — Delete a KYC document (if pending).
    """
    serializer_class = KYCDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return KYCDocument.objects.filter(user=self.request.user, status='pending')


# ---------- User Activity Log ----------

class MyActivityLogListView(generics.ListAPIView):
    """
    GET /api/users/activity-log/ — List authenticated user's activity log.
    Supports filtering by action type and date range.
    """
    serializer_class = UserActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = UserActivityLog.objects.filter(user=self.request.user)
        
        # Filter by action type
        action = self.request.GET.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by date range
        start_date = self.request.GET.get('start_date')
        end_date = self.request.GET.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset


# ---------- Admin: KYC Document Review ----------

class AdminKYCDocumentListView(generics.ListAPIView):
    """
    GET /api/admin/kyc-documents/ — List all KYC documents (admin only).
    """
    serializer_class = KYCDocumentSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return KYCDocument.objects.all().order_by('-uploaded_at')


class AdminKYCDocumentReviewView(APIView):
    """
    POST /api/admin/kyc-documents/<id>/review/ — Approve or reject a KYC document.
    Request: { "action": "approve"|"reject", "rejection_reason": "..." }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        summary="Review KYC document",
        description="Approve or reject a KYC document. If rejecting, provide a rejection_reason.",
        request=serializers.Serializer,
        responses={200: KYCDocumentSerializer},
        tags=["admin"]
    )
    def post(self, request, pk):
        document = get_object_or_404(KYCDocument, pk=pk)
        payload = get_request_data(request)
        action = payload.get('action')
        rejection_reason = payload.get('rejection_reason', '')

        if action == 'approve':
            document.status = 'approved'
            document.reviewed_by = request.user
            document.reviewed_at = timezone.now()
            document.save()
            
            # Update user's KYC status if all required docs approved
            user = document.user
            required_docs = ['id_front', 'id_back', 'proof_address', 'selfie']
            all_approved = all(
                KYCDocument.objects.filter(user=user, document_type=doc_type, status='approved').exists()
                for doc_type in required_docs
            )
            if all_approved:
                user.kyc_status = 'verified'
                user.kyc_reviewed_at = timezone.now()
                user.kyc_reviewed_by = request.user
                user.save(update_fields=['kyc_status', 'kyc_reviewed_at', 'kyc_reviewed_by'])
            
        elif action == 'reject':
            document.status = 'rejected'
            document.rejection_reason = rejection_reason
            document.reviewed_by = request.user
            document.reviewed_at = timezone.now()
            document.save()
            
            # Update user's KYC status
            user = document.user
            user.kyc_status = 'rejected'
            user.kyc_rejection_reason = rejection_reason
            user.kyc_reviewed_at = timezone.now()
            user.kyc_reviewed_by = request.user
            user.save(update_fields=['kyc_status', 'kyc_rejection_reason', 'kyc_reviewed_at', 'kyc_reviewed_by'])
        else:
            return Response({'error': 'Invalid action. Use "approve" or "reject".'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(KYCDocumentSerializer(document).data)


# ---------- Admin: User Activity Log ----------

class AdminUserActivityLogListView(generics.ListAPIView):
    """
    GET /api/admin/users/<user_id>/activity-log/ — List activity log for a specific user (admin only).
    """
    serializer_class = UserActivityLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return UserActivityLog.objects.filter(user_id=user_id)


# ---------- Wallet Actions: Deposit, Withdraw, Transfer, Buy, Swap ----------

class DepositAddressView(APIView):
    """
    POST /api/wallet/deposit-address/
    Generate a deterministic deposit address for a given asset.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get deposit address",
        description="Generate a deterministic deposit address for the given asset.",
        request=DepositSerializer,
        responses={200: OpenApiResponse(description="Deposit address generated")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        asset = validated_data['asset']
        user = request.user
        
        # Deterministic address generation based on user ID + asset
        address_seed = hashlib.sha256(f"crypgo:{user.id}:{asset}:mainnet".encode('utf-8')).hexdigest()
        if asset == 'BTC':
            address = f"bc1{address_seed[:30]}"
        elif asset in ['ETH', 'USDT', 'USDC']:
            address = f"0x{address_seed[:40]}"
        elif asset == 'SOL':
            address = f"{address_seed[:44]}"
        elif asset == 'LTC':
            address = f"L{address_seed[:33]}"
        else:
            address = f"{address_seed[:40]}"
        
        return Response({
            'success': True,
            'asset': asset,
            'address': address,
            'minimum_deposit': '0.001' if asset == 'BTC' else '0.01' if asset in ['ETH', 'SOL', 'LTC'] else '1.0',
            'estimated_confirmation': '1-3 network confirmations (5-30 minutes)',
            'qrcode_url': f"/api/wallet/qrcode/?address={address}",
        })


class QRCodeView(APIView):
    """
    GET /api/wallet/qrcode/?address=<address>
    Generate a QR code PNG image for the given address.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Generate QR code for deposit address",
        description="Returns a PNG QR code image for the given cryptocurrency address.",
        parameters=[
            OpenApiParameter(
                name='address',
                description='The deposit address to encode in the QR code',
                required=True,
                type=str,
                location=OpenApiParameter.QUERY
            ),
        ],
        responses={
            200: OpenApiResponse(description="PNG image"),
            400: OpenApiResponse(description="Missing address parameter"),
        },
        tags=["wallet"]
    )
    def get(self, request: Request):
        address = request.GET.get('address')
        if not address:
            return Response(
                {'success': False, 'error': 'Missing address parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(address)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        # Return as PNG
        buffer = io.BytesIO()
        img.save(buffer, 'PNG')
        buffer.seek(0)
        return HttpResponse(buffer.getvalue(), content_type='image/png')


class WithdrawView(APIView):
    """
    POST /api/wallet/withdraw/
    Submit a withdrawal request. Funds deducted + fee. Transaction created as pending,
    then auto-completed after simulated delay.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Withdraw funds",
        description="Submit a withdrawal request. Validates balance, deducts amount + fee, creates pending transaction.",
        request=WithdrawSerializer,
        responses={200: OpenApiResponse(description="Withdrawal submitted")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = WithdrawSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        user = request.user
        asset = validated_data['asset']
        amount = validated_data['amount']
        fee = validated_data['fee']
        address = validated_data['destination_address']
        wallet = validated_data['wallet']
        
        with transaction.atomic():
            # Deduct from wallet
            wallet.available_quantity -= (amount + fee)
            wallet.quantity -= (amount + fee)
            wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Create transaction
            tx = Transaction.objects.create(
                user=user,
                transaction_type='withdrawal',
                asset=asset,
                amount=amount,
                fee=fee,
                status='pending',
                to_address=address,
            )
            
            # Log activity
            UserActivityLog.objects.create(
                user=user,
                action='withdrawal',
                status='success',
                metadata={'amount': str(amount), 'asset': asset, 'txid': tx.txid, 'address': address},
            )
        
        return Response({
            'success': True,
            'message': f'Withdrawal of {amount} {asset} submitted.',
            'transaction': TransactionSerializer(tx).data,
        })


class WithdrawCompleteView(APIView):
    """
    POST /api/wallet/withdraw/complete/<txid>/
    Simulate completion of a pending withdrawal (for testing/demo).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, txid):
        tx = get_object_or_404(Transaction, txid=txid, user=request.user, transaction_type='withdrawal', status='pending')
        tx.status = 'completed'
        tx.completed_at = timezone.now()
        tx.save(update_fields=['status', 'completed_at'])
        
        UserActivityLog.objects.create(
            user=request.user,
            action='withdrawal',
            status='success',
            metadata={'txid': txid, 'status': 'completed'},
        )
        
        return Response({
            'success': True,
            'message': 'Withdrawal completed.',
            'transaction': TransactionSerializer(tx).data,
        })


class TransferView(APIView):
    """
    POST /api/wallet/transfer/
    Transfer funds internally between users. Instant.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Transfer funds",
        description="Transfer crypto between users internally. Deducts from sender, adds to recipient instantly.",
        request=TransferSerializer,
        responses={200: OpenApiResponse(description="Transfer completed")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = TransferSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        user = request.user
        recipient = validated_data['recipient']
        asset = validated_data['asset']
        amount = validated_data['amount']
        memo = validated_data.get('memo', '')
        wallet = validated_data['wallet']
        
        with transaction.atomic():
            # Get or create recipient wallet
            recipient_wallet, _ = WalletAsset.objects.get_or_create(
                user=recipient,
                ticker=asset,
                defaults={'name': wallet.name, 'quantity': 0, 'available_quantity': 0, 'locked_quantity': 0}
            )
            
            # Deduct from sender
            wallet.available_quantity -= amount
            wallet.quantity -= amount
            wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Add to recipient
            recipient_wallet.available_quantity += amount
            recipient_wallet.quantity += amount
            recipient_wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Create transactions for both users
            sender_tx = Transaction.objects.create(
                user=user,
                transaction_type='transfer_out',
                asset=asset,
                amount=amount,
                status='completed',
                counterparty=recipient,
                memo=memo,
                completed_at=timezone.now(),
            )
            
            recipient_tx = Transaction.objects.create(
                user=recipient,
                transaction_type='transfer_in',
                asset=asset,
                amount=amount,
                status='completed',
                counterparty=user,
                memo=memo,
                completed_at=timezone.now(),
            )
            
            # Log activity
            UserActivityLog.objects.create(
                user=user,
                action='transfer',
                status='success',
                metadata={'amount': str(amount), 'asset': asset, 'recipient': recipient.email, 'txid': sender_tx.txid},
            )
        
        return Response({
            'success': True,
            'message': f'Transferred {amount} {asset} to {recipient.email}.',
            'transaction': TransactionSerializer(sender_tx).data,
        })


class BuyCryptoView(APIView):
    """
    POST /api/wallet/buy/
    Buy crypto with fiat (USD). Deducts fiat balance, adds crypto asset.
    Price fetched from market data (simulated with a fixed rate here).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Buy crypto",
        description="Buy cryptocurrency using fiat balance. Deducts USD, adds crypto at current market price.",
        request=BuySerializer,
        responses={200: OpenApiResponse(description="Purchase completed")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = BuySerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        user = request.user
        asset = validated_data['asset']
        amount_usd = validated_data['amount_usd']
        
        # Simulated prices (would come from CoinGecko)
        prices = {
            'BTC': 43000, 'ETH': 2200, 'USDT': 1.0,
            'USDC': 1.0, 'SOL': 95, 'LTC': 72,
        }
        price = prices.get(asset, 100)
        crypto_amount = amount_usd / price
        
        with transaction.atomic():
            # Add crypto
            wallet, _ = WalletAsset.objects.get_or_create(
                user=user,
                ticker=asset,
                defaults={
                    'name': {'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'USDT': 'Tether', 'USDC': 'USD Coin', 'SOL': 'Solana', 'LTC': 'Litecoin'}.get(asset, asset),
                    'quantity': 0, 'available_quantity': 0, 'locked_quantity': 0,
                }
            )
            wallet.available_quantity += crypto_amount
            wallet.quantity += crypto_amount
            wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Create transaction
            tx = Transaction.objects.create(
                user=user,
                transaction_type='buy',
                asset=asset,
                amount=crypto_amount,
                fiat_amount=amount_usd,
                price_at_time=price,
                status='completed',
                completed_at=timezone.now(),
            )
            
            # Log activity
            UserActivityLog.objects.create(
                user=user,
                action='buy',
                status='success',
                metadata={'amount_usd': str(amount_usd), 'asset': asset, 'crypto_amount': str(crypto_amount), 'price': str(price)},
            )
        
        return Response({
            'success': True,
            'message': f'Purchased {crypto_amount:.8f} {asset} for ${amount_usd:.2f}.',
            'transaction': TransactionSerializer(tx).data,
        })


class SwapCryptoView(APIView):
    """
    POST /api/wallet/swap/
    Swap one crypto asset for another. Uses current market prices for conversion.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Swap crypto",
        description="Swap one cryptocurrency for another using current market prices.",
        request=SwapSerializer,
        responses={200: OpenApiResponse(description="Swap completed")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = SwapSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        user = request.user
        from_asset = validated_data['from_asset']
        to_asset = validated_data['to_asset']
        amount = validated_data['amount']
        wallet = validated_data['wallet']
        
        # Simulated prices
        prices = {
            'BTC': 43000, 'ETH': 2200, 'USDT': 1.0,
            'USDC': 1.0, 'SOL': 95, 'LTC': 72,
        }
        from_price = prices.get(from_asset, 100)
        to_price = prices.get(to_asset, 100)
        usd_value = amount * from_price
        to_amount = usd_value / to_price
        
        with transaction.atomic():
            # Deduct from asset
            wallet.available_quantity -= amount
            wallet.quantity -= amount
            wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Add to destination asset
            dest_wallet, _ = WalletAsset.objects.get_or_create(
                user=user,
                ticker=to_asset,
                defaults={
                    'name': {'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'USDT': 'Tether', 'USDC': 'USD Coin', 'SOL': 'Solana', 'LTC': 'Litecoin'}.get(to_asset, to_asset),
                    'quantity': 0, 'available_quantity': 0, 'locked_quantity': 0,
                }
            )
            dest_wallet.available_quantity += to_amount
            dest_wallet.quantity += to_amount
            dest_wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Create transaction
            tx = Transaction.objects.create(
                user=user,
                transaction_type='swap',
                asset=from_asset,
                amount=amount,
                destination_asset=to_asset,
                destination_amount=to_amount,
                price_at_time=from_price,
                status='completed',
                completed_at=timezone.now(),
            )
            
            # Log activity
            UserActivityLog.objects.create(
                user=user,
                action='swap',
                status='success',
                metadata={'from_asset': from_asset, 'from_amount': str(amount), 'to_asset': to_asset, 'to_amount': str(to_amount)},
            )
        
        return Response({
            'success': True,
            'message': f'Swapped {amount} {from_asset} to {to_amount:.8f} {to_asset}.',
            'transaction': TransactionSerializer(tx).data,
        })


class SimulateDepositView(APIView):
    """
    POST /api/wallet/simulate-deposit/
    Simulate a deposit (for testing/demo). Adds funds instantly.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Simulate deposit",
        description="Simulate a deposit for testing. Adds funds instantly without real blockchain transaction.",
        request=DepositSerializer,
        responses={200: OpenApiResponse(description="Deposit simulated")},
        tags=["wallet"]
    )
    def post(self, request: Request):
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validated_data = get_validated_data(serializer)
        asset = validated_data['asset']
        user = request.user
        
        # Simulate a deposit of a small test amount
        test_amounts = {'BTC': Decimal('0.01'), 'ETH': Decimal('0.1'), 'USDT': Decimal('100'), 'USDC': Decimal('100'), 'SOL': Decimal('1'), 'LTC': Decimal('0.5')}
        amount = test_amounts.get(asset, Decimal('1.0'))
        
        with transaction.atomic():
            wallet, _ = WalletAsset.objects.get_or_create(
                user=user,
                ticker=asset,
                defaults={
                    'name': {'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'USDT': 'Tether', 'USDC': 'USD Coin', 'SOL': 'Solana', 'LTC': 'Litecoin'}.get(asset, asset),
                    'quantity': 0, 'available_quantity': 0, 'locked_quantity': 0,
                }
            )
            wallet.available_quantity += amount
            wallet.quantity += amount
            wallet.save(update_fields=['available_quantity', 'quantity'])
            
            # Generate deterministic deposit address
            address_hash = get_random_string(length=34) if asset == 'BTC' else get_random_string(length=42)
            if asset == 'BTC':
                address = f"1{address_hash[:33]}"
            elif asset in ['ETH', 'USDT', 'USDC']:
                address = f"0x{address_hash[:40]}"
            elif asset == 'SOL':
                address = f"{address_hash[:44]}"
            else:
                address = f"{address_hash[:40]}"
            
            tx = Transaction.objects.create(
                user=user,
                transaction_type='deposit',
                asset=asset,
                amount=amount,
                status='completed',
                to_address=address,
                completed_at=timezone.now(),
            )
            
            UserActivityLog.objects.create(
                user=user,
                action='deposit',
                status='success',
                metadata={'amount': str(amount), 'asset': asset, 'txid': tx.txid},
            )
        
        return Response({
            'success': True,
            'message': f'Simulated deposit of {amount} {asset}.',
            'transaction': TransactionSerializer(tx).data,
        })


class MyTransactionListView(generics.ListAPIView):
    """
    GET /api/wallet/transactions/ — List authenticated user's transactions.
    Supports filtering by type, asset, and status.
    """
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = 'wallet_transactions'

    def get_queryset(self):
        queryset = Transaction.objects.filter(user=self.request.user)
        
        tx_type = self.request.GET.get('type')
        asset = self.request.GET.get('asset')
        status = self.request.GET.get('status')
        
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)
        if asset:
            queryset = queryset.filter(asset=asset.upper())
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset.order_by('-created_at')


# ---------- Two-Factor Authentication (TOTP) ----------


class TwoFASetupView(APIView):
    """GET /api/users/2fa/setup/ — Generate a new TOTP secret for setup."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        # Generate a new base32 secret
        secret = pyotp.random_base32()
        # Build otpauth URL for QR generation on frontend
        issuer = 'Crypgo'
        label = request.user.email
        otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)

        return Response({'otp_secret': secret, 'otpauth_url': otpauth_url})


class TwoFAVerifyView(APIView):
    """POST /api/users/2fa/verify/ — Verify provided TOTP and enable 2FA."""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        serializer = TwoFAVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        code = validated_data['code']
        otp_secret = validated_data.get('otp_secret') or request.user.two_fa_secret

        if not otp_secret:
            return Response({'error': 'No OTP secret provided.'}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(otp_secret)
        verified = totp.verify(code, valid_window=1)

        if not verified:
            return Response({'error': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Enable 2FA and store secret and backup codes
        backup_codes = []
        for _ in range(10):
            backup_codes.append(get_random_string(length=10))

        request.user.two_fa_secret = otp_secret
        request.user.two_fa_enabled = True
        request.user.two_fa_backup_codes = backup_codes
        request.user.save(update_fields=['two_fa_secret', 'two_fa_enabled', 'two_fa_backup_codes'])

        UserActivityLog.objects.create(
            user=request.user,
            action='2fa_enable',
            status='success',
            metadata={'backup_codes_count': len(backup_codes)}
        )

        return Response({'success': True, 'backup_codes': backup_codes})


class TwoFADisableView(APIView):
    """POST /api/users/2fa/disable/ — Disable 2FA (requires valid code or backup code)."""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        serializer = TwoFADisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        code = validated_data['code']
        user = request.user

        if not user.two_fa_enabled or not user.two_fa_secret:
            return Response({'error': '2FA is not enabled.'}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.two_fa_secret)
        verified = totp.verify(code, valid_window=1)

        used_backup = False
        if not verified:
            # Check backup codes
            backup_codes = user.two_fa_backup_codes or []
            if code in backup_codes:
                used_backup = True
                backup_codes.remove(code)
            else:
                return Response({'error': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Disable 2FA
        user.two_fa_enabled = False
        user.two_fa_secret = ''
        if used_backup:
            user.two_fa_backup_codes = backup_codes
        else:
            user.two_fa_backup_codes = []
        user.save(update_fields=['two_fa_enabled', 'two_fa_secret', 'two_fa_backup_codes'])

        UserActivityLog.objects.create(
            user=user,
            action='2fa_disable',
            status='success',
            metadata={'used_backup': used_backup}
        )

        return Response({'success': True, 'message': '2FA disabled.'})


# =====================================================================
# NOTIFICATIONS — In-app and push
# =====================================================================

class NotificationListView(generics.ListAPIView):
    """
    GET /api/users/notifications/
    List the authenticated user's notifications. Supports unread_only filter.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user).order_by('-created_at')
        if self.request.GET.get('unread_only') == 'true':
            queryset = queryset.filter(is_read=False)
        return queryset

    @extend_schema(
        summary="List notifications",
        description="List notifications for the authenticated user. Query param: unread_only=true.",
        parameters=[
            OpenApiParameter(name="unread_only", description="Only return unread notifications", required=False, type=str, location=OpenApiParameter.QUERY),
        ],
        responses={200: NotificationSerializer(many=True)},
        tags=["notifications"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class UnreadNotificationCountView(APIView):
    """
    GET /api/users/notifications/unread-count/
    Get the count of unread notifications.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Unread notification count",
        description="Get the number of unread notifications for the authenticated user.",
        responses={200: OpenApiResponse(description="Unread count")},
        tags=["notifications"]
    )
    def get(self, request: Request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'unread_count': count})


class MarkNotificationReadView(APIView):
    """
    POST /api/users/notifications/mark-read/
    Mark one or more notifications as read.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Mark notification(s) read",
        description="Mark specific notification IDs as read, or all notifications if no IDs provided.",
        request=MarkNotificationReadSerializer,
        responses={200: OpenApiResponse(description="Notifications marked as read")},
        tags=["notifications"]
    )
    def post(self, request: Request):
        serializer = MarkNotificationReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification_ids = get_validated_data(serializer).get('notification_ids', [])

        if notification_ids:
            Notification.objects.filter(user=request.user, id__in=notification_ids).update(is_read=True, read_at=timezone.now())
        else:
            Notification.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())

        return Response({'success': True, 'message': 'Notifications marked as read.'})


class DeleteNotificationView(APIView):
    """
    DELETE /api/users/notifications/<id>/
    Delete a notification.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Delete notification",
        description="Delete a single notification for the authenticated user.",
        responses={204: OpenApiResponse(description="Notification deleted")},
        tags=["notifications"]
    )
    def delete(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PushSubscriptionView(APIView):
    """
    GET/POST /api/users/notifications/push-subscription/
    Get the user's push subscriptions or add a new one.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List push subscriptions",
        description="List Web Push subscription endpoints for the authenticated user.",
        responses={200: PushSubscriptionSerializer(many=True)},
        tags=["notifications"]
    )
    def get(self, request: Request):
        subscriptions = PushSubscription.objects.filter(user=request.user)
        return Response(PushSubscriptionSerializer(subscriptions, many=True).data)

    @extend_schema(
        summary="Add push subscription",
        description="Register a new Web Push subscription endpoint for the authenticated user.",
        request=SubscribePushSerializer,
        responses={201: PushSubscriptionSerializer},
        tags=["notifications"]
    )
    def post(self, request: Request):
        serializer = SubscribePushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        subscription, created = PushSubscription.objects.get_or_create(
            user=request.user,
            endpoint=validated_data['endpoint'],
            defaults={
                'p256dh': validated_data['p256dh'],
                'auth': validated_data['auth'],
                'user_agent': validated_data.get('user_agent', ''),
            }
        )

        return Response(PushSubscriptionSerializer(subscription).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DeletePushSubscriptionView(APIView):
    """
    DELETE /api/users/notifications/push-subscription/<id>/
    Remove a push subscription.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Delete push subscription",
        description="Remove a Web Push subscription for the authenticated user.",
        responses={204: OpenApiResponse(description="Subscription deleted")},
        tags=["notifications"]
    )
    def delete(self, request, pk):
        subscription = get_object_or_404(PushSubscription, pk=pk, user=request.user)
        subscription.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =====================================================================
# SECURITY — Device fingerprints, sessions, location verification
# =====================================================================

class DeviceFingerprintView(APIView):
    """
    GET/POST /api/users/security/devices/
    Get the user's registered devices or register a new device fingerprint.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List devices",
        description="List all registered device fingerprints for the authenticated user.",
        responses={200: DeviceFingerprintSerializer(many=True)},
        tags=["security"]
    )
    def get(self, request: Request):
        devices = DeviceFingerprint.objects.filter(user=request.user).order_by('-last_seen')
        return Response(DeviceFingerprintSerializer(devices, many=True).data)

    @extend_schema(
        summary="Register device",
        description="Register the current device's fingerprint for fraud detection.",
        request=serializers.Serializer,
        responses={201: DeviceFingerprintSerializer},
        tags=["security"]
    )
    def post(self, request: Request):
        payload = get_request_data(request)
        data = payload.copy() if isinstance(payload, dict) else {}
        data['user'] = request.user.id
        data['fingerprint_id'] = data.get('fingerprint_id', '') or hashlib.sha256(f"{request.user.id}:{data.get('user_agent', '')}".encode()).hexdigest()[:32]

        device, created = DeviceFingerprint.objects.get_or_create(
            user=request.user,
            fingerprint_id=data['fingerprint_id'],
            defaults={
                'user_agent': data.get('user_agent', ''),
                'browser': data.get('browser', ''),
                'browser_version': data.get('browser_version', ''),
                'os': data.get('os', ''),
                'os_version': data.get('os_version', ''),
                'device_type': data.get('device_type', ''),
                'screen_resolution': data.get('screen_resolution', ''),
                'language': data.get('language', ''),
                'timezone': data.get('timezone', ''),
                'platform': data.get('platform', ''),
                'cores': data.get('cores'),
                'memory': data.get('memory'),
            }
        )

        device.last_seen = timezone.now()
        if request.META.get('HTTP_X_FORWARDED_FOR'):
            device.ip_address = request.META.get('HTTP_X_FORWARDED_FOR').split(',')[0].strip()
        else:
            device.ip_address = request.META.get('REMOTE_ADDR', '')
        device.save(update_fields=['last_seen', 'ip_address'])

        return Response(DeviceFingerprintSerializer(device).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class VerifyDeviceLocationView(APIView):
    """
    POST /api/users/security/devices/verify-location/
    Submit GPS coordinates to verify the device's current location.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Verify device location",
        description="Submit GPS coordinates for fraud detection and location verification.",
        request=VerifyDeviceLocationSerializer,
        responses={200: OpenApiResponse(description="Location verified")},
        tags=["security"]
    )
    def post(self, request: Request):
        serializer = VerifyDeviceLocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        fingerprint_id = validated_data.get('fingerprint_id')
        device = None
        if fingerprint_id:
            device = DeviceFingerprint.objects.filter(user=request.user, id=fingerprint_id).first()

        if device:
            device.location_latitude = validated_data['latitude']
            device.location_longitude = validated_data['longitude']
            device.location_accuracy = validated_data.get('accuracy', 0)
            device.is_current = True
            device.save(update_fields=['location_latitude', 'location_longitude', 'location_accuracy', 'is_current'])
            return Response({'success': True, 'message': 'Location verified.', 'device': DeviceFingerprintSerializer(device).data})

        return Response({'error': 'Device not found.'}, status=status.HTTP_404_NOT_FOUND)


class RequestBrowserLocationView(APIView):
    """
    POST /api/users/security/browser-location-request/
    Callback after the user grants/denies browser location permission.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Browser location permission",
        description="Record whether the user granted or denied browser location permission.",
        request=RequestBrowserLocationSerializer,
        responses={200: OpenApiResponse(description="Permission recorded")},
        tags=["security"]
    )
    def post(self, request: Request):
        serializer = RequestBrowserLocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permission = get_validated_data(serializer)['permission']

        UserActivityLog.objects.create(
            user=request.user,
            action='location_permission',
            status='success',
            metadata={'permission': permission}
        )
        return Response({'success': True, 'permission': permission})


class SearchUsersByIdView(APIView):
    """
    POST /api/users/security/search-by-id/
    Search for a user by device ID prefix (numeric match).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Search users by ID",
        description="Search users whose ID starts with the given numeric prefix.",
        request=SearchUsersByIdSerializer,
        responses={200: OpenApiResponse(description="Matching users")},
        tags=["security"]
    )
    def post(self, request: Request):
        serializer = SearchUsersByIdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prefix = get_validated_data(serializer)['prefix']

        # Interpret prefix as a partial user ID match
        prefix_int = ''.join(c for c in prefix if c.isdigit())
        if not prefix_int:
            prefix_int = '0'

        users = User.objects.filter(id__startswith=prefix_int)[:10]
        return Response({
            'results': UserSerializer(users, many=True).data
        })


class SearchUsersByNameView(APIView):
    """
    POST /api/users/security/search-by-name/
    Search for a user by name, username, or email.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Search users by name",
        description="Search users by username, first name, last name, or email.",
        request=SearchUsersByNameSerializer,
        responses={200: OpenApiResponse(description="Matching users")},
        tags=["security"]
    )
    def post(self, request: Request):
        serializer = SearchUsersByNameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        query = get_validated_data(serializer)['query']

        users = User.objects.filter(
            models.Q(username__icontains=query) |
            models.Q(first_name__icontains=query) |
            models.Q(last_name__icontains=query) |
            models.Q(email__icontains=query)
        ).exclude(id=request.user.id)[:10]
        return Response({
            'results': UserSerializer(users, many=True).data
        })


# =====================================================================
# TRANSACTION TRANSLATIONS — Multilingual support
# =====================================================================

class CreateTransactionTranslationView(APIView):
    """
    POST /api/transactions/<txid>/translations/
    Create a translation for a transaction.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create transaction translation",
        description="Store a translated memo/text for a transaction in a target language.",
        request=serializers.Serializer,
        responses={201: TransactionTranslationSerializer},
        tags=["transactions"]
    )
    def post(self, request, txid):
        transaction = get_object_or_404(Transaction, txid=txid, user=request.user)

        payload = get_request_data(request)
        target_language = payload.get('target_language', '')
        source_text = payload.get('source_text', '')
        translated_text = payload.get('translated_text', '')

        if not target_language or not translated_text:
            return Response({'error': 'target_language and translated_text are required.'}, status=status.HTTP_400_BAD_REQUEST)

        translation = TransactionTranslation.objects.create(
            transaction=transaction,
            target_language=target_language,
            source_text=source_text,
            translated_text=translated_text,
            created_by=request.user,
        )

        return Response(TransactionTranslationSerializer(translation).data, status=status.HTTP_201_CREATED)


class TransactionTranslationListView(APIView):
    """
    GET /api/transactions/<txid>/translations/
    List all translations for a transaction.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List transaction translations",
        description="List all stored translations for a transaction owned by the authenticated user.",
        responses={200: TransactionTranslationSerializer(many=True)},
        tags=["transactions"]
    )
    def get(self, request, txid):
        transaction = get_object_or_404(Transaction, txid=txid, user=request.user)
        translations = TransactionTranslation.objects.filter(transaction=transaction)
        return Response(TransactionTranslationSerializer(translations, many=True).data)


# =====================================================================
# INTERNAL TRANSFERS — History
# =====================================================================

class InternalTransferListView(generics.ListAPIView):
    """
    GET /api/wallet/internal-transfers/
    List the authenticated user's internal transfers (sent and received).
    """
    serializer_class = InternalTransferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return InternalTransfer.objects.filter(
            models.Q(sender=user) | models.Q(recipient=user)
        ).order_by('-created_at')

    @extend_schema(
        summary="List internal transfers",
        description="List all internal transfers involving the authenticated user.",
        responses={200: InternalTransferSerializer(many=True)},
        tags=["transactions"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class InternalTransferDetailView(generics.RetrieveAPIView):
    """
    GET /api/wallet/internal-transfers/<id>/
    Get details of a specific internal transfer.
    """
    serializer_class = InternalTransferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return InternalTransfer.objects.filter(
            models.Q(sender=user) | models.Q(recipient=user)
        )

    @extend_schema(
        summary="Get internal transfer",
        description="Get details of a specific internal transfer involving the authenticated user.",
        responses={200: InternalTransferSerializer},
        tags=["transactions"]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# =====================================================================
# SECURITY — Security health overview
# =====================================================================

class SecurityHealthView(APIView):
    """
    GET /api/users/security/health/
    Get an overview of the user's security posture (2FA status, active sessions, devices).
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'security_health'

    @extend_schema(
        summary="Security health overview",
        description="Get a summary of the user's security settings: 2FA enabled, active sessions, registered devices, KYC status.",
        responses={200: OpenApiResponse(description="Security health summary")},
        tags=["security"]
    )
    def get(self, request):
        user = request.user
        active_sessions = UserSession.objects.filter(user=user).count()
        devices = DeviceFingerprint.objects.filter(user=user).count()

        return Response({
            'two_fa_enabled': user.two_fa_enabled,
            'kyc_status': user.kyc_status,
            'active_sessions': active_sessions,
            'registered_devices': devices,
            'email': user.email,
            'email_verified': user.is_email_verified if hasattr(user, 'is_email_verified') else True,
            'phone_verified': bool(user.phone) if hasattr(user, 'phone') else False,
            'last_login': user.last_login,
            'recommendations': [
                {
                    'id': 'enable_2fa',
                    'title': 'Enable Two-Factor Authentication',
                    'completed': user.two_fa_enabled,
                    'description': 'Add an extra layer of security to your account with TOTP-based 2FA.'
                },
                {
                    'id': 'complete_kyc',
                    'title': 'Complete KYC Verification',
                    'completed': user.kyc_status == 'verified',
                    'description': 'Verify your identity to unlock higher limits and full platform access.'
                },
                {
                    'id': 'review_sessions',
                    'title': 'Review Active Sessions',
                    'completed': active_sessions <= 1,
                    'description': 'Check and revoke any unrecognized device sessions.'
                },
            ],
        })
