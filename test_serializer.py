import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'django_backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django

django.setup()

from apps.users.serializers import ForgotPasswordSerializer

payload = {'email': 'admin@crypgo.com'}
print('Request data:', payload)

serializer = ForgotPasswordSerializer(data=payload)
print('Serializer is_valid:', serializer.is_valid())
if serializer.is_valid():
    print('Validated data:', serializer.validated_data)
else:
    print('Errors:', serializer.errors)