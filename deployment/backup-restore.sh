#!/bin/bash
# Database backup and restore script for VPS

BACKUP_DIR="/var/www/research-dashboard/backend/backups/server"
DB_PATH="/var/www/research-dashboard/backend/data/research_dashboard_prod.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

case "$1" in
    backup)
        echo "Creating database backup..."
        if [ -f "$DB_PATH" ]; then
            cp "$DB_PATH" "$BACKUP_DIR/research_dashboard_$TIMESTAMP.db"
            echo "✅ Backup created: $BACKUP_DIR/research_dashboard_$TIMESTAMP.db"
            
            # Keep only last 5 backups
            cd $BACKUP_DIR
            ls -t research_dashboard_*.db | tail -n +6 | xargs -r rm
            echo "✅ Old backups cleaned up (keeping last 5)"
        else
            echo "❌ Database file not found!"
            exit 1
        fi
        ;;
        
    restore)
        if [ -z "$2" ]; then
            echo "Usage: $0 restore <backup_filename>"
            echo "Available backups:"
            ls -la $BACKUP_DIR/research_dashboard_*.db 2>/dev/null
            exit 1
        fi
        
        BACKUP_FILE="$BACKUP_DIR/$2"
        if [ -f "$BACKUP_FILE" ]; then
            echo "Restoring from $BACKUP_FILE..."
            
            # Stop service
            sudo systemctl stop research-backend
            
            # Backup current database
            if [ -f "$DB_PATH" ]; then
                cp "$DB_PATH" "$DB_PATH.before_restore_$TIMESTAMP"
            fi
            
            # Restore
            cp "$BACKUP_FILE" "$DB_PATH"
            
            # Start service
            sudo systemctl start research-backend
            
            echo "✅ Database restored from $BACKUP_FILE"
            echo "✅ Service restarted"
        else
            echo "❌ Backup file not found: $BACKUP_FILE"
            exit 1
        fi
        ;;
        
    list)
        echo "Available backups:"
        ls -lah $BACKUP_DIR/research_dashboard_*.db 2>/dev/null || echo "No backups found"
        ;;
        
    *)
        echo "Usage: $0 {backup|restore|list}"
        echo "  backup  - Create a new backup"
        echo "  restore - Restore from a backup"
        echo "  list    - List available backups"
        exit 1
        ;;
esac