from django.urls import path
from . import views

app_name = 'unsubscribes'

urlpatterns = [
    # New landing page (no email param - uses ?email= query)
    path('', views.unsubscribe_landing, name='unsubscribe_landing'),
    
    # New AJAX process endpoint (no email param - uses POST body)
    path('process/', views.unsubscribe_process_ajax, name='unsubscribe_process'),
    
    # Legacy email-based endpoints
    path('confirm/<str:email>/', views.unsubscribe_confirm, name='unsubscribe_confirm_path'),
    path('<str:email>/', views.unsubscribe_confirm, name='unsubscribe_confirm'),
    path('success/<str:email>/', views.unsubscribe_success, name='unsubscribe_success'),
    path('process/<str:email>/', views.unsubscribe_process, name='unsubscribe_process_legacy'),
]
