import os
import sys
import django
from typing import cast
from django.http import HttpResponse

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

django.setup()

from rest_framework.test import APIClient
from apps.users.models import CustomUser
import json

client = APIClient()

# Test with admin user using the verified backend-accepted password
print("Testing login with admin@crypgo.com and Password123!...")
response = cast(HttpResponse, client.post('/api/auth/login/', {'email': 'admin@crypgo.com', 'password': 'Password123!'}, format='json', HTTP_HOST='localhost'))
print(f"Status: {response.status_code}")
print(f"Response: {response.content.decode()}")

# Test with a regular user using the same verified password
print("\nTesting login with allvalleyacoustics@gmail.com and Password123!...")
response = cast(HttpResponse, client.post('/api/auth/login/', {'email': 'allvalleyacoustics@gmail.com', 'password': 'Password123!'}, format='json', HTTP_HOST='localhost'))
print(f"Status: {response.status_code}")
print(f"Response: {response.content.decode()}")

# Test with wrong password
print("\nTesting login with wrong password...")
response = cast(HttpResponse, client.post('/api/auth/login/', {'email': 'admin@crypgo.com', 'password': 'wrongpassword'}, format='json', HTTP_HOST='localhost'))
print(f"Status: {response.status_code}")
print(f"Response: {response.content.decode()}")

# Test with non-existent user
print("\nTesting login with non-existent user...")
response = cast(HttpResponse, client.post('/api/auth/login/', {'email': 'nonexistent@test.com', 'password': 'Password123!'}, format='json', HTTP_HOST='localhost'))
print(f"Status: {response.status_code}")
print(f"Response: {response.content.decode()}")
