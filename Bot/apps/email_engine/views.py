import logging
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from .models import EmailLog

logger = logging.getLogger(__name__)


def track_open(request, tracking_id):
    """Track email opens (1x1 pixel)"""
    email_log = get_object_or_404(EmailLog, tracking_id=tracking_id)
    if not email_log.opened_at:
        email_log.opened_at = timezone.now()
        email_log.status = 'opened'
        email_log.ip_address = request.META.get('REMOTE_ADDR')
        email_log.user_agent = request.META.get('HTTP_USER_AGENT')
        email_log.save(update_fields=['opened_at', 'status', 'ip_address', 'user_agent'])
        from .models import Tracking
        Tracking.objects.create(
            email_log=email_log,
            tracking_type='open',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT'),
        )
    # Return 1x1 transparent GIF
    pixel = b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
    return HttpResponse(pixel, content_type='image/gif')


def track_click(request, tracking_id):
    """Track email link clicks"""
    destination = request.GET.get('url') or settings.FRONTEND_URL or '/'
    if not destination.startswith(('http://', 'https://', '/')):
        destination = settings.FRONTEND_URL or '/'
    if destination == settings.FRONTEND_URL.rstrip('/'):
        destination = settings.FRONTEND_URL.rstrip('/') + '/'

    email_log = get_object_or_404(EmailLog, tracking_id=tracking_id)
    if not email_log.clicked_at:
        email_log.clicked_at = timezone.now()
        email_log.status = 'clicked'
        email_log.ip_address = request.META.get('REMOTE_ADDR')
        email_log.user_agent = request.META.get('HTTP_USER_AGENT')
        email_log.save(update_fields=['clicked_at', 'status', 'ip_address', 'user_agent'])
        from .models import Tracking
        Tracking.objects.create(
            email_log=email_log,
            tracking_type='click',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT'),
            url_clicked=destination,
        )
    return HttpResponseRedirect(destination)