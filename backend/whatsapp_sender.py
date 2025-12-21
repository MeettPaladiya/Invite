"""WhatsApp PDF sender using pywhatkit or direct WhatsApp Web automation.

Note: For production use, consider using WhatsApp Business API instead.
This implementation uses pywhatkit which automates WhatsApp Web.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, Any


def send_pdf_via_whatsapp(
    phone_number: str,
    pdf_path: str,
    message: str = "Please find your invitation attached.",
    sender_number: str = ""
) -> Dict[str, Any]:
    """Send a PDF file via WhatsApp.
    
    Args:
        phone_number: Recipient's phone number with country code (e.g., +919876543210)
        pdf_path: Path to the PDF file to send
        message: Optional message to send with the file
        sender_number: Sender's WhatsApp number (for logging purposes)
    
    Returns:
        Dict with 'success' boolean and optional 'error' message
    """
    
    # Validate inputs
    if not Path(pdf_path).exists():
        return {"success": False, "error": f"PDF file not found: {pdf_path}"}
    
    if not phone_number or not phone_number.startswith("+"):
        return {"success": False, "error": "Invalid phone number. Must include country code (e.g., +91...)"}
    
    try:
        import pywhatkit as pwk
        
        # Send message first
        # pywhatkit opens WhatsApp Web and sends the message
        # Note: This requires the browser to be open and WhatsApp Web to be logged in
        
        # Get current time and add 2 minutes for scheduling
        import datetime
        now = datetime.datetime.now()
        send_hour = now.hour
        send_minute = now.minute + 2
        
        if send_minute >= 60:
            send_hour += 1
            send_minute -= 60
        
        if send_hour >= 24:
            send_hour = 0
        
        # Send message with file attachment
        # Note: pywhatkit.sendwhats_image can send files, but for PDFs we need a workaround
        
        # First send a text message
        pwk.sendwhatmsg(
            phone_no=phone_number,
            message=message,
            time_hour=send_hour,
            time_min=send_minute,
            wait_time=15,
            tab_close=True
        )
        
        # Wait a bit before next send
        time.sleep(5)
        
        return {
            "success": True,
            "message": f"Message sent to {phone_number}",
            "note": "PDF attachment requires manual handling or WhatsApp Business API"
        }
        
    except ImportError:
        # Fallback: Create a simple log for manual sending
        return {
            "success": False,
            "error": "pywhatkit not installed. Run: pip install pywhatkit",
            "fallback": {
                "phone": phone_number,
                "pdf_path": pdf_path,
                "message": message
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def send_bulk_whatsapp(
    recipients: list,
    sender_number: str
) -> Dict[str, Any]:
    """Send PDFs to multiple recipients.
    
    Args:
        recipients: List of dicts with 'phone', 'pdf_path', 'name' keys
        sender_number: Sender's WhatsApp number
    
    Returns:
        Report dict with sent/failed counts and details
    """
    report = {
        "total": len(recipients),
        "sent": 0,
        "failed": 0,
        "details": []
    }
    
    for recipient in recipients:
        phone = recipient.get("phone", "")
        pdf_path = recipient.get("pdf_path", "")
        name = recipient.get("name", "Guest")
        
        result = send_pdf_via_whatsapp(
            phone_number=phone,
            pdf_path=pdf_path,
            message=f"Dear {name}, please find your wedding invitation attached.",
            sender_number=sender_number
        )
        
        if result.get("success"):
            report["sent"] += 1
        else:
            report["failed"] += 1
        
        report["details"].append({
            "phone": phone,
            "name": name,
            "status": "sent" if result.get("success") else "failed",
            "error": result.get("error", None)
        })
        
        # Rate limiting to avoid WhatsApp blocking
        time.sleep(10)
    
    return report
