# Environment Configuration Guide

## Overview

This project uses a unified codebase with environment-specific configurations to support both local development and VPS production deployment.

## Environment Structure

### Frontend Environment Files
- `.env.development` - Development environment configuration
- `.env.production` - Production environment configuration  
- `.env.local` - Local overrides (git ignored)
- `.env.example` - Configuration template

### Backend Environment Files
- `.env.example` - Configuration template
- `.env.development` - Development environment configuration
- `.env.production` - Production environment configuration
- `.env` - Active configuration (git ignored)

## Quick Start

### Local Development

1. **One-click start:**
   ```bash
   ./start-dev.sh
   ```
   This script will:
   - Check environment requirements
   - Set up environment configurations
   - Install dependencies
   - Start both frontend (port 3000) and backend (port 8080)

2. **Stop services:**
   ```bash
   ./stop-dev.sh
   ```

### Manual Setup

#### Frontend
```bash
cd frontend
cp .env.development .env.local  # Create local config
npm install
npm start
```

#### Backend
```bash
cd backend
cp .env.development .env  # Create local config
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Configuration Details

### Frontend Configuration

Key variables in `.env.*` files:
```env
REACT_APP_API_URL=http://localhost:8080      # API endpoint
REACT_APP_ENVIRONMENT=development             # Environment name
REACT_APP_DEBUG=true                          # Debug mode
REACT_APP_LOG_LEVEL=debug                     # Log level
```

### Backend Configuration

Key variables in `.env.*` files:
```env
# Environment
ENVIRONMENT=development

# Security
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Database
DATABASE_URL=sqlite:///./data/research_dashboard_dev.db

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Server
HOST=0.0.0.0
PORT=8080

# Logging
LOG_LEVEL=DEBUG
LOG_FILE=./logs/app.log
```

## Deployment

### Building for Production

```bash
./build.sh              # Builds with production config
./build.sh development  # Builds with development config
```

### VPS Deployment

The VPS deployment is automated via GitHub Actions:

1. Push to `main` branch
2. GitHub Actions triggers deployment
3. VPS runs `vps-update.sh` which:
   - Pulls latest code
   - Sets production environment
   - Deploys frontend to nginx
   - Restarts backend service

### Manual VPS Update

SSH to VPS and run:
```bash
cd /var/www/research-dashboard
./vps-update.sh
```

## Environment-Specific Behaviors

### Development Environment
- API documentation available at `/docs`
- Debug logging enabled
- Development database (`research_dashboard_dev.db`)
- CORS allows localhost origins

### Production Environment  
- API documentation hidden
- Error-level logging only
- Production database (`research_dashboard_prod.db`)
- CORS restricted to specific IPs

## Directory Structure

```
project/
├── frontend/
│   ├── .env.development     # Dev config
│   ├── .env.production      # Prod config
│   ├── .env.example         # Template
│   └── src/config/env.ts    # Config manager
├── backend/
│   ├── .env.development     # Dev config  
│   ├── .env.production      # Prod config
│   ├── .env.example         # Template
│   ├── app/core/config.py   # Config manager
│   ├── data/                # Database files (git ignored)
│   ├── logs/                # Log files (git ignored)
│   └── uploads/             # Upload files (git ignored)
├── start-dev.sh             # Dev environment launcher
├── stop-dev.sh              # Dev environment stopper
├── build.sh                 # Build script
└── vps-update.sh            # VPS deployment script
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3000  # Frontend
lsof -i :8080  # Backend

# Kill process
kill -9 <PID>
```

### Environment Variables Not Loading
1. Check if `.env` file exists
2. Verify file permissions
3. Restart the service

### Database Connection Issues
1. Check `DATABASE_URL` in environment config
2. Ensure data directory exists
3. Check file permissions

## Security Notes

1. **Never commit** `.env` files with real secrets
2. **Always change** default SECRET_KEY in production
3. **Use HTTPS** in production environments
4. **Restrict CORS** origins in production

## Best Practices

1. **Local Development**: Use `.env.development` as base
2. **Testing**: Create `.env.test` for test configurations
3. **Production**: Keep production secrets in VPS environment
4. **Version Control**: Only commit `.env.example` files