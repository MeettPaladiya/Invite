from __future__ import annotations

import csv
import io
import json
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from pdf_personalizer.core import Config, Zone, Rect, MaskConfig, TextConfig, Align, VAlign, MaskMode
from pdf_personalizer.core.rasterizer import pdf_to_images, get_pdf_page_count
from pdf_personalizer.core.processor import BatchProcessor

router = APIRouter()

# Storage paths
STORAGE_DIR = Path("storage")
UPLOADS_DIR = STORAGE_DIR / "uploads"
OUTPUTS_DIR = STORAGE_DIR / "outputs"
PREVIEWS_DIR = STORAGE_DIR / "previews"

# In-memory session storage (for simplicity)
sessions: Dict[str, Dict[str, Any]] = {}


class ZoneData(BaseModel):
    zone_id: str
    page_number: int = 1
    x: float
    y: float
    width: float
    height: float
    font_size: float = 16.0
    color_hex: str = "#000000"
    align: str = "center"
    valign: str = "middle"  # top, middle, bottom
    mask_enabled: bool = True
    mask_mode: str = "auto_sample"
    manual_bg_color: Optional[str] = None  # User-selected override


class ZonesRequest(BaseModel):
    session_id: str
    zones: List[ZoneData]


class MappingRequest(BaseModel):
    session_id: str
    mapping: Dict[str, Any]  # {csv_column: zone_id} OR {csv_column: [zone_id1, zone_id2]}
    phone_column: Optional[str] = None  # Column containing phone numbers


class GenerateRequest(BaseModel):
    session_id: str
    preview_only: bool = False
    preview_row: int = 0


class WhatsAppRequest(BaseModel):
    session_id: str
    sender_number: str  # User's WhatsApp number
    message: Optional[str] = None # Custom message to send
    api_token: Optional[str] = None
    phone_id: Optional[str] = None


class WhatsAppReport(BaseModel):
    total: int
    sent: int
    failed: int
    details: List[Dict[str, Any]]


# ============ PDF Upload ============



@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a wedding card PDF template."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    session_id = str(uuid.uuid4())[:8]
    session_dir = UPLOADS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    pdf_path = session_dir / "template.pdf"
    with open(pdf_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Get page count
    page_count = get_pdf_page_count(str(pdf_path))
    
    # Generate preview images
    preview_dir = PREVIEWS_DIR / session_id
    preview_dir.mkdir(parents=True, exist_ok=True)
    
    images = pdf_to_images(str(pdf_path), dpi=150)
    preview_urls = []
    for i, img in enumerate(images):
        preview_path = preview_dir / f"page_{i + 1}.png"
        img.save(str(preview_path), "PNG")
        preview_urls.append(f"/storage/previews/{session_id}/page_{i + 1}.png")
    
    # Store session
    sessions[session_id] = {
        "pdf_path": str(pdf_path),
        "page_count": page_count,
        "preview_urls": preview_urls,
        "zones": [],
        "csv_data": None,
        "csv_columns": [],
        "mapping": {},
        "phone_column": None,
        "outputs": [],
    }
    
    return {
        "session_id": session_id,
        "page_count": page_count,
        "preview_urls": preview_urls,
        "message": "PDF uploaded successfully"
    }


# ============ CSV Upload ============

@router.post("/upload-csv")
async def upload_csv(session_id: str = Form(...), file: UploadFile = File(...)):
    """Upload a CSV file with guest data."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    text = content.decode("utf-8")
    
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    columns = reader.fieldnames or []
    
    # Save CSV
    csv_path = UPLOADS_DIR / session_id / "data.csv"
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    
    sessions[session_id]["csv_data"] = rows
    sessions[session_id]["csv_columns"] = columns
    sessions[session_id]["csv_path"] = str(csv_path)
    
    # Return first few rows as preview
    preview_rows = rows[:5] if len(rows) > 5 else rows
    
    return {
        "columns": columns,
        "row_count": len(rows),
        "preview_rows": preview_rows,
        "message": "CSV uploaded successfully"
    }


# ============ Zones ============

@router.post("/zones")
async def save_zones(request: ZonesRequest):
    """Save zone definitions."""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    zones = []
    for z in request.zones:
        zone = Zone(
            zone_id=z.zone_id,
            page_number=z.page_number,
            rect=Rect(x=z.x, y=z.y, width=z.width, height=z.height),
            mask=MaskConfig(
                enabled=z.mask_enabled,
                mode=MaskMode(z.mask_mode) if z.mask_mode else MaskMode.AUTO,
                color_hex=z.manual_bg_color,
                padding=2.0
            ),
            text=TextConfig(
                font_family="Noto Sans Gujarati",
                font_size=z.font_size,
                color_hex=z.color_hex,
                align=Align(z.align) if z.align else Align.CENTER,
                valign=VAlign(z.valign) if z.valign else VAlign.TOP
            )
        )
        zones.append(zone)
    
    sessions[request.session_id]["zones"] = zones
    
    return {"message": f"Saved {len(zones)} zones", "zones": len(zones)}


@router.get("/zones/{session_id}")
async def get_zones(session_id: str):
    """Get current zone definitions."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    zones = sessions[session_id].get("zones", [])
    return {
        "zones": [
            {
                "zone_id": z.zone_id,
                "page_number": z.page_number,
                "x": z.rect.x,
                "y": z.rect.y,
                "width": z.rect.width,
                "height": z.rect.height,
                "font_size": z.text.font_size,
                "color_hex": z.text.color_hex,
                "align": z.text.align.value,
            }
            for z in zones
        ]
    }


@router.post("/auto-detect/{session_id}")
async def auto_detect_zones(session_id: str):
    """
    Computer Vision: Scan for text blocks and suggest zones.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    
    # We use Page 1 Preview Image
    preview_path = PREVIEWS_DIR / session_id / "page_1.png"
    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="Preview not found")
        
    try:
        import cv2
        import numpy as np
        
        # Load
        img = cv2.imread(str(preview_path))
        h, w = img.shape[:2]
        
        # Preprocess
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Adaptive Threshold to indentify text
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        
        # Dilate to merge letter -> word -> sentence
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3)) # Wide kernel for horizontal text
        dilate = cv2.dilate(thresh, kernel, iterations=2)
        
        # Find Contours
        cnts = cv2.findContours(dilate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        
        suggested_zones = []
        
        # Convert PDF Point Scale (Preview is 150 DPI usually, but PDF zones are Points)
        # We need to map pixels back to points.
        # But wait, our 'preview_urls' are just images. Frontend maps image pixels to Zone Coordinates.
        # The Coordinate System in backend `sessions` is PDF POINTS.
        # But let's return PIXEL coordinates relative to the preview image,
        # AND let the Frontend convert them?
        # OR better: The Frontend "Zone Editor" works in % or pixels? 
        # App.jsx uses `react-pdf-highlighter` or similar? No, it uses a custom canvas/div overlay.
        # Let's verify App.jsx logic for coordinates.
        # Step 2 in App.jsx: It displays the image.
        # If we return a list of {x, y, w, h} in % of image?
        
        for c in cnts:
            x, y, cw, ch = cv2.boundingRect(c)
            
            # Filter noise
            if cw < 50 or ch < 20: continue # Too small
            if cw * ch < 1000: continue
            
            # Suggest
            suggested_zones.append({
                "x": x, "y": y, "width": cw, "height": ch,
                "confidence": 0.8
            })
            
        # Sort by Y (Top to Bottom)
        suggested_zones.sort(key=lambda z: z["y"])
        
        # Limit to top 10
        suggested_zones = suggested_zones[:10]
        
        return {"zones": suggested_zones, "image_width": w, "image_height": h}
        
    except Exception as e:
        logger.error(f"Auto Detect Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Mapping ============

@router.post("/mapping")
async def save_mapping(request: MappingRequest):
    """Save CSV column to zone mapping."""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    sessions[request.session_id]["mapping"] = request.mapping
    sessions[request.session_id]["phone_column"] = request.phone_column
    
    return {"message": "Mapping saved", "mapping": request.mapping}


# ============ Preview Generation ============

@router.post("/generate-preview")
async def generate_preview(request: GenerateRequest):
    """Generate a preview PDF for a single row."""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if not session.get("zones"):
        raise HTTPException(status_code=400, detail="No zones defined")
    if not session.get("csv_data"):
        raise HTTPException(status_code=400, detail="No CSV data uploaded")
    if not session.get("mapping"):
        raise HTTPException(status_code=400, detail="No column mapping defined")
    
    # Build config
    config = Config(
        template_id=request.session_id,
        base_pdf_path=session["pdf_path"],
        zones=session["zones"],
    )
    
    # Preview output directory
    preview_output_dir = PREVIEWS_DIR / request.session_id / "generated"
    preview_output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process single row
    processor = BatchProcessor(config, str(preview_output_dir), dpi=300)
    
    row_index = min(request.preview_row, len(session["csv_data"]) - 1)
    guest_data = session["csv_data"][row_index]
    
    output_path = processor.process_single_guest(guest_data, session["mapping"])
    
    # Return preview URL
    filename = Path(output_path).name
    # Cache Busting: Add unique token to force browser reload
    token = str(uuid.uuid4())[:8]
    preview_url = f"/storage/previews/{request.session_id}/generated/{filename}?t={token}"
    
    return {
        "preview_url": preview_url,
        "filename": filename,
        "guest_data": guest_data,
        "message": "Preview generated"
    }


# ============ Batch Generation ============

@router.post("/generate-all")
async def generate_all(request: GenerateRequest):
    """Generate PDFs for all rows in CSV."""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if not session.get("zones"):
        raise HTTPException(status_code=400, detail="No zones defined")
    if not session.get("csv_data"):
        raise HTTPException(status_code=400, detail="No CSV data uploaded")
    if not session.get("mapping"):
        raise HTTPException(status_code=400, detail="No column mapping defined")
    
    # Build config
    config = Config(
        template_id=request.session_id,
        base_pdf_path=session["pdf_path"],
        zones=session["zones"],
    )
    
    # Output directory
    output_dir = OUTPUTS_DIR / request.session_id
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process all rows
    processor = BatchProcessor(config, str(output_dir), dpi=300)
    output_paths = processor.process_batch(session["csv_data"], session["mapping"])
    
    # Store output info with guest data
    outputs = []
    for i, path in enumerate(output_paths):
        guest_data = session["csv_data"][i] if i < len(session["csv_data"]) else {}
        filename = Path(path).name
        outputs.append({
            "filename": filename,
            "url": f"/storage/outputs/{request.session_id}/{filename}",
            "path": path,
            "guest_data": guest_data,
            "phone": guest_data.get(session.get("phone_column", ""), ""),
        })
    
    session["outputs"] = outputs
    
    return {
        "count": len(outputs),
        "outputs": outputs,
        "message": f"Generated {len(outputs)} PDFs"
    }


# ============ Output Listing ============

@router.get("/outputs/{session_id}")
async def list_outputs(session_id: str):
    """List all generated PDFs for a session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    outputs = sessions[session_id].get("outputs", [])
    return {"outputs": outputs}


@router.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    """Download a generated PDF."""
    file_path = OUTPUTS_DIR / session_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/pdf"
    )


# ============ WhatsApp Integration ============

@router.post("/send-whatsapp")
async def send_whatsapp(request: WhatsAppRequest):
    """
    Send PDFs via WhatsApp.
    Modes:
    1. Cloud API (Background): If api_token & phone_id provided.
    2. Browser Automation (Foreground): Default fallback.
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    output_dir = OUTPUTS_DIR / request.session_id
    
    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="No generated PDFs found")

    outputs = session.get("outputs", [])
    phone_column = session.get("phone_column")
    
    if not outputs:
        # Fallback: list files on disk if outputs not in session
        files = list(output_dir.glob("*.pdf"))
        if not files:
            raise HTTPException(status_code=400, detail="No PDFs generated yet")
    if not phone_column:
        raise HTTPException(status_code=400, detail="No phone column specified in mapping")

    # === MODE 1: CLOUD API (Background) ===
    if request.api_token and request.phone_id:
        import requests
        import os
        
        details = []
        sent_c = 0
        failed_c = 0
        
        headers = {
            "Authorization": f"Bearer {request.api_token}",
            "Content-Type": "application/json"
        }
        media_url = f"https://graph.facebook.com/v17.0/{request.phone_id}/media"
        msg_url = f"https://graph.facebook.com/v17.0/{request.phone_id}/messages"
        
        files_map = {f.name: f for f in output_dir.glob("*.pdf")}

        # Iterate OUTPUTS list (which has phone numbers already mapped)
        active_outputs = outputs if outputs else []
        # If active_outputs empty, we can't map phones easily without session CSV.
        # But we assume session["outputs"] is populated.
        
        for item in active_outputs:
            fname = item["filename"]
            raw_phone = item["phone"]
            guest_name = item.get("guest_data", {}).get(session["mapping"].get("name_column"), "Guest")
            
            f_path = output_dir / fname
            
            # REVOKE check
            if not raw_phone or not raw_phone.strip():
                if f_path.exists():
                    os.remove(f_path)
                    details.append({"filename": fname, "status": "revoked", "error": "No Phone [Cloud]"})
                continue
                
            if not f_path.exists():
                details.append({"filename": fname, "status": "failed", "error": "PDF not found"})
                failed_c += 1
                continue
            
            try:
                phone = "".join(filter(str.isdigit, raw_phone))
                
                # Upload
                with open(f_path, 'rb') as f_obj:
                    m_res = requests.post(media_url, headers={"Authorization": headers["Authorization"]},
                                          files={'file': (fname, f_obj, 'application/pdf')},
                                          data={'messaging_product': 'whatsapp', 'type': 'application/pdf'})
                    
                    if m_res.status_code != 200:
                        raise Exception(f"Media Upload Failed: {m_res.text}")
                    media_id = m_res.json()["id"]
                
                # Send
                caption = (request.message or "Dear {name}, please find your invitation attached.").replace("{name}", guest_name)
                
                msg_body = {
                    "messaging_product": "whatsapp", "recipient_type": "individual", "to": phone, "type": "document",
                    "document": {"id": media_id, "filename": fname, "caption": caption}
                }
                
                s_res = requests.post(msg_url, headers=headers, json=msg_body)
                if s_res.status_code == 200:
                    details.append({"filename": fname, "phone": raw_phone, "status": "sent"})
                    sent_c += 1
                else:
                    details.append({"filename": fname, "phone": raw_phone, "status": "failed", "error": s_res.text})
                    failed_c += 1
            except Exception as e:
                details.append({"filename": fname, "phone": raw_phone, "status": "failed", "error": str(e)})
                failed_c += 1
        
        return WhatsAppReport(total=len(active_outputs), sent=sent_c, failed=failed_c, details=details)

    # === MODE 2: BROWSER AUTOMATION ===
    # Import WhatsApp sender
    try:
        from .whatsapp_sender import send_pdf_via_whatsapp
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="WhatsApp sender not available. Install pywhatkit: pip install pywhatkit"
        )
    
    report = {
        "total": len(outputs),
        "sent": 0,
        "failed": 0,
        "details": []
    }
    
    for output in outputs:
        phone = output.get("phone", "").strip()
        filename = output.get("filename", "")
        filepath = output.get("path", "")
        guest_name = output.get("guest_data", {}).get(
            session.get("mapping", {}).get(list(session.get("mapping", {}).keys())[0], ""), 
            "Guest"
        )
        
        if not phone:
            # REVOKE LOGIC: User requested to "revoke pdf" (delete it) if no whatsapp
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                    status = "revoked"
                    note = "PDF deleted (No WhatsApp number)"
                else:
                    status = "failed"
                    note = "File already missing"
            except Exception as e:
                status = "failed"
                note = f"Failed to delete: {e}"

            report["failed"] += 1
            report["details"].append({
                "filename": filename,
                "phone": "N/A",
                "status": status,
                "error": note
            })
            continue
        
        # Format phone number (ensure it starts with country code)
        if not phone.startswith("+"):
            phone = "+91" + phone.lstrip("0")  # Default to India
        
        # Determine message content
        if request.message:
            # Simple template replacement if user wants to use {name}
            final_message = request.message.replace("{name}", guest_name)
        else:
            final_message = f"Dear {guest_name}, please find your invitation attached."
        
        try:
            result = send_pdf_via_whatsapp(
                phone_number=phone,
                pdf_path=filepath,
                message=final_message,
                sender_number=request.sender_number
            )
            
            if result["success"]:
                report["sent"] += 1
                report["details"].append({
                    "filename": filename,
                    "phone": phone,
                    "status": "sent",
                    "guest_name": guest_name
                })
            else:
                report["failed"] += 1
                report["details"].append({
                    "filename": filename,
                    "phone": phone,
                    "status": "failed",
                    "error": result.get("error", "Unknown error")
                })
        except Exception as e:
            report["failed"] += 1
            report["details"].append({
                "filename": filename,
                "phone": phone,
                "status": "failed",
                "error": str(e)
            })
    
    # Save report
    report_path = OUTPUTS_DIR / request.session_id / "whatsapp_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    return report


@router.get("/whatsapp-report/{session_id}")
async def get_whatsapp_report(session_id: str):
    """Get WhatsApp delivery report."""
    report_path = OUTPUTS_DIR / session_id / "whatsapp_report.json"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="No WhatsApp report found")
    
    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)
    
    return report


# ============ Session Info ============

@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get current session state."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    return {
        "session_id": session_id,
        "has_pdf": bool(session.get("pdf_path")),
        "page_count": session.get("page_count", 0),
        "preview_urls": session.get("preview_urls", []),
        "zones_count": len(session.get("zones", [])),
        "csv_columns": session.get("csv_columns", []),
        "csv_row_count": len(session.get("csv_data", [])),
        "has_mapping": bool(session.get("mapping")),
        "outputs_count": len(session.get("outputs", [])),
    }
