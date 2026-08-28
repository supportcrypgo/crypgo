# Email Bot - Django Email Automation System

A comprehensive Django-based email marketing automation system with Unfold admin panel, REST API, email tracking, and campaign management.

## Features

- **Campaign Management** - Create, schedule, and manage email campaigns
- **Lead Management** - Import, segment, and manage email lists with soft-delete support
- **Email Templates** - Rich text editor (TinyMCE) with placeholder variables
- **Email Tracking** - Open rates, click tracking, bounce handling
- **Unsubscribe Management** - One-click unsubscribe with confirmation pages
- **REST API** - Full REST API with Swagger documentation
- **Unfold Admin** - Modern admin interface with sidebar navigation
- **Webhook Support** - Event-driven webhooks for campaign events
- **Rate Limiting** - Configurable email sending limits
- **IP/Domain Warming** - Gradual sending volume increase
- **Backup System** - Automated database backups

## Tech Stack

- **Backend:** Django 4.2, Python 3.11+
- **Admin:** django-unfold (modern admin theme)
- **API:** Django REST Framework, drf-yasg (Swagger)
- **Editor:** TinyMCE (rich text email templates)
- **Import/Export:** django-import-export
- **Database:** SQLite (dev), PostgreSQL (production)
- **Email:** SMTP (Gmail, SendGrid, etc.)

## Quick Start

### 1. Clone & Setup

```bash
git clone <repository-url>
cd email-bot

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env` and update settings:

```bash
# Edit .env with your settings
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
SITE_URL=http://127.0.0.1:8000
```

### 3. Initialize Database

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic
```

### 4. Run Development Server

```bash
python manage.py runserver
```

Access the admin panel at `http://127.0.0.1:8000/admin/`

## Project Structure

```
├── bot_project/          # Project configuration
│   ├── settings.py       # Django settings
│   ├── urls.py           # Main URL routing
│   └── wsgi.py           # WSGI configuration
├── apps/                 # Django applications
│   ├── core/             # Core functionality, settings
│   ├── leads/            # Lead management
│   ├── templates/        # Email templates
│   ├── campaigns/        # Campaign management
│   ├── email_engine/     # Email sending & tracking
│   ├── unsubscribes/     # Unsubscribe handling
│   ├── webhooks/         # Webhook system
│   └── api/              # REST API
├── static/               # Static files
├── media/                # User-uploaded files
├── templates/            # Project-level templates
├── logs/                 # Log files
├── backups/              # Database backups
├── .env                  # Environment variables
└── requirements.txt      # Python dependencies
```

## API Endpoints

The API is available at `/api/v1/` with Swagger docs at `/api/docs/`.

### Main Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/leads/` | List all leads |
| `POST /api/v1/leads/` | Create a new lead |
| `GET /api/v1/campaigns/` | List campaigns |
| `POST /api/v1/campaigns/` | Create a campaign |
| `GET /api/v1/templates/` | List email templates |
| `GET /api/v1/analytics/` | Campaign analytics |

## Management Commands

```bash
# Send a specific campaign
python manage.py send_campaign --campaign-id 1

# Send all pending campaigns
python manage.py send_campaign

# Dry run (simulate sending)
python manage.py send_campaign --dry-run
```

## Email Provider Setup

### Gmail SMTP
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Update `.env` with credentials

### SendGrid
1. Create API key in SendGrid dashboard
2. Update `EMAIL_HOST` to `smtp.sendgrid.net`
3. Use API key as password

## Deployment

### PythonAnywhere
```bash
# After uploading code:
python manage.py migrate
python manage.py collectstatic
python manage.py createsuperuser
```

### Production Checklist
- [ ] Set `DEBUG=False` in `.env`
- [ ] Generate strong `DJANGO_SECRET_KEY`
- [ ] Configure proper email backend
- [ ] Set up PostgreSQL database
- [ ] Configure SSL/HTTPS
- [ ] Set up proper logging
- [ ] Configure backup schedule

## License

MIT