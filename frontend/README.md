# Invitewala Platform - Project Documentation

## How We Send Wedding Cards Through WhatsApp API

This document explains the complete workflow of how personalized wedding invitation cards are generated and sent to guests via WhatsApp.

---

## 🎯 Overview

The **Invitewala Platform** is a wedding card personalization and distribution system that:

1. Takes a wedding card PDF template
2. Personalizes it with guest names from a CSV file
3. Generates individual PDFs for each guest
4. Sends the personalized cards via WhatsApp

---

## 📋 Complete Workflow

### Step 1: Upload Wedding Card Template (PDF)

```
User uploads a PDF → Backend stores it → Preview images generated
```

**API Endpoint:** `POST /api/upload-pdf`

- The user uploads a wedding card PDF template
- The system generates a unique `session_id`
- The PDF is converted to preview images (PNG) at 150 DPI
- Preview URLs are returned for the frontend to display

**Backend Code:** `backend/routes.py` → `upload_pdf()`

---

### Step 2: Define Text Zones

```
User draws zones on the PDF → Zones saved with coordinates
```

**API Endpoint:** `POST /api/zones`

The user visually draws rectangles on the PDF preview to define where guest information should appear. Each zone includes:

| Property | Description |
|----------|-------------|
| `zone_id` | Unique identifier (e.g., `zone_1`) |
| `page_number` | Which page of the PDF |
| `x, y, width, height` | Position in PDF points |
| `font_size` | Text size |
| `color_hex` | Text color (e.g., `#000000`) |
| `align` | Horizontal alignment (left, center, right) |
| `valign` | Vertical alignment (top, middle, bottom) |
| `mask_enabled` | Whether to mask the background |
| `mask_mode` | `auto_sample` - samples background color automatically |

---

### Step 3: Upload Guest Data (CSV)

```
User uploads CSV → Columns extracted → Preview shown
```

**API Endpoint:** `POST /api/upload-csv`

The CSV file contains guest information:

```csv
નામ,Phone,City
રાજેશ પટેલ,+919876543210,અમદાવાદ
મિતાલી શાહ,+919876543211,સુરત
```

The system extracts column names and stores the data for processing.

---

### Step 4: Map CSV Columns to Zones

```
User maps: "નામ" column → zone_1
```

**API Endpoint:** `POST /api/mapping`

The user specifies:
- Which CSV column maps to which zone
- Which column contains phone numbers (for WhatsApp)

**Example Mapping:**
```json
{
  "mapping": {
    "નામ": "zone_1",
    "City": "zone_2"
  },
  "phone_column": "Phone"
}
```

---

### Step 5: Generate Personalized PDFs

```
For each guest → Mask zone → Render text → Save PDF
```

**API Endpoints:**
- `POST /api/generate-preview` - Generate single preview
- `POST /api/generate-all` - Generate all PDFs

**Processing Pipeline (Core Engine):**

```
┌─────────────────────────────────────────────────────────┐
│                    BatchProcessor                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. pdf_to_images()  - Convert PDF to images (300 DPI)  │
│         ↓                                                │
│  2. mask_zone_pixels() - Cover existing text            │
│         ↓                                                │
│  3. composite_text() - Render new guest name            │
│         ↓                                                │
│  4. images_to_pdf() - Convert back to PDF               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**
- `pdf_personalizer/core/processor.py` - Main batch processing logic
- `pdf_personalizer/core/rasterizer.py` - PDF to image conversion
- `pdf_personalizer/core/pixel_engine.py` - Text rendering and masking
- `pdf_personalizer/core/builder.py` - Image to PDF conversion

---

### Step 6: Send via WhatsApp

**API Endpoint:** `POST /api/send-whatsapp`

The system supports **two modes** for sending WhatsApp messages:

---

## 📱 WhatsApp Integration Methods

### Mode 1: WhatsApp Cloud API (Recommended for Production)

Uses the official **Facebook/Meta WhatsApp Business API**.

**Requirements:**
- `api_token` - WhatsApp Cloud API access token
- `phone_id` - WhatsApp Business phone number ID

**How it works:**

```
┌─────────────────────────────────────────────────────────────┐
│                  WhatsApp Cloud API Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Upload PDF to WhatsApp Media API                        │
│     POST https://graph.facebook.com/v17.0/{phone_id}/media  │
│     → Returns media_id                                       │
│                                                              │
│  2. Send Document Message                                    │
│     POST https://graph.facebook.com/v17.0/{phone_id}/messages│
│     Body: {                                                  │
│       "messaging_product": "whatsapp",                       │
│       "to": "919876543210",                                  │
│       "type": "document",                                    │
│       "document": {                                          │
│         "id": "<media_id>",                                  │
│         "filename": "invitation.pdf",                        │
│         "caption": "Dear રાજેશ, please find your..."        │
│       }                                                      │
│     }                                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Code Location:** `backend/routes.py` lines 484-558

---

### Mode 2: Browser Automation (Fallback)

Uses **pywhatkit** library to automate WhatsApp Web.

**How it works:**

```
┌─────────────────────────────────────────────────────────────┐
│               Browser Automation Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Opens WhatsApp Web in browser                           │
│  2. Navigates to chat with phone number                     │
│  3. Sends text message                                       │
│  4. (PDF attachment requires manual handling)               │
│                                                              │
│  Note: Not recommended for production use                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Code Location:** `backend/whatsapp_sender.py`

---

## 🔄 Special Features

### Revoke Logic

If a guest has **no phone number**, the system:
1. Deletes the generated PDF
2. Marks the entry as "revoked"
3. Reports it in the delivery status

### Custom Message Templates

Users can customize the WhatsApp message:

```
"Dear {name}, please find your wedding invitation attached."
```

The `{name}` placeholder is replaced with the actual guest name.

### Delivery Reports

After sending, the system generates a JSON report:

```json
{
  "total": 100,
  "sent": 95,
  "failed": 3,
  "details": [
    {"filename": "રાજેશ_પટેલ.pdf", "phone": "+919876543210", "status": "sent"},
    {"filename": "guest_2.pdf", "phone": "N/A", "status": "revoked"}
  ]
}
```

**API Endpoint:** `GET /api/whatsapp-report/{session_id}`

---

## 🗃️ Database Schema

The system uses SQLite (`storage/invitewala.db`) with these tables:

| Table | Purpose |
|-------|---------|
| `users` | Admin accounts |
| `customers` | Guest/customer data |
| `whatsapp_logs` | Delivery tracking (sent, failed, revoked, pending) |
| `pdf_reports` | Generated work reports |
| `tasks` | Task management |

---

## 📁 File Structure

```
Project_B/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── routes.py            # All API endpoints
│   ├── whatsapp_sender.py   # Browser automation sender
│   ├── database.py          # SQLite database
│   ├── reports.py           # Report generation
│   └── auth.py              # Authentication
│
├── pdf_personalizer/
│   └── core/
│       ├── processor.py     # Batch PDF processing
│       ├── rasterizer.py    # PDF → Images
│       ├── pixel_engine.py  # Text rendering & masking
│       ├── builder.py       # Images → PDF
│       └── types.py         # Data structures
│
├── frontend/
│   └── src/
│       ├── App.jsx          # Main React app
│       ├── Dashboard.jsx    # Admin dashboard
│       └── DesignStudio.jsx # Zone editor
│
└── storage/
    ├── uploads/             # Uploaded PDFs
    ├── outputs/             # Generated PDFs
    ├── previews/            # Preview images
    └── reports/             # Generated reports
```

---

## 🚀 Running the Application

```bash
# Start the server on port 5234
cd /home/thommas/Desktop/Project_B
uvicorn backend.main:app --host 0.0.0.0 --port 5234
```

Access: **http://localhost:5234**

---

## 📊 API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-pdf` | POST | Upload wedding card template |
| `/api/upload-csv` | POST | Upload guest data CSV |
| `/api/zones` | POST | Save zone definitions |
| `/api/mapping` | POST | Map CSV columns to zones |
| `/api/generate-preview` | POST | Generate single preview |
| `/api/generate-all` | POST | Generate all PDFs |
| `/api/send-whatsapp` | POST | Send via WhatsApp |
| `/api/whatsapp-report/{id}` | GET | Get delivery report |

---

## 🔐 Authentication

The platform uses JWT-based authentication with role-based access:

- **sudo_admin** - Full access
- **admin** - Can personalize and send
- **designer** - Limited access

Default login: `admin@invitewala.com` / `admin123`

---

## 💡 Key Insights

1. **Pixel-Perfect Rendering**: The system converts PDFs to high-resolution images (300 DPI), overlays text, and converts back to PDF for sharp quality.

2. **Auto Sampling**: The mask system automatically samples the background color around zones to create seamless text overlays.

3. **Rate Limiting**: The WhatsApp sender includes a 10-second delay between messages to avoid API blocking.

4. **Unicode Support**: Full support for Gujarati (ગુજરાતી) and other Unicode scripts.

---

*Last updated: December 2024*
