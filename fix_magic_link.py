#!/usr/bin/env python3
"""
Fix magic link and password reset endpoints with proper error handling and logging.
"""

import re

# Read the views file
views_file = r'c:\Users\User\Desktop\Crypgo\django_backend\apps\users\views.py'

with open(views_file, 'r') as f:
    content = f.read()

# Fix 1: MagicLinkRequestView - Add error handling
old_magic_request = r'''class MagicLinkRequestView\(APIView\):
    permission_classes = \[AllowAny\]
    throttle_scope = 'password_reset'

    def post\(self, request: Request\):
        serializer = ForgotPasswordSerializer\(data=request\.data\)
        serializer\.is_valid\(raise_exception=True\)
        email = get_validated_data\(serializer\)\['email'\]
        user = User\.objects\.filter\(email__iexact=email, is_active=True\)\.first\(\)
        if user:
            _, raw_token = MagicLinkToken\.generate_token\(user\)
            send_magic_link_email\(user, raw_token\)
        return Response\(\{'success': True, 'message': 'If an account exists with this email, a sign-in link has been sent\.'\}\)'''

new_magic_request = '''class MagicLinkRequestView(APIView):
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
            )'''

# Use string replacement instead of regex
start_idx = content.find('class MagicLinkRequestView(APIView):')
if start_idx != -1:
    end_idx = content.find('class MagicLinkConsumeView(APIView):', start_idx)
    if end_idx != -1:
        content = content[:start_idx] + new_magic_request + '\n\n\n' + content[end_idx:]
        print("✓ Fixed MagicLinkRequestView")

# Fix 2: MagicLinkConsumeView - Add better error handling
old_magic_consume = '''class MagicLinkConsumeView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request: Request):
        raw_token = get_request_data(request).get('token')
        if not isinstance(raw_token, str) or not raw_token:
            return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        try:
            with transaction.atomic():
                token = MagicLinkToken.objects.select_for_update().select_related('user').get(token_hash=token_hash)
                if not token.is_valid() or not token.user.is_active:
                    raise MagicLinkToken.DoesNotExist
                token.used_at = timezone.now()
                token.save(update_fields=['used_at'])
        except MagicLinkToken.DoesNotExist:
            return Response({'error': 'Invalid or expired sign-in link.'}, status=status.HTTP_400_BAD_REQUEST)
        return issue_auth_response(token.user)'''

new_magic_consume = '''class MagicLinkConsumeView(APIView):
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
            )'''

start_idx = content.find('class MagicLinkConsumeView(APIView):')
if start_idx != -1:
    # Find the next class definition
    end_idx = content.find('\nclass ', start_idx + 1)
    if end_idx != -1:
        # Extract the section and replace
        old_section = content[start_idx:end_idx]
        content = content.replace(old_section, new_magic_consume + '\n')
        print("✓ Fixed MagicLinkConsumeView")

# Fix 3: ResetPasswordUpdateView - Add error handling
# Find and replace the post method in ResetPasswordUpdateView
reset_pattern = r'(class ResetPasswordUpdateView.*?def post\(self, request: Request\):)(.*?)(return Response\(\{[\s\S]*?\'message\': \'Password updated successfully\'[\s\S]*?\}, status=status\.HTTP_200_OK\))'

old_reset = '''    def post(self, request: Request):
        serializer = ResetPasswordUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = get_validated_data(serializer)
        token = validated_data['token']
        new_password = validated_data['new_password']

        reset_token = PasswordResetToken.objects.get(token=token)

        user = reset_token.user
        user.set_password(new_password)
        user.save()

        reset_token.mark_used()

        return Response({
            'success': True,
            'message': 'Password updated successfully'
        }, status=status.HTTP_200_OK)'''

new_reset = '''    def post(self, request: Request):
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
            )'''

if old_reset in content:
    content = content.replace(old_reset, new_reset)
    print("✓ Fixed ResetPasswordUpdateView")

# Write the updated content back
with open(views_file, 'w') as f:
    f.write(content)

print("\n✅ All fixes applied successfully!")
