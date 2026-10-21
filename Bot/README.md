# Email Bot - Django Email Automation System

A comprehensive Django-based email marketing automation system with Unfold admin panel, REST API, email tracking, and campaign management.

## Features

- **Campaign Management** - Create, schedule, and manage email campaigns
- **Targeted Crypgo Sends** - Choose a saved template and select individual active Crypgo accounts from the Bot admin
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

For a one-off message to chosen Crypgo accounts, open **Campaigns → Send to
Selected Users** in the admin sidebar. Select an active template, tick only the
intended accounts, and queue the send. This creates a separate targeted
campaign and does not synchronize the full Crypgo audience. Accounts sharing
an inbox appear separately; selecting multiple accounts for the same inbox
groups delivery to one email, consistent with normal Crypgo campaign handling.

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

Campaigns can use two Gmail SMTP accounts in order: the primary account sends
up to 70 campaign emails per day, then the secondary account sends up to 70
more (140 total per campaign per day). The existing 40-per-hour cap and
90-second spacing remain in effect. Set both app passwords in PythonAnywhere's
environment configuration (or local `Bot/.env`); do not commit or share them:

```dotenv
EMAIL_HOST_USER=support.crypgo@gmail.com
EMAIL_HOST_PASSWORD=<support-app-password>
CAMPAIGN_SECONDARY_EMAIL=news.crypgo@gmail.com
CAMPAIGN_SECONDARY_EMAIL_PASSWORD=<news-app-password>
```

Apply the Bot database migration with `python manage.py migrate` before
resuming campaigns. Campaign email logs record which sender account was used.
Password-reset emails sent by the Django API remain fixed to
`support.crypgo@gmail.com`.

### ZeptoMail SMTP
Set these values in the Bot project's `Bot/.env` on PythonAnywhere. This file
is read by both the web app and Django management commands/scheduled tasks, and
must not be committed:

```dotenv
MAIL_PROVIDER=zeptomail
MAIL_HOST=smtp.zeptomail.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=emailapikey
MAIL_PASSWORD=<generated-zeptomail-smtp-password>
MAIL_FROM_ADDRESS=info@crypgo.us.ci
MAIL_FROM_NAME=info@crypgo.us.ci
```

Use a verified ZeptoMail sender address. After changing the file, reload the
PythonAnywhere web app; scheduled commands will use the settings the next time
they start. Gmail remains the default if `MAIL_PROVIDER` is not set to
`zeptomail`. Existing `ZEPTOMAIL_SMTP_*` setting names are also supported.

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

#### Campaign PDF Market Snapshot

Campaigns that attach account reports fetch one CoinGecko market snapshot before
the recipient loop. Each recipient PDF reads that local snapshot only; PDF
generation does not make market-data HTTP requests. The report identifies the
snapshot capture time, which can differ from an individual email's send time.

On PythonAnywhere, configure these in the Bot deployment's environment (or
`Bot/.env`) using an absolute path owned by the same account that runs the Bot
worker. Do not copy the example path literally; replace the username with the
actual PythonAnywhere account:

```dotenv
CRYPGO_REPORT_PRICE_CACHE=/home/<pythonanywhere-user>/.cache/crypgo/report_market_prices.json
COINGECKO_API_KEY_TIER=demo
# Optional. Keep the key secret and out of source control.
COINGECKO_API_KEY=
```

Use `COINGECKO_API_KEY_TIER=pro` only with a Pro key. The campaign worker passes
the configured absolute cache path and key to the report subprocess through its
environment/arguments; the report process runs as the Bot worker's OS user. The
cache directory is created on refresh. Ensure that account has permission to
write the snapshot and read it while building PDFs.

The campaign command refreshes prices once per run when account-report
attachments are enabled and pending Crypgo recipients exist. A resumed campaign
run refreshes once again. A failed refresh is logged; an existing snapshot is
used only while it is within the configured 24-hour freshness window. If there
is no fresh snapshot, the email can still send, but the report marks fiat
valuations unavailable rather than substituting zero or fabricated values.

To verify from the PythonAnywhere Bot project directory and virtualenv before
a campaign, use Django's Bot settings so the same `.env`, cache path, API key,
and subprocess environment are used as production sending:

```bash
python manage.py shell -c "from apps.core.management.commands.send_campaign import Command; raise SystemExit(0 if Command()._refresh_report_market_prices() else 1)"
```

The command exits nonzero if CoinGecko is unavailable or the snapshot cannot be
written. Do not start/resume production sending until the refresh succeeds or
you have deliberately accepted the fresh-snapshot fallback policy.

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