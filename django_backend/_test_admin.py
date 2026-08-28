import os, sys
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import Client

# Test actual login with email as username
client = Client(SERVER_NAME='localhost')
response = client.post('/admin/login/', 
    {'username': 'admin@crypgo.com', 'password': 'Admin123!'},
    HTTP_HOST='localhost')
print(f"POST login with email: {response.status_code}")
print(f"Location: {response.get('Location')}")

# Follow redirect
if response.status_code in (302, 303):
    follow_response = client.get('/admin/', HTTP_HOST='localhost')
    print(f"Admin index: {follow_response.status_code}")
    
    # Check user list
    user_response = client.get('/admin/users/user/', HTTP_HOST='localhost')
    print(f"User list: {user_response.status_code}")

# Test the test client login method (which uses authenticate)
client2 = Client(SERVER_NAME='localhost')
success = client2.login(username='admin@crypgo.com', password='Admin123!')
print(f"\nclient.login with email: {success}")

# Test what happens with username='admin'
client3 = Client(SERVER_NAME='localhost')
response = client3.post('/admin/login/', 
    {'username': 'admin', 'password': 'Admin123!'},
    HTTP_HOST='localhost')
print(f"\nPOST login with 'admin': {response.status_code}")
print(f"Location: {response.get('Location')}")

# Check error message in form
if response.status_code == 200:
    content = response.content.decode()
    if 'error' in content.lower() or 'invalid' in content.lower():
        import re
        errors = re.findall(r'<li>(.*?)</li>', content)
        for e in errors:
            if 'error' in e.lower() or 'invalid' in e.lower():
                print(f"Error: {e}")