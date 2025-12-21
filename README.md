# PDF Personalizer

Wedding card personalization system with visual zone selection and WhatsApp integration.

## Quick Start

```bash
# Make startup script executable
chmod +x start.sh

# Start both servers
./start.sh
```

Then open **http://localhost:5173** in your browser.

## Features

- 📄 **Upload PDF** - Drop your wedding card template
- ✏️ **Visual Zone Selection** - Draw rectangles to mark personalization areas
- ✨ **Smart Eraser** - Automatically detects card background (color/texture) to hide old text seamlessly
- 🔡 **Perfect Typography** - Handles Gujarati/Hindi scripts correctly with Pango shaping
- 📐 **Strict Alignment** - "Gravity" logic keeps text centered vertically even as font size changes
- 🎨 **Ink Color & Font Size** - Configure text appearance per zone
- 📊 **CSV Mapping** - Connect CSV columns to zones
- 👀 **Preview** - See result before generating all
- 📤 **Batch Generate** - Create personalized PDFs for all guests, named automatically (e.g. `GuestName.pdf`)
- 📱 **WhatsApp Integration** - Send PDFs directly to guest phone numbers
- 📊 **Delivery Report** - Track sent/failed messages

## Manual Setup

### Backend
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-pdf` | POST | Upload wedding card PDF |
| `/api/upload-csv` | POST | Upload guest data CSV |
| `/api/zones` | POST | Save zone definitions |
| `/api/mapping` | POST | Save CSV-to-zone mapping |
| `/api/generate-preview` | POST | Generate single preview |
| `/api/generate-all` | POST | Batch generate all PDFs |
| `/api/send-whatsapp` | POST | Send PDFs via WhatsApp |
| `/api/whatsapp-report/{id}` | GET | Get delivery report |

## CSV Format

Your CSV should have columns for guest data and optionally phone numbers:

```csv
નામ,ફોન
રાજેશભાઈ,9876543210
મહેશભાઈ,9876543211
```

## Requirements

- Python 3.10+
- Node.js 18+
- Pango/Cairo (for Gujarati text): `sudo apt install python3-gi python3-gi-cairo gir1.2-pango-1.0`
