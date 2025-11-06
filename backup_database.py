#!/usr/bin/env python3
"""
Database Backup Utility
Automatically backs up analytics.sqlite with timestamp
Keeps last 30 days of backups
"""

import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path("data/analytics.sqlite")
BACKUP_DIR = Path("data/backups")
RETENTION_DAYS = 30

def backup_database():
    """Create timestamped backup of database"""
    if not DB_PATH.exists():
        print(f"⚠️  Database not found: {DB_PATH}")
        return False

    # Create backup directory if needed
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Generate timestamp filename
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_name = f"analytics.backup.{timestamp}.sqlite"
    backup_path = BACKUP_DIR / backup_name

    # Copy database
    try:
        shutil.copy2(DB_PATH, backup_path)
        size_kb = backup_path.stat().st_size / 1024
        print(f"✅ Backup created: {backup_name} ({size_kb:.1f} KB)")
        return True
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False

def cleanup_old_backups():
    """Remove backups older than RETENTION_DAYS"""
    if not BACKUP_DIR.exists():
        return

    cutoff_date = datetime.now() - timedelta(days=RETENTION_DAYS)
    removed = 0

    for backup_file in BACKUP_DIR.glob("analytics.backup.*.sqlite"):
        # Get file modification time
        mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)

        if mtime < cutoff_date:
            try:
                backup_file.unlink()
                removed += 1
            except Exception as e:
                print(f"⚠️  Could not remove old backup {backup_file.name}: {e}")

    if removed > 0:
        print(f"🧹 Removed {removed} old backup(s)")

def list_backups():
    """List all available backups"""
    if not BACKUP_DIR.exists():
        print("No backups directory found")
        return

    backups = sorted(BACKUP_DIR.glob("analytics.backup.*.sqlite"), reverse=True)

    if not backups:
        print("No backups found")
        return

    print(f"\n📋 Available backups ({len(backups)} total):")
    for backup in backups[:10]:  # Show most recent 10
        size_kb = backup.stat().st_size / 1024
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        age = datetime.now() - mtime

        if age.days > 0:
            age_str = f"{age.days}d ago"
        elif age.seconds > 3600:
            age_str = f"{age.seconds // 3600}h ago"
        else:
            age_str = f"{age.seconds // 60}m ago"

        print(f"  • {backup.name} ({size_kb:.1f} KB, {age_str})")

def restore_backup(backup_name):
    """Restore database from backup"""
    backup_path = BACKUP_DIR / backup_name

    if not backup_path.exists():
        print(f"❌ Backup not found: {backup_name}")
        return False

    # Create backup of current database first
    if DB_PATH.exists():
        emergency_backup = DB_PATH.parent / f"{DB_PATH.name}.before-restore"
        shutil.copy2(DB_PATH, emergency_backup)
        print(f"🛡️  Current database saved to: {emergency_backup.name}")

    # Restore
    try:
        shutil.copy2(backup_path, DB_PATH)
        print(f"✅ Database restored from: {backup_name}")
        return True
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        return False

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "list":
            list_backups()
        elif command == "restore" and len(sys.argv) > 2:
            restore_backup(sys.argv[2])
        elif command == "cleanup":
            cleanup_old_backups()
        else:
            print("Usage:")
            print("  python backup_database.py          # Create backup")
            print("  python backup_database.py list     # List backups")
            print("  python backup_database.py restore <filename>")
            print("  python backup_database.py cleanup  # Remove old backups")
    else:
        # Default: create backup and cleanup
        print("🔄 Creating database backup...")
        if backup_database():
            cleanup_old_backups()
            list_backups()
