import os
import dj_database_url
from pathlib import Path
from dotenv import load_dotenv

# Load .env (for local development)
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'fallback-dev-key')
DEBUG = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'crypgo-email.onrender.com').split(',')

# Application definition
INSTALLED_APPS = [
    # Unfold Admin (must be first)
    'unfold',
    
    # Django Default
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    'django_filters',
    'tinymce',
    'django_extensions',
    
    # Local apps
    'apps.core',
    'apps.leads',
    'apps.templates',
    'apps.campaigns',
    'apps.email_engine',
    'apps.unsubscribes',
    'apps.webhooks',
    'apps.api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'bot_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bot_project.wsgi.application'

# Database
DATABASE_SCHEMA = os.getenv('DB_SCHEMA', 'public')
DATABASES = {
    'default': dj_database_url.parse(
        os.getenv('DATABASE_URL') or f'sqlite:///{BASE_DIR}/db.sqlite3',
        conn_max_age=600,
    ),
    'sqlite': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
if os.getenv('DATABASE_URL') and DATABASE_SCHEMA != 'public':
    DATABASES['default'].setdefault('OPTIONS', {})['options'] = (
        f'-c search_path={DATABASE_SCHEMA},public'
    )

# Email Configuration - Gmail API (production) or SMTP (fallback)
USE_GMAIL_API = os.getenv('USE_GMAIL_API', 'False') == 'True'

if USE_GMAIL_API:
    EMAIL_BACKEND = 'apps.email_engine.gmail_backend.GmailAPIBackend'
    GMAIL_CLIENT_ID = os.getenv('GMAIL_CLIENT_ID')
    GMAIL_CLIENT_SECRET = os.getenv('GMAIL_CLIENT_SECRET')
    GMAIL_REFRESH_TOKEN = os.getenv('GMAIL_REFRESH_TOKEN')
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'support.crypgo@gmail.com')
    EMAIL_FROM_NAME = os.getenv('EMAIL_FROM_NAME', 'Crypgo')
    EMAIL_X_MAILER = os.getenv('EMAIL_X_MAILER', 'Crypgo Mailer')
else:
    # Fallback SMTP configuration
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
    EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False') == 'True'
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = os.getenv(
        'DEFAULT_FROM_EMAIL',
        ''
    )
    EMAIL_FROM_NAME = os.getenv('EMAIL_FROM_NAME', 'Crypgo')
    EMAIL_X_MAILER = os.getenv('EMAIL_X_MAILER', 'Crypgo Mailer')

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# drf-spectacular OpenAPI/Swagger
SPECTACULAR_SETTINGS = {
    'TITLE': 'Email Bot API',
    'DESCRIPTION': 'Email Automation System API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
    },
    'SECURITY': [
        {'Bearer': []},
    ],
    'COMPONENT_SPLIT_REQUEST': True,
}

# CORS - use environment variable or default
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '["https://crypgo-6llg.onrender.com"]')
if isinstance(CORS_ALLOWED_ORIGINS, str):
    import json
    CORS_ALLOWED_ORIGINS = json.loads(CORS_ALLOWED_ORIGINS)

# Static & Media
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'css', BASE_DIR / 'js', BASE_DIR / 'img', BASE_DIR / 'fonts']

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Custom Settings
SITE_URL = os.getenv('SITE_URL', 'http://localhost:8000')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://crypgo-6llg.onrender.com')
CRYPGO_SERVICE_KEY = os.getenv('CRYPGO_SERVICE_KEY', '')
CRYPGO_API_URL = os.getenv('CRYPGO_API_URL', 'http://localhost:8000')

# Rate Limiting
MAX_EMAILS_PER_DAY = int(os.getenv('MAX_EMAILS_PER_DAY', 450))
MAX_EMAILS_PER_HOUR = int(os.getenv('MAX_EMAILS_PER_HOUR', 50))
MAX_EMAILS_PER_MINUTE = int(os.getenv('MAX_EMAILS_PER_MINUTE', 5))
DEFAULT_BATCH_SIZE = int(os.getenv('DEFAULT_BATCH_SIZE', 50))

# Warmup
WARMUP_ENABLED = os.getenv('WARMUP_ENABLED', 'True') == 'True'
WARMUP_START_DATE = os.getenv('WARMUP_START_DATE', None)

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} - {levelname} - {module} - {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} - {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': os.getenv('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'email_bot': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# TinyMCE Configuration
TINYMCE_DEFAULT_CONFIG = {
    'height': 500,
    'width': '100%',
    'menubar': 'file edit view insert format tools table help',
    'plugins': 'advlist autolink lists link image charmap print preview anchor '
               'searchreplace visualblocks code fullscreen insertdatetime media '
               'table paste code help wordcount',
    'toolbar': 'undo redo | bold italic underline strikethrough | '
               'fontselect fontsizeselect formatselect | '
               'alignleft aligncenter alignright alignjustify | '
               'outdent indent | numlist bullist | '
               'forecolor backcolor | link image media | '
               'removeformat | code',
    'content_style': 'body { font-family: Arial, sans-serif; font-size: 14px; }',
    'branding': False,
}


def _is_superuser(request):
    """Helper to check if user is superuser for Unfold sidebar permission"""
    return request.user.is_superuser


# Unfold Admin Configuration
UNFOLD = {
    "SITE_TITLE": "Email Bot Admin",
    "SITE_HEADER": "Email Automation System",
    "SITE_URL": "/",
    "SITE_ICON": None,
    "SITE_LOGO": None,
    "LOGIN": {
        "image": None,
    },
    "STYLES": ["/static/css/unfold_custom.css"],
    "SCRIPTS": ["/static/js/unfold_custom.js"],
    "COLORS": {
        "primary": "#4F46E5",
        "secondary": "#6366F1",
        "success": "#22C55E",
        "info": "#3B82F6",
        "warning": "#F59E0B",
        "danger": "#EF4444",
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": "Dashboard",
                "icon": "home",
                "link": "/admin/",
                "permission": lambda request: request.user.is_superuser,
                "items": [],
            },
            {
                "title": "Crypgo Recipients",
                "icon": "people",
                "items": [
                    {
                        "title": "Campaign Recipients",
                        "icon": "person",
                        "link": "/admin/campaigns/campaignlead/",
                    },
                    {
                        "title": "Blacklist",
                        "icon": "block",
                        "link": "/admin/leads/blacklistedlead/",
                    },
                ],
            },
            {
                "title": "Email Templates",
                "icon": "mail",
                "items": [
                    {
                        "title": "All Templates",
                        "icon": "description",
                        "link": "/admin/app_templates/emailtemplate/",
                    },
                    {
                        "title": "Create Template",
                        "icon": "add_circle",
                        "link": "/admin/app_templates/emailtemplate/add/",
                    },
                ],
            },
            {
                "title": "Campaigns",
                "icon": "send",
                "items": [
                    {
                        "title": "All Campaigns",
                        "icon": "list",
                        "link": "/admin/campaigns/campaign/",
                    },
                    {
                        "title": "Create Campaign",
                        "icon": "add_circle",
                        "link": "/admin/campaigns/campaign/add/",
                    },
                    {
                        "title": "Scheduled",
                        "icon": "schedule",
                        "link": "/admin/campaigns/campaign/?status__exact=scheduled",
                    },
                    {
                        "title": "Running",
                        "icon": "play_arrow",
                        "link": "/admin/campaigns/campaign/?status__exact=running",
                    },
                    {
                        "title": "Completed",
                        "icon": "check_circle",
                        "link": "/admin/campaigns/campaign/?status__exact=completed",
                    },
                ],
            },
            {
                "title": "Email Engine",
                "icon": "settings",
                "items": [
                    {
                        "title": "Send Logs",
                        "icon": "description",
                        "link": "/admin/email_engine/emaillog/",
                    },
                    {
                        "title": "Bounces",
                        "icon": "error",
                        "link": "/admin/email_engine/bounce/",
                    },
                    {
                        "title": "Tracking",
                        "icon": "track_changes",
                        "link": "/admin/email_engine/tracking/",
                    },
                ],
            },
            {
                "title": "Unsubscribes",
                "icon": "cancel",
                "link": "/admin/unsubscribes/unsubscribedlead/",
                "items": [],
            },
            {
                "title": "Webhooks",
                "icon": "sync_alt",
                "link": "/admin/webhooks/webhook/",
                "items": [],
            },
            {
                "title": "System",
                "icon": "server",
                "items": [
                    {
                        "title": "Settings",
                        "icon": "settings",
                        "link": "/admin/core/setting/",
                    },
                ],
            },
        ],
    },

}

# Default primary key
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

