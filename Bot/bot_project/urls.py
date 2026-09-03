from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.http import HttpResponse, HttpResponseRedirect
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def health_check(request):
    """Simple health check endpoint for Render uptime monitoring."""
    return HttpResponse("OK", status=200)


def api_root(request):
    """Root endpoint that redirects to admin dashboard."""
    return HttpResponseRedirect('/admin/')


urlpatterns = [
    path('', api_root, name='root'),
    path('health/', health_check, name='health_check'),
    # Admin (with Unfold)
    path('admin/', admin.site.urls),
    
    # API
    path('api/', include('apps.api.urls')),
    
    # Swagger/OpenAPI (drf-spectacular)
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='schema-swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='schema-redoc'),
    
    # Tracking endpoints (public - no auth)
    path('track/', include('apps.email_engine.urls')),
    path('unsubscribe/', include('apps.unsubscribes.urls')),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
