# VPS Deployment Guide for Research Dashboard

This guide provides step-by-step instructions for deploying the Research Dashboard on your VPS.

## Server Information
- **IP Address**: 45.149.156.216
- **OS**: Ubuntu (recommended)
- **Required Ports**: 22 (SSH), 80 (HTTP), 443 (HTTPS - optional)

## Prerequisites

1. **Server Requirements**:
   - Ubuntu 20.04 or later
   - Python 3.8+
   - Node.js 16+
   - Nginx
   - Git

2. **GitHub Secrets** (already configured):
   - `VPS_SSH_KEY`: SSH private key for deployment

## Initial Server Setup

### 1. Install Required Software
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install nodejs -y

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y
```

### 2. Clone Repository
```bash
cd /var/www
git clone https://github.com/zylen97/research-dashboard.git
cd research-dashboard
```

### 3. Backend Setup
```bash
cd backend

# Install Python dependencies
pip3 install -r requirements.txt

# Run database cleanup to initialize users
python3 clean_database.py
```

### 4. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Build production version
npm run build

# Copy to Nginx directory
sudo cp -r build/* /var/www/html/
```

### 5. Configure Nginx
```bash
# Copy the provided nginx configuration
sudo cp /var/www/research-dashboard/deployment/nginx.conf /etc/nginx/sites-available/research-dashboard

# Create symlink
sudo ln -s /etc/nginx/sites-available/research-dashboard /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 6. Setup Backend Service
```bash
# Copy systemd service file
sudo cp /var/www/research-dashboard/deployment/research-backend.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the service
sudo systemctl enable research-backend
sudo systemctl start research-backend

# Check status
sudo systemctl status research-backend
```

## Automatic Deployment

The GitHub Actions workflow will automatically deploy when you push to the main branch:

1. **Backend changes**: 
   - Backs up database
   - Pulls latest code
   - Restarts backend service

2. **Frontend changes**:
   - Pulls latest code
   - Builds frontend
   - Copies to Nginx directory

## User Accounts

Four default users are created automatically:
- **user1** / password123
- **user2** / password123
- **user3** / password123
- **user4** / password123

## Monitoring

### Check Service Status
```bash
# Backend service
sudo systemctl status research-backend
sudo journalctl -u research-backend -f

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Database Backup
Backups are automatically created in `/var/www/research-dashboard/backend/` when:
- Backend changes are deployed
- Database cleanup script is run

## Security Recommendations

1. **Change default passwords** immediately after deployment
2. **Setup SSL/HTTPS** using Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```
3. **Configure firewall**:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
4. **Create non-root user** for running services
5. **Regular updates**: Keep system and dependencies updated

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo journalctl -u research-backend -n 50

# Check if port 8080 is in use
sudo lsof -i :8080

# Restart service
sudo systemctl restart research-backend
```

### Frontend not accessible
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify files exist
ls -la /var/www/html/
```

### Database issues
```bash
# Re-run database initialization
cd /var/www/research-dashboard/backend
python3 clean_database.py

# Check database file permissions
ls -la research_dashboard.db
```

## Maintenance

### Manual deployment
```bash
cd /var/www/research-dashboard
git pull origin main

# For backend changes
sudo systemctl restart research-backend

# For frontend changes
cd frontend
npm run build
sudo cp -r build/* /var/www/html/
```

### Backup database manually
```bash
cd /var/www/research-dashboard/backend
python3 -c "from app.utils.backup_manager import BackupManager; BackupManager().create_backup('manual')"
```