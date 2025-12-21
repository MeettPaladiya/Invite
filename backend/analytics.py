"""
Analytics endpoints for Invitewala Platform.
WhatsApp usage statistics and charts.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta

from .auth import require_sudo
from .database import get_cursor, get_whatsapp_stats

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/whatsapp")
async def get_whatsapp_analytics(
    days: int = Query(30, ge=1, le=365),
    user: dict = Depends(require_sudo)
):
    """Get WhatsApp usage statistics for dashboard charts."""
    stats = get_whatsapp_stats(days)
    return stats


@router.get("/overview")
async def get_overview_stats(user: dict = Depends(require_sudo)):
    """Get overview statistics for KPI cards."""
    with get_cursor() as cursor:
        # Total customers
        cursor.execute("SELECT COUNT(*) FROM customers")
        total_customers = cursor.fetchone()[0]
        
        # Total WhatsApp sends
        cursor.execute("SELECT COUNT(*) FROM whatsapp_logs")
        total_sends = cursor.fetchone()[0]
        
        # Successful sends
        cursor.execute("SELECT COUNT(*) FROM whatsapp_logs WHERE status = 'sent'")
        successful_sends = cursor.fetchone()[0]
        
        # Failed sends
        cursor.execute("SELECT COUNT(*) FROM whatsapp_logs WHERE status = 'failed'")
        failed_sends = cursor.fetchone()[0]
        
        # Success rate
        success_rate = (successful_sends / total_sends * 100) if total_sends > 0 else 0
        
        # Recent activity (last 7 days)
        cursor.execute("""
            SELECT COUNT(*) FROM whatsapp_logs 
            WHERE sent_at >= datetime('now', '-7 days')
        """)
        recent_sends = cursor.fetchone()[0]
        
        # Previous period (7-14 days ago) for comparison
        cursor.execute("""
            SELECT COUNT(*) FROM whatsapp_logs 
            WHERE sent_at >= datetime('now', '-14 days') 
            AND sent_at < datetime('now', '-7 days')
        """)
        prev_sends = cursor.fetchone()[0]
        
        # Calculate change percentage
        change = ((recent_sends - prev_sends) / prev_sends * 100) if prev_sends > 0 else 0
        
        return {
            "total_customers": total_customers,
            "total_sends": total_sends,
            "successful_sends": successful_sends,
            "failed_sends": failed_sends,
            "success_rate": round(success_rate, 1),
            "recent_sends": recent_sends,
            "change_percentage": round(change, 1)
        }
