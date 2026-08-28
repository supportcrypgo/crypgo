import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bot_project.settings')
django.setup()
from django.contrib.staticfiles import finders
result = finders.find('unfold_custom.css')
print('Found:', result)

# Also check all static dirs
from django.conf import settings
print('STATICFILES_DIRS:', settings.STATICFILES_DIRS)
print('STATIC_ROOT:', settings.STATIC_ROOT)
print('STATIC_URL:', settings.STATIC_URL)
