# Gmail API Setup Guide for Crypgo

This guide walks you through generating the Gmail API credentials and refresh token needed for production email sending.

## Prerequisites

1. A Google Cloud Project
2. A Gmail account (support.crypgo@gmail.com)
3. Access to the Google Cloud Console

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `Crypgo Email API`
4. Click "Create"

---

## Step 2: Enable Gmail API

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Gmail API** → **Enable**

---

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - **App name**: Crypgo
   - **User support email**: support.crypgo@gmail.com
   - **Developer contact email**: support.crypgo@gmail.com
4. **Scopes**: Add `https://www.googleapis.com/auth/gmail.send`
5. **Test users**: Add `support.crypgo@gmail.com`
6. Save and continue through all steps

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Crypgo Gmail API Client`
5. **Authorized redirect URIs**: 
   - `http://localhost:8080/oauth2callback` (for local testing)
   - `https://crypgo-api.onrender.com/oauth2callback` (if you have a callback endpoint)
6. Click **Create**
7. **Copy the Client ID and Client Secret** - you'll need these!

---

## Step 5: Generate Refresh Token

### Option A: Using Google OAuth Playground (Easiest)

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the **gear icon** (⚙️) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter your **Client ID** and **Client Secret** from Step 4
5. Close the settings dialog
6. In **Step 1**, find "Gmail API v1" → Select `https://www.googleapis.com/auth/gmail.send`
7. Click **Authorize APIs**
8. Sign in with `support.crypgo@gmail.com` and grant permission
9. In **Step 2**, click **Exchange authorization code for tokens**
10. **Copy the Refresh Token** - this is what you need!

### Option B: Using Python Script (Local)

```python
# generate_refresh_token.py
import os
from google_auth_oauthlib.flow import InstalledAppFlow

# Use your credentials from Step 4
CLIENT_ID = 'your-client-id.apps.googleusercontent.com'
CLIENT_SECRET = 'your-client-secret'

flow = InstalledAppFlow.from_client_config(
    {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8080"]
        }
    },
    scopes=['https://www.googleapis.com/auth/gmail.send']
)

# This will open a browser window for authorization
creds = flow.run_local_server(port=8080)

print(f"Refresh Token: {creds.refresh_token}")
print(f"Access Token: {creds.token}")
```

Run it:
```bash
pip install google-auth-oauthlib
python generate_refresh_token.py
```

---

## Step 6: Configure Render Environment Variables

Go to your Render dashboard and set these environment variables for **both** `crypgo-api` and `crypgo-email` services:

| Variable | Value |
|----------|-------|
| `USE_GMAIL_API` | `True` |
| `GMAIL_CLIENT_ID` | Your Client ID from Step 4 |
| `GMAIL_CLIENT_SECRET` | Your Client Secret from Step 4 |
| `GMAIL_REFRESH_TOKEN` | Your Refresh Token from Step 5 |
| `DEFAULT_FROM_EMAIL` | `support.crypgo@gmail.com` |
| `EMAIL_FROM_NAME` | `Crypgo` |
| `EMAIL_X_MAILER` | `Crypgo Mailer` (email bot only) |

---

## Step 7: Test the Setup

After deploying to Render, test the email sending:

### Django Backend (crypgo-api)
```bash
# In Render shell for crypgo-api
python manage.py shell -c "
from django.core.mail import send_mail
send_mail(
    'Test from Crypgo API',
    'This is a test email via Gmail API',
    'support.crypgo@gmail.com',
    ['your-test-email@example.com'],
    fail_silently=False,
)
print('Email sent!')
"
```

### Email Bot (crypgo-email)
```bash
# In Render shell for crypgo-email
python manage.py shell -c "
from apps.email_engine.sender import sender
from apps.leads.models import Lead
from apps.templates.models import EmailTemplate

# Create a test lead and template or use existing
# Then test sending
print('Gmail API sender ready:', hasattr(sender, 'gmail_sender'))
"
```

---

## Step 8: Migrate SQLite Data to Supabase (Optional but Recommended)

Once Gmail API is working, migrate your local SQLite data to Supabase:

### For django_backend:
```bash
# Local
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
python manage.py migrate_to_supabase --dry-run
python manage.py migrate_to_supabase
```

### For Bot:
```bash
# Local
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
python manage.py migrate_to_supabase --dry-run
python manage.py migrate_to_supabase
```

---

## Important Notes

1. **Refresh Token Expiry**: Refresh tokens don't expire unless:
   - User revokes access in Google Account settings
   - Token hasn't been used for 6 months
   - Password is changed

2. **Rate Limits**: Gmail API has quotas:
   - 1 billion quota units/day
   - 250 quota units/user/second
   - Sending 1 email = ~100 quota units

3. **Security**: 
   - Never commit credentials to git
   - Use Render's "sync: false" for secrets
   - Rotate tokens periodically

4. **Fallback**: If Gmail API fails, the system falls back to SMTP (configured in settings)

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `invalid_grant` | Refresh token expired/revoked → Regenerate |
| `access_denied` | User didn't grant permission → Re-authorize |
| `invalid_client` | Wrong Client ID/Secret → Check credentials |
| `quota_exceeded` | Hit daily limit → Wait or request quota increase |

---

## Quick Checklist

- [ ] Google Cloud Project created
- [ ] Gmail API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created (Web app)
- [ ] Refresh token generated
- [ ] Render env vars set for crypgo-api
- [ ] Render env vars set for crypgo-email
- [ ] Test email sent successfully
- [ ] SQLite data migrated to Supabase (optional)