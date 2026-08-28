from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from apps.users.views import ForgotPasswordView

factory = APIRequestFactory()
request = factory.post('/api/auth/forgot-password/', {'email': 'admin@crypgo.com'}, format='json')

# Convert to DRF Request
drf_request = Request(request)
print('DRF Request data:', drf_request.data)
print('DRF Request content_type:', drf_request.content_type)

# Test the view
view = ForgotPasswordView.as_view()
response = view(drf_request)
print('Response status:', response.status_code)
print('Response data:', response.data)