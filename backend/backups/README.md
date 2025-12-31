# Database Backups

This directory contains database backups for the Research Dashboard project.

## Structure

```
backups/
└── YYYYMMDD_HHMMSS/           # 按时间戳命名的备份目录
    ├── research_dashboard.db   # 数据库备份
    └── backup_info.txt         # 备份信息（可选）
```

## Backup Policy

- **Local backups**: Automatically created before database migrations or cleanups
- **Retention**: Keep last 7 backups, older ones are automatically deleted
- **Naming format**: `YYYYMMDD_HHMMSS` (e.g., `20250720_153045`)

## Usage

### Creating a backup manually
```bash
python utils/backup_manager.py create
```

### Restoring from backup
```bash
python utils/backup_manager.py restore YYYYMMDD_HHMMSS
```

### Listing available backups
```bash
python utils/backup_manager.py list
```

## Important Notes

- Backups in this directory are excluded from Git
- Server and GitHub backups are managed separately
- Always verify backup integrity after creation