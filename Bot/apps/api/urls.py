from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'blacklisted-leads', views.BlacklistedLeadViewSet)
router.register(r'templates', views.EmailTemplateViewSet)
router.register(r'campaigns', views.CampaignViewSet)
router.register(r'email-logs', views.EmailLogViewSet)
router.register(r'bounces', views.BounceViewSet)
router.register(r'tracking', views.TrackingViewSet)
router.register(r'unsubscribed-leads', views.UnsubscribedLeadViewSet)
router.register(r'webhooks', views.WebhookViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.DashboardStatsView.as_view(), name='api-dashboard'),
    path('internal/send-magic-link/', views.send_magic_link, name='send-magic-link'),
    path('internal/campaigns/<int:campaign_id>/recipients/sync/', views.sync_campaign_recipients, name='sync-campaign-recipients'),
]