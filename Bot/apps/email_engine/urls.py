from django.urls import path
from . import views

urlpatterns = [
    path('open/<str:tracking_id>/', views.track_open, name='track-open'),
    path('click/<str:tracking_id>/', views.track_click, name='track-click'),
]