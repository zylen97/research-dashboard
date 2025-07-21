# Research Dashboard

A modern research project management system with built-in authentication and collaboration features.

## 🚀 Features

### Authentication & Security
- **Pre-configured Users**: 4 built-in users (zl, zz, yq, dz) with secure authentication
- **JWT Token System**: Secure session management with automatic expiration
- **Enhanced Security**: CORS protection, rate limiting, input validation
- **Secure API**: All endpoints protected with authentication middleware

### Research Management
- **Project Dashboard**: Create and manage research projects with progress tracking
- **Todo System**: Mark projects as todo items for quick access
- **Collaborator Management**: Organize team members and research groups
- **Communication Logs**: Track all project-related communications
- **Real-time Updates**: Instant data synchronization across all users

### Literature & Ideas
- **Literature Discovery**: Import and manage research papers
- **AI Validation**: Validate literature relevance with AI assistance
- **Idea Pool**: Centralized idea management with priority tracking
- **Knowledge Graph**: Convert validated literature into actionable ideas

### Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Clean Interface**: Intuitive design with Ant Design components
- **Smart Tables**: Sortable, filterable, and searchable data views
- **Real-time Feedback**: Loading states and error handling

### Data Management
- **Environment-Based Databases**: Automatic separation of dev/prod data
- **Built-in Backup System**: GUI-based backup management
- **Automated Backups**: Configurable retention policies
- **One-Click Restore**: Easy database recovery with safety checks

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Ant Design 5** for UI components
- **React Context** for state management
- **Axios** for API communication

### Backend
- **FastAPI** (Python 3.10+)
- **SQLAlchemy** ORM
- **SQLite** database
- **JWT** authentication
- **Pydantic** validation

### Deployment
- **GitHub Actions** for CI/CD
- **Nginx** reverse proxy
- **Systemd** service management
- **Automated deployment** to VPS

## 📁 Project Structure

```
research-dashboard/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── contexts/        # React contexts
│   │   └── types/           # TypeScript definitions
│   └── package.json
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── models/          # Database models
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Utilities (including backup_manager)
│   │   ├── middleware/      # Security middleware
│   │   └── core/            # Configuration management
│   ├── scripts/             # Database initialization scripts
│   ├── data/                # Environment-specific databases
│   ├── backups/             # Database backups
│   ├── main.py             # Application entry
│   └── requirements.txt
├── deploy-scripts/          # Deployment scripts
│   ├── deploy.sh           # Git push and deployment
│   └── vps-update.sh       # VPS update script
├── deployment/              # Deployment configurations
│   ├── nginx.conf          # Nginx configuration
│   └── research-backend.service  # Systemd service
├── .github/workflows/       # GitHub Actions
└── start-dev.sh            # Local development script
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### Local Development

```bash
# Clone repository
git clone https://github.com/zylen97/research-dashboard.git
cd research-dashboard

# Setup and run
./setup.sh        # Install dependencies
./start-dev.sh    # Start both frontend and backend
```

### Access
- Frontend: http://localhost:3001
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

### Default Users
| Username | Password | Description |
|----------|----------|-------------|
| zl       | 123      | User 1      |
| zz       | 123      | User 2      |
| yq       | 123      | User 3      |
| dz       | 123      | User 4      |

## 🌐 Production Deployment

### Automated Deployment
Every push to `main` branch automatically deploys to VPS via GitHub Actions.

### Manual Deployment
```bash
# Use the deployment script
./deploy-scripts/deploy.sh

# Or manually
git add .
git commit -m "Your changes"
git push origin main  # Triggers automatic deployment
```

### Server Configuration
- **OS**: Ubuntu 20.04+
- **Web Server**: Nginx
- **Process Manager**: Systemd
- **Database**: SQLite (auto-backed up)

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Research Projects
- `GET /api/research` - List all projects
- `POST /api/research` - Create project
- `PUT /api/research/{id}` - Update project
- `DELETE /api/research/{id}` - Delete project
- `GET /api/research/{id}/logs` - Get communication logs

### Collaborators
- `GET /api/collaborators` - List collaborators
- `POST /api/collaborators` - Add collaborator
- `PUT /api/collaborators/{id}` - Update collaborator
- `DELETE /api/collaborators/{id}` - Delete collaborator

### Literature & Ideas
- `GET /api/literature` - List literature
- `POST /api/literature` - Add literature
- `POST /api/literature/validate` - AI validation
- `GET /api/ideas` - List ideas
- `POST /api/ideas` - Create idea

### Database Backup
- `GET /api/backup/stats` - Get backup statistics
- `GET /api/backup/list` - List all backups
- `POST /api/backup/create` - Create new backup
- `POST /api/backup/restore/{id}` - Restore from backup
- `DELETE /api/backup/{id}` - Delete backup
- `GET /api/backup/download/{id}` - Download backup file

## 🔧 Development

### Backend Development
```bash
cd backend
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8080
```

### Frontend Development
```bash
cd frontend
npm install
npm start  # Runs on http://localhost:3001
```

### Database Management

#### Environment-Based Configuration
The system automatically manages separate databases for development and production:
- **Development**: `backend/data/research_dashboard_dev.db`
- **Production**: `backend/data/research_dashboard_prod.db`

#### Initialize Database
```bash
cd backend/scripts
./init-db.sh  # Automatically detects environment

# For production environment
ENVIRONMENT=production ./init-db.sh
```

#### Backup Management
The application includes a built-in backup management system:
- Access via user menu → "数据库备份" (Database Backup)
- Features:
  - Create manual backups with custom descriptions
  - Automatic retention of last 7 backups
  - Download backups as compressed files
  - Restore from any backup point
  - View backup statistics and storage usage

#### CLI Backup Operations
```bash
cd backend
# Create backup
python -m app.utils.backup_manager create "description"

# List backups
python -m app.utils.backup_manager list

# Restore backup
python -m app.utils.backup_manager restore BACKUP_NAME
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the ports
lsof -i :3001
lsof -i :8080

# Kill processes if needed
kill -9 <PID>
```

### Database Issues
```bash
# Reset database (development)
cd backend/scripts
./init-db.sh

# Reset database (production - be careful!)
ENVIRONMENT=production ./init-db.sh

# Or use the backup system
cd backend
python -m app.utils.backup_manager restore BACKUP_NAME
```

### Deployment Issues
- Check GitHub Actions logs
- SSH to server and check systemd logs:
  ```bash
  sudo journalctl -u research-backend -f
  ```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with modern web technologies
- Designed for research collaboration
- Automated deployment for easy maintenance

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>