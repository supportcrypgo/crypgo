import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from the django_backend directory
# override=True ensures .env file values take precedence over system env vars
load_dotenv(BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('SECRET_KEY')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'localhost:8000', '.trycloudflare.com']

# Application definition
INSTALLED_APPS = [
    # Local apps must come before 'unfold' to allow template overrides
    'apps.users',
    'unfold',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
# Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'apps' / 'users' / 'templates',
            BASE_DIR / 'templates',
        ],
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

WSGI_APPLICATION = 'core.wsgi.application'

# Database - SQLite for development
# To switch to PostgreSQL, replace this block with the commented PostgreSQL section below.
# Make sure PostgreSQL is installed and running, and update the .env with your credentials.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# # PostgreSQL Configuration (for production use)
# # Uncomment and comment out the SQLite block above to use PostgreSQL.
# # Make sure PostgreSQL is installed and running, and update the .env with your credentials.
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': os.getenv('DB_NAME', 'crypgo_db'),
#         'USER': os.getenv('DB_USER', 'crypgo_user'),
#         'PASSWORD': os.getenv('DB_PASSWORD'),
#         'HOST': os.getenv('DB_HOST', 'localhost'),
#         'PORT': os.getenv('DB_PORT', '5432'),
#     }
# }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files (user uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'users.CustomUser'

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:8000",
    "http://localhost:8001",
]

CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration - trust frontend origin
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5000",
]

# Cookie settings for security
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG  # Set True in production with HTTPS
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # JavaScript needs access to CSRF token
CSRF_COOKIE_SECURE = not DEBUG  # Set True in production with HTTPS

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/hour',
        'user': '10000/hour',
        'login': '10/minute',
        'register': '20/minute',
        'password_reset': '10/hour',
        'user_me': '60/minute',
        'wallet_assets': '120/minute',
        'wallet_transactions': '80/minute',
        'security_health': '60/minute',
        'p2p_marketplace': '120/minute',
    },
}

# drf-spectacular Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Crypgo API',
    'DESCRIPTION': 'Crypgo Cryptocurrency Platform API Documentation',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/',
    'CONTACT': {
        'name': 'Crypgo Support',
        'email': 'support@crypgo.com',
    },
    'LICENSE': {
        'name': 'Proprietary',
    },
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': not DEBUG,  # Set True in production with HTTPS
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# Email Configuration - Gmail SMTP for email bot campaigns
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '465'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False') == 'True'
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'True') == 'True'
EMAIL_HOST_USER = 'support.crypgo@gmail.com'
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = 'support.crypgo@gmail.com'
EMAIL_FROM_NAME = 'Crypgo'

# Password Reset Token Settings
PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 24
MAGIC_LINK_EXPIRY_MINUTES = int(os.getenv('MAGIC_LINK_EXPIRY_MINUTES', '15'))
MAGIC_LINK_EXPIRY_HOURS = int(os.getenv('MAGIC_LINK_EXPIRY_HOURS', '1'))
CAMPAIGN_ACCESS_EXPIRY_MINUTES = int(os.getenv('CAMPAIGN_ACCESS_EXPIRY_MINUTES', str(24 * 60)))
BOT_SERVICE_URL = os.getenv('BOT_SERVICE_URL', 'http://localhost:8001')
BOT_SERVICE_KEY = os.getenv('BOT_SERVICE_KEY', '')

# Frontend URL for reset link
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Django Unfold Configuration
UNFOLD = {
    "SITE_TITLE": "Crypgo Admin",
    "SITE_HEADER": "Crypgo",
    "SITE_URL": "/",
    "SITE_ICON": None,
    "LOGIN": {
        "image": None,
    },
    "COLORS": {
        "primary": {
            "50": "250 245 255",
            "100": "243 232 255",
            "200": "233 213 255",
            "300": "216 180 254",
            "400": "192 132 252",
            "500": "168 85 247",
            "600": "147 51 234",
            "700": "126 34 206",
            "800": "107 33 168",
            "900": "88 28 135",
        },
    },
}

