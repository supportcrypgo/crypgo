# Render Deployment Guide - Crypgo

This guide provides all the configuration needed to deploy Crypgo on Render with proper environment variables.

## Services Overview

| Service | Type | URL Pattern |
|---------|------|-------------|
| Frontend | Node.js | `https://crypgo-frontend.onrender.com` |
| API (Django) | Python | `https://crypgo-api.onrender.com` |
| Email Bot (Django) | Python | `https://crypgo-email.onrender.com` |
| WebSocket | Node.js | `wss://crypgo-ws.onrender.com` |

---

## Environment Variables by Service

### 1. crypgo-frontend (Node.js)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Auto-set by Render |
| `CRYPGO_BACKEND_URL` | `https://crypgo-api.onrender.com` | Backend API URL |
| `NEXT_PUBLIC_API_URL` | `/backend-api` | Next.js rewrite path |
| `NEXT_PUBLIC_WS_URL` | `wss://crypgo-ws.onrender.com` | WebSocket URL |
| `COINGECKO_API_KEY` | *Your CoinGecko API Key* | Required by the frontend API routes |

### 2. crypgo-api (Python/Django)

| Variable | Value | Notes |
|----------|-------|-------|
| `DEBUG` | `False` | Production mode |
| `SECRET_KEY` | *Auto-generated* | Generate in Render Dashboard |
| `DATABASE_URL` | *Your Supabase connection string* | **Required - Add manually** |
| `DB_SCHEMA` | `crypgo` | Supabase schema |
| `ALLOWED_HOSTS` | `crypgo-api.onrender.com` | Single domain |
| `FRONTEND_URL` | `https://crypgo-frontend.onrender.com` | For CORS |
| `CORS_ALLOWED_ORIGINS` | `["https://crypgo-frontend.onrender.com"]` | JSON array |
| `CSRF_TRUSTED_ORIGINS` | `["https://crypgo-frontend.onrender.com"]` | JSON array |
| `CRYPGO_SERVICE_KEY` | *Auto-generated* | Service-to-service auth |
| `USE_GMAIL_API` | `True` | Enable Gmail API |
| `GMAIL_CLIENT_ID` | *Your Gmail Client ID* | **Required - Add manually** |
| `GMAIL_CLIENT_SECRET` | *Your Gmail Client Secret* | **Required - Add manually** |
| `GMAIL_REFRESH_TOKEN` | *Your Gmail Refresh Token* | **Required - Add manually** |
| `DEFAULT_FROM_EMAIL` | `support.crypgo@gmail.com` | Sender email |
| `EMAIL_FROM_NAME` | `Crypgo` | Sender name |

### 3. crypgo-email (Python/Django)

| Variable | Value | Notes |
|----------|-------|-------|
| `DEBUG` | `False` | Production mode |
| `DJANGO_SECRET_KEY` | *Auto-generated* | Generate in Render Dashboard |
| `DATABASE_URL` | *Your Supabase connection string* | **Required - Add manually** |
| `DB_SCHEMA` | `emailbot` | Supabase schema |
| `ALLOWED_HOSTS` | `crypgo-email.onrender.com` | Single domain |
| `SITE_URL` | `https://crypgo-email.onrender.com` | Full site URL |
| `FRONTEND_URL` | `https://crypgo-frontend.onrender.com` | For CORS |
| `USE_GMAIL_API` | `True` | Enable Gmail API |
| `GMAIL_CLIENT_ID` | *Your Gmail Client ID* | **Required - Add manually** |
| `GMAIL_CLIENT_SECRET` | *Your Gmail Client Secret* | **Required - Add manually** |
| `GMAIL_REFRESH_TOKEN` | *Your Gmail Refresh Token* | **Required - Add manually** |
| `DEFAULT_FROM_EMAIL` | `support.crypgo@gmail.com` | Sender email |
| `EMAIL_FROM_NAME` | `Crypgo` | Sender name |
| `EMAIL_X_MAILER` | `Crypgo Mailer` | X-Mailer header |
| `CRYPGO_API_URL` | `https://crypgo-api.onrender.com` | API service URL |
| `CRYPGO_SERVICE_KEY` | *Same as crypgo-api* | **Must match API service key** |

### 4. crypgo-ws (Node.js)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Auto-set by Render |
| `COINGECKO_API_KEY` | *Your CoinGecko API Key* | **Required - Add manually** |
| `PORT` | `5001` | Auto-set by Render (or use `WS_PORT`) |

---

## Required Manual Configuration (Secrets)

You **must** manually add these in Render Dashboard for each service:

### Database (Both Django services)
```
DATABASE_URL=postgresql://postgres.ytzjdrdcyymbxvbuxisn:YOUR_PASSWORD@aws-0-us-east-2.pooler.supabase.com:5432/postgres
```
- Use **Session Pooler** connection string from Supabase
- Encode special chars: `!` → `%21`, `@` → `%40`, `#` → `%23`, etc.

### Gmail API (Both Django services)
Get from: https://console.cloud.google.com/apis/credentials
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN` (Generate using `generate_refresh_token.py`)

### Service-to-Service Auth
- `CRYPGO_SERVICE_KEY` - Generate once, use **same value** in both:
  - crypgo-api: `CRYPGO_SERVICE_KEY`
  - crypgo-email: `CRYPGO_SERVICE_KEY`

### CoinGecko API (WebSocket)
Get from: https://www.coingecko.com/en/api/pricing
- `COINGECKO_API_KEY`

---

## Deployment Steps

### 1. Initial Setup
```bash
# Push to GitHub
git add .
git commit -m "Configure Render deployment"
git push origin main
```

### 2. Create Services in Render
1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create all 4 services

### 3. Configure Environment Variables
For **each service**, go to Settings → Environment and add the required variables from the tables above.

**Critical**: Set `DATABASE_URL` first for both Django services, then deploy.

### 4. Deploy Order
1. **crypgo-ws** (no dependencies)
2. **crypgo-api** (needs DATABASE_URL)
3. **crypgo-email** (needs DATABASE_URL, CRYPGO_API_URL, CRYPGO_SERVICE_KEY)
4. **crypgo-frontend** (needs CRYPGO_BACKEND_URL, NEXT_PUBLIC_WS_URL)

### 5. Verify Health Endpoints
After deployment, test:
- `https://crypgo-api.onrender.com/health/` → `OK`
- `https://crypgo-email.onrender.com/health/` → `OK`
- `https://crypgo-ws.onrender.com/health` → JSON response
- `https://crypgo-frontend.onrender.com` → Frontend loads

### 6. Test API Endpoints
- `https://crypgo-api.onrender.com/api/` → API root
- `https://crypgo-email.onrender.com/api/` → Email API root
- `https://crypgo-api.onrender.com/admin/` → Django admin
- `https://crypgo-email.onrender.com/admin/` → Email admin

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check service logs, verify `startCommand` |
| CORS errors | Verify `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` match frontend URL exactly |
| Database connection failed | Check `DATABASE_URL` format, ensure Supabase allows connections |
| Gmail API fails | Verify `GMAIL_REFRESH_TOKEN` is valid (re-generate if expired) |
| WebSocket not connecting | Check `NEXT_PUBLIC_WS_URL` uses `wss://` not `ws://` |
| Service-to-service auth fails | Ensure `CRYPGO_SERVICE_KEY` is identical in both Django services |

### Health Check URLs
```
API:        https://crypgo-api.onrender.com/health/
Email:      https://crypgo-email.onrender.com/health/
WebSocket:  https://crypgo-ws.onrender.com/health
Frontend:   https://crypgo-frontend.onrender.com
```

---

## Code Changes Made

### django_backend/core/urls.py
- Root path (`/`) now redirects to `/api/`
- Health check at `/health/`

### Bot/bot_project/urls.py
- Root path (`/`) redirects to `/admin/`
- API root at `/api-root/`
- Health check at `/health/`

### server/wsServer.mjs
- Added HTTP handler for root path (`/`) and health (`/health`)
- Returns JSON with service info and endpoints

---

## Next Steps After Deployment

1. **Run migrations** (if using external DB):
   ```bash
   # In Render shell for crypgo-api
   python manage.py migrate
   
   # In Render shell for crypgo-email
   python manage.py migrate
   ```

2. **Create superuser** (if needed):
   ```bash
   python manage.py createsuperuser
   ```

3. **Test login flow** with existing user accounts

4. **Verify WebSocket** prices appear in frontend dashboard

5. **Test email sending** via Email Bot admin

---

## Security Notes

- Never commit `DATABASE_URL`, `GMAIL_*`, `COINGECKO_API_KEY`, or `CRYPGO_SERVICE_KEY` to Git
- Use Render's "Sync: false" for secrets (already configured in render.yaml)
- Rotate `CRYPGO_SERVICE_KEY` periodically
- Monitor Render logs for errors after deployment