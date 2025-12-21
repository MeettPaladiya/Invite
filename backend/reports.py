"""
Report generation endpoints for Invitewala Platform.
Generates PDF work reports from customer data.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from pathlib import Path
import io

from .auth import require_admin, get_current_user
from .database import get_cursor

router = APIRouter(prefix="/api/reports", tags=["Reports"])

# Ensure reports directory exists
REPORTS_DIR = Path("storage/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class ReportRequest(BaseModel):
    title: Optional[str] = "Customer Report"
    include_sent: bool = True
    include_not_sent: bool = True
    date_from: Optional[str] = None
    date_to: Optional[str] = None


@router.get("")
async def list_reports(user: dict = Depends(require_admin)):
    """List all generated reports."""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT r.*, u.name as generated_by_name 
            FROM pdf_reports r
            LEFT JOIN users u ON r.generated_by = u.id
            ORDER BY r.created_at DESC
            LIMIT 50
        """)
        reports = [dict(row) for row in cursor.fetchall()]
        return {"reports": reports}


@router.post("/generate")
async def generate_report(request: ReportRequest, user: dict = Depends(require_admin)):
    """Generate a PDF work report from customer data."""
    try:
        # Fetch customer data
        with get_cursor() as cursor:
            cursor.execute("""
                SELECT c.*, 
                       (SELECT COUNT(*) FROM whatsapp_logs w WHERE w.customer_id = c.id AND w.status = 'sent') > 0 as card_sent,
                       (SELECT MAX(sent_at) FROM whatsapp_logs w WHERE w.customer_id = c.id AND w.status = 'sent') as sent_date
                FROM customers c
                ORDER BY c.created_at DESC
            """)
            customers = [dict(row) for row in cursor.fetchall()]
        
        # Filter based on request
        if not request.include_sent:
            customers = [c for c in customers if not c.get('card_sent')]
        if not request.include_not_sent:
            customers = [c for c in customers if c.get('card_sent')]
        
        # Generate PDF using simple HTML approach
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}.html"
        filepath = REPORTS_DIR / filename
        
        # Build HTML report
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>{request.title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        h1 {{ color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }}
        .meta {{ color: #666; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
        th {{ background: #6366f1; color: white; }}
        tr:nth-child(even) {{ background: #f9f9f9; }}
        .sent {{ color: green; font-weight: bold; }}
        .not-sent {{ color: red; }}
        .summary {{ background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
    </style>
</head>
<body>
    <h1>🎊 {request.title}</h1>
    <div class="meta">
        Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")} | 
        By: {user.get('name', user.get('email'))}
    </div>
    
    <div class="summary">
        <strong>Summary:</strong><br>
        Total Customers: {len(customers)}<br>
        Cards Sent: {len([c for c in customers if c.get('card_sent')])}<br>
        Pending: {len([c for c in customers if not c.get('card_sent')])}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>City</th>
                <th>Wedding Date</th>
                <th>Card Sent</th>
                <th>Sent Date</th>
                <th>Notes</th>
            </tr>
        </thead>
        <tbody>
"""
        
        for i, c in enumerate(customers, 1):
            sent_status = '<span class="sent">✓ Yes</span>' if c.get('card_sent') else '<span class="not-sent">✗ No</span>'
            html += f"""
            <tr>
                <td>{i}</td>
                <td>{c.get('first_name', '')} {c.get('last_name', '')}</td>
                <td>{c.get('phone', '-')}</td>
                <td>{c.get('email', '-')}</td>
                <td>{c.get('city', '-')}</td>
                <td>{c.get('wedding_date', '-')}</td>
                <td>{sent_status}</td>
                <td>{c.get('sent_date', '-') or '-'}</td>
                <td>{c.get('notes', '-')}</td>
            </tr>
"""
        
        html += """
        </tbody>
    </table>
    
    <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
        Generated by Invitewala Platform
    </div>
</body>
</html>
"""
        
        # Write HTML file
        filepath.write_text(html)
        
        # Record in database
        with get_cursor() as cursor:
            cursor.execute(
                "INSERT INTO pdf_reports (filename, generated_by, row_count) VALUES (?, ?, ?)",
                (filename, user['id'], len(customers))
            )
            report_id = cursor.lastrowid
        
        return {
            "id": report_id,
            "filename": filename,
            "url": f"/storage/reports/{filename}",
            "row_count": len(customers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_report(filename: str, user: dict = Depends(require_admin)):
    """Download a generated report."""
    filepath = REPORTS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    
    return FileResponse(
        path=filepath,
        media_type="text/html",
        filename=filename
    )
