"""
Database module for Invitewala Platform.
Uses SQLite for MVP, can be migrated to PostgreSQL later.
"""
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
import bcrypt
from datetime import datetime

# Database file location
DB_PATH = Path(__file__).parent.parent / "storage" / "invitewala.db"


def get_connection():
    """Get a database connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_cursor():
    """Context manager for database operations."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database tables."""
    with get_cursor() as cursor:
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                role TEXT CHECK(role IN ('sudo_admin', 'admin', 'designer')) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)
        
        # Customers table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT,
                phone TEXT,
                email TEXT,
                city TEXT,
                wedding_date DATE,
                designer_id INTEGER REFERENCES users(id),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # WhatsApp Logs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS whatsapp_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER REFERENCES customers(id),
                session_id TEXT,
                phone TEXT,
                status TEXT CHECK(status IN ('sent', 'failed', 'revoked', 'pending')),
                error_message TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # PDF Reports table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pdf_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                generated_by INTEGER REFERENCES users(id),
                row_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tasks table (for task management)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                assigned_to INTEGER REFERENCES users(id),
                status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
                priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
                due_date DATE,
                related_customer_id INTEGER REFERENCES customers(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create default sudo admin if not exists
        cursor.execute("SELECT id FROM users WHERE role = 'sudo_admin' LIMIT 1")
        if not cursor.fetchone():
            # Default password: "admin123" (change in production!)
            default_hash = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
            cursor.execute(
                "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
                ("admin@invitewala.com", default_hash, "Super Admin", "sudo_admin")
            )
            print("✅ Created default sudo admin: admin@invitewala.com / admin123")


# ============ User Operations ============

def create_user(email: str, password: str, name: str, role: str = "admin") -> int:
    """Create a new user. Returns user ID."""
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    with get_cursor() as cursor:
        cursor.execute(
            "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
            (email, password_hash, name, role)
        )
        return cursor.lastrowid


def verify_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify user credentials. Returns user dict if valid, None otherwise."""
    with get_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        
        if row and bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
            # Update last login
            cursor.execute(
                "UPDATE users SET last_login = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), row["id"])
            )
            return dict(row)
    return None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    with get_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email."""
    with get_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_users() -> List[Dict[str, Any]]:
    """List all users (for sudo admin)."""
    with get_cursor() as cursor:
        cursor.execute("SELECT id, email, name, role, created_at, last_login FROM users")
        return [dict(row) for row in cursor.fetchall()]


# ============ WhatsApp Log Operations ============

def log_whatsapp_send(session_id: str, phone: str, status: str, 
                      customer_id: int = None, error_message: str = None):
    """Log a WhatsApp send attempt."""
    with get_cursor() as cursor:
        cursor.execute(
            """INSERT INTO whatsapp_logs 
               (session_id, customer_id, phone, status, error_message) 
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, customer_id, phone, status, error_message)
        )


def get_whatsapp_stats(days: int = 30) -> Dict[str, Any]:
    """Get WhatsApp usage statistics."""
    with get_cursor() as cursor:
        # Total counts
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) as revoked
            FROM whatsapp_logs
            WHERE sent_at >= datetime('now', ?)
        """, (f"-{days} days",))
        row = cursor.fetchone()
        
        # Daily breakdown
        cursor.execute("""
            SELECT 
                DATE(sent_at) as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
            FROM whatsapp_logs
            WHERE sent_at >= datetime('now', ?)
            GROUP BY DATE(sent_at)
            ORDER BY date
        """, (f"-{days} days",))
        daily = [dict(r) for r in cursor.fetchall()]
        
        return {
            "total": row["total"] or 0,
            "sent": row["sent"] or 0,
            "failed": row["failed"] or 0,
            "revoked": row["revoked"] or 0,
            "daily": daily
        }


# Initialize database on import
init_db()
