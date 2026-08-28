# Gmail App Password Setup Guide

Since you're using Gmail SMTP for the email bot, you need to generate an **App Password** (not your regular Gmail password).

## Prerequisites
1. **2-Factor Authentication (2FA) must be enabled** on your Google account
2. You must use a **Google Account** (not a Google Workspace account unless admin allows it)

## Steps to Generate App Password

### 1. Enable 2FA (if not already enabled)
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click **2-Step Verification**
3. Follow the setup process

### 2. Generate App Password
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click **App passwords**
3. You may need to sign in again
4. At the bottom, click **Select app** → **Other (Custom name)**
5. Enter: `Crypgo Email Bot`
6. Click **Generate**
7. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)
8. **Save it securely** - you won't see it again!

## Add to Render Environment Variables

In Render dashboard, for the `crypgo-email` service, add these environment variables:

| Key | Value |
|-----|-------|
| `EMAIL_HOST_USER` | `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | `abcd efgh ijkl mnop` (the 16-char app password, no spaces) |
| `DEFAULT_FROM_EMAIL` | `your-email@gmail.com` |

## Important Notes
- **Remove spaces** from the app password when adding to Render
- The app password is **only visible once** - save it immediately
- If you lose it, you must generate a new one
- App passwords work even if you change your main Google password
- Each app/service should have its own app password for security

## Testing Locally
```bash
# Test SMTP connection
python -c "
import smtplib
server = smtplib.SMTP('smtp.gmail.com', 587)
server.starttls()
server.login('your-email@gmail.com', 'abcdefghijklmnop')
print('SMTP connection successful!')
server.quit()
"
```

## Troubleshooting
- **"Invalid credentials"**: Make sure 2FA is enabled and you're using the app password (not main password)
- **"Less secure app access"**: This setting no longer exists - must use App Passwords
- **Connection timeout**: Check firewall/network allows port 587
- **Authentication failed**: Verify email address and app password are correct