const path = require('path');
const PROJECT_ROOT = __dirname;

module.exports = {
  apps: [
    // CRYPTOGO DJANGO BACKEND (Port 8000)
    {
      name: 'crypgo-backend',
      script: path.join(PROJECT_ROOT, 'django_backend', '.venv', 'Scripts', 'python.exe'),
      args: 'manage.py runserver 8000',
      cwd: path.join(PROJECT_ROOT, 'django_backend'),
      env: {
        NODE_ENV: 'production',
        DEBUG: 'True',
        DJANGO_SETTINGS_MODULE: 'core.settings',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/crypgo-error.log',
      out_file: 'logs/crypgo-out.log',
      log_file: 'logs/crypgo-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
    },

    // BOT DJANGO BACKEND (Port 8001)
    {
      name: 'bot-backend',
      script: path.join(PROJECT_ROOT, 'Bot', 'venv', 'Scripts', 'python.exe'),
      args: 'manage.py runserver 8001',
      cwd: path.join(PROJECT_ROOT, 'Bot'),
      env: {
        NODE_ENV: 'production',
        DEBUG: 'True',
        DJANGO_SETTINGS_MODULE: 'bot_project.settings',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/bot-error.log',
      out_file: 'logs/bot-out.log',
      log_file: 'logs/bot-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
    },

    // FRONTEND (Next.js) - Port 5000
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: PROJECT_ROOT,
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_USE_FIXTURES: 'true',
        PORT: '5000',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: 'logs/frontend-error.log',
      out_file: 'logs/frontend-out.log',
      log_file: 'logs/frontend-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
    },

    // WEBSOCKET SERVER - Port 5001
    {
      name: 'websocket-server',
      script: 'server/wsServer.mjs',
      cwd: PROJECT_ROOT,
      env: {
        NODE_ENV: 'development',
        WS_PORT: '5001',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      error_file: 'logs/ws-error.log',
      out_file: 'logs/ws-out.log',
      log_file: 'logs/ws-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
    },

    // Cloudflare frontend tunnel
    {
      name: 'cloudflare-frontend',
      script: process.platform === 'win32'
        ? 'C:/Program Files (x86)/cloudflared/cloudflared.exe'
        : 'cloudflared',
      args: 'tunnel --url http://localhost:5000',
      cwd: PROJECT_ROOT,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '100M',
      error_file: 'logs/cloudflare-frontend-error.log',
      out_file: 'logs/cloudflare-frontend-out.log',
      log_file: 'logs/cloudflare-frontend-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
    },

    // Cloudflare backend tunnel (Django API - Port 8000)
    {
      name: 'cloudflare-backend',
      script: process.platform === 'win32'
        ? 'C:/Program Files (x86)/cloudflared/cloudflared.exe'
        : 'cloudflared',
      args: 'tunnel --url http://localhost:8000',
      cwd: PROJECT_ROOT,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '100M',
      error_file: 'logs/cloudflare-backend-error.log',
      out_file: 'logs/cloudflare-backend-out.log',
      log_file: 'logs/cloudflare-backend-combined.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
    },
  ],
  
  // Deploy configuration (for future use)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/crypgo.git',
      path: '/var/www/crypgo',
      'pre-deploy-local': 'npm run build',
      'post-deploy': 'npm run migrate && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
    },
  },
};