# Crypgo

## 🚀 Quick Start

### Option 1: Development Mode (Recommended)
Start all services with automatic migrations, health checks, and auto-restart:

**Windows:**
```bash
npm run start-dev
```

**Linux/Mac:**
```bash
npm run start-dev:nix
```

### Option 2: PM2 Production Mode
```bash
npm run pm2:dev
```

Manage PM2 services:
```bash
npm run pm2:stop    # Stop all services
npm run pm2:restart # Restart all services
npm run pm2:logs    # View logs
npm run pm2:monit   # Open monitoring UI
npm run pm2:health  # Check service status
```

### Option 3: Manual Start
```bash
# Terminal 1: Start Backend Services
npx ngrok config add-authtoken YOUR_NGROK_TOKEN  # If using ngrok
npm run dev              # Frontend (Next.js) - Port 5000
node server/wsServer.mjs # WebSocket server - Port 5001

# Terminal 2: Start Django Backends
cd Bot
venv\Scripts\python.exe manage.py migrate        # Run migrations
venv\Scripts\python.exe manage.py runserver 8001 # Bot API

cd ../django_backend
.venv\Scripts\python.exe manage.py migrate        # Run migrations
.venv\Scripts\python.exe manage.py runserver 8000 # Crypgo API
```

## 📱 Mobile Access

To access your frontend from your phone:

1. **Set your ngrok authtoken:**
   - Update `.env` file with: `NGROK_AUTHTOKEN=your_token_here`
   - Get token from: https://dashboard.ngrok.com/get-started/your-authtoken

2. **Start the dev environment:**
   ```bash
   npm run start-dev
   ```

3. **Open your phone and visit:**
   - Frontend: `https://your-unique-name.ngrok-free.app`
   - Bot API: `https://your-unique-name.ngrok-free.app/api/`
   - Crypgo API: `http://localhost:8000/api/schema/swagger-ui/`

⚠️ **Free ngrok tier warning:** ngrok free tier shows a browser warning page. Paid tier removes this. For development, you can accept the warning or use a VPN for mobile testing.

For local or ngrok hosting, the frontend uses root-relative assets. Set
`NEXT_PUBLIC_BASE_PATH=/Crypgo` only when building for the GitHub Pages path.

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start frontend only
npm run start-dev        # Start all services with migrations

# PM2 Management
npm run pm2:dev          # Start all services with PM2
npm run pm2:stop         # Stop PM2-managed services
npm run pm2:restart      # Restart PM2-managed services
npm run pm2:logs         # View service logs

# Database Migrations
npm run migrate:bot      # Run Bot database migrations
npm run migrate:crypgo   # Run Crypgo database migrations

# Logs
npm run logs:all         # View all service logs
npm run logs:frontend    # View frontend logs only
npm run logs:bot         # View Bot backend logs
npm run logs:crypgo      # View Crypgo backend logs

# Cleanup
npm run clean            # Clear log files and build cache

# Tunneling (legacy)
npm run tunnel:all       # Start all ngrok tunnels
npm run tunnel:frontend  # Start Frontend ngrok
npm run tunnel:crypgo    # Start Crypgo ngrok
npm run tunnel:bot       # Start Bot ngrok
npm run tunnel:ws        # Start WebSocket ngrok
```

## 🔧 Environment Variables

### Frontend (Root `.env`)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8001/api
NEXT_PUBLIC_WS_URL=ws://localhost:5001

# ngrok (optional - for mobile access)
NGROK_AUTHTOKEN=your_ngrok_token_here

# Development Mode
NEXT_PUBLIC_USE_FIXTURES=true
```

### Bot Backend (`Bot/.env`)
```bash
# Django Settings
DEBUG=True
SECRET_KEY=your_bot_secret_key
DJANGO_SETTINGS_MODULE=bot_project.settings
DATABASE_URL=sqlite:///db.sqlite3

# API Configuration
CRYPGO_API_URL=http://localhost:8000/api
CRYPGO_SERVICE_KEY=shared_secret_key_between_services

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_email_password
DEFAULT_FROM_EMAIL="Crypgo <support.crypgo@gmail.com>"

# Service Limits
MAX_EMAILS_PER_DAY=450
MAX_EMAILS_PER_HOUR=50
MAX_EMAILS_PER_MINUTE=5
WARMUP_ENABLED=True
```

### Crypgo Backend (`django_backend/.env`)
```bash
# Django Settings
DEBUG=True
SECRET_KEY=your_crypgo_secret_key
DJANGO_SETTINGS_MODULE=core.settings
DATABASE_URL=sqlite:///db.sqlite3

# API Configuration
BOT_SERVICE_URL=http://localhost:8001/api
BOT_SERVICE_KEY=shared_secret_key_between_services
```

## 📁 Project Structure

```
Crypgo/
├── Bot/                    # Bot Django Backend (Port 8001)
│   ├── manage.py
│   ├── venv/
│   ├── apps/
│   └── db.sqlite3
├── django_backend/          # Crypgo Django Backend (Port 8000)
│   ├── manage.py
│   ├── .venv/
│   ├── apps/
│   └── db.sqlite3
├── server/                  # WebSocket Server (Port 5001)
│   └── wsServer.mjs
├── src/                     # Next.js Frontend (Port 5000)
│   └── app/
├── scripts/                 # Startup and utility scripts
│   ├── start-dev.sh        # Linux/Mac development startup
│   └── start-dev.bat       # Windows development startup
├── logs/                    # Service logs (auto-created)
├── ecosystem.config.cjs     # PM2 configuration
└── package.json
```

## 🔌 APIs and Endpoints

### Frontend: http://localhost:5000
- Home page: `/`
- Auth pages: `/auth/login`, `/auth/register`
- User dashboard: `/dashboard`

### Bot API: http://localhost:8001
- Campaigns: `/api/campaigns/`
- Leads: `/api/leads/`
- Templates: `/api/templates/`
- Admin: `/admin/`

### Crypgo API: http://localhost:8000
- Schema: `/api/schema/swagger-ui/`
- Health: `/api/health/`
- Auth: `/api/auth/login/`, `/api/auth/register/`
- Users: `/api/users/me/`
- Wallet: `/api/wallet/assets/`
- Campaign: `/api/campaigns/`

### WebSocket: ws://localhost:5001
- Real-time price updates

## 📜 Local Ports

- Frontend (Next.js): `http://localhost:5000`
- **Bot API**: `http://localhost:8001`
- **Crypgo API**: `http://localhost:8000`
- WebSocket Server: `ws://localhost:5001`
- Frontend Tunnel (ngrok): `https://*.ngrok-free.app`

## 🔍 Troubleshooting

### Service won't start
```bash
# Stop any existing processes
npm run pm2:stop
pkill -f "manage.py runserver"
pkill -f "next dev"

# Clean and restart
npm run clean
npm run start-dev
```

### Database errors (e.g., "no such table")
```bash
# Run migrations
npm run migrate:bot
npm run migrate:crypgo
```

If the Bot migration command reports no pending migrations but `/admin/` still
reports `no such table: django_session`, the migration record and SQLite schema
are out of sync. Back up `Bot/db.sqlite3` first, then verify the database with
the Bot virtual environment before repairing migration state. Do not delete the
database as a first response because it contains leads, campaigns, and users.

### Bot admin is unavailable

The Bot admin is served at `http://localhost:8001/admin/`. A `302` response to
the login page is normal. `500` with `django_session` means the Bot database
schema is incomplete or the server is using a different database file. A
connection-refused error means the Bot process is not running on port `8001`.

### PM2 startup

Use the unified command so migrations run before PM2 starts the services:

```bash
npm run pm2:dev
npm run pm2:logs
npm run pm2:stop
```

ngrok is optional. Its free public URL is temporary and goes offline whenever
the tunnel process stops; it does not indicate whether the local services are
healthy.

### Logs
```bash
# View all logs in real-time
npm run logs:all

# Or view specific service logs
npm run logs:crypgo
npm run logs:bot
npm run logs:frontend
```

### Check service health
Open your browser and visit:
- Bot API health: `http://localhost:8001/health/`
- Crypgo API health: `http://localhost:8000/health/`
- Frontend: `http://localhost:5000`
- PM2 status: `npm run pm2:health`

## 🧪 Testing the Campaign Feature

1. Start all services: `npm run start-dev`
2. Access Bot Admin: `http://localhost:8001/admin/`
3. Create a new campaign
4. Click "Sync current Crypgo users" (in campaign actions)
5. Test email delivery with Django's mail backend
6. For real email testing, update email settings in Bot/.env

## 📊 Campaign Recipient Flow

```
1. Crypgo Backend (Port 8000)
   ↓ (HMAC authenticated export)
   ["{email, name, dashboard_url}", ...]

2. Bot Backend (Port 8001)
   ↓ (Upsert campaign recipients)
   Campaign Recipient records created

3. Admin creates/send campaign
   ↓ (Personalized emails)
   SMTP delivery with donor's name

4. Recipient clicks email link
   ↓ (Secure authentication)
   Redirects to their own Crypgo dashboard
```

## 🎯 Development Workflow

```bash
# Daily development
npm run start-dev              # All services
npm run dev                    # Just frontend + backend
npm run logs:all               # Monitor activity

# Fixing migrations
npm run migrate:bot            # Check Bot migrations
npm run migrate:crypgo         # Check Crypgo migrations

# Debug issues
npm run pm2:logs
npm run pm2:monit              # Real-time monitoring

# Preparing for production
npm run migrate:bot             # Finalize all migrations
npm run clean                   # Clear build cache
npm run build                   # Build frontend for production
```

## 🔐 Security Notes

- Never commit `.env` files to version control
- Use strong secret keys in production
- Set `DEBUG=False` in production
- Enable HTTPS for production deployment
- Rotate ngrok tokens periodically (free tier has rate limits)
- Configure CORS properly for production domains

## 🔧 Additional Resources

- **ngrok Documentation**: https://ngrok.com/docs
- **Django Docs**: https://docs.djangoproject.com/
- **Next.js Docs**: https://nextjs.org/docs
- **PM2 Docs**: https://pm2.keymetrics.io/docs/

## 📝 License

[Your License Here]
