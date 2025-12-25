# PDF Personalizer - Complete Documentation

A Python system for generating personalized PDF invitations by replacing placeholder zones with guest-specific text. Built to handle **Gujarati** and other Indic scripts with proper text shaping via Pango/Cairo.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Modules](#core-modules)
4. [Configuration](#configuration)
5. [How It Works](#how-it-works)
6. [Usage](#usage)
7. [Scripts Reference](#scripts-reference)
8. [System Requirements](#system-requirements)

---

## Overview

The PDF Personalizer is a batch processing system that:

1. **Rasterizes** a template PDF into high-resolution images
2. **Masks** designated zones (areas where guest names will be placed)
3. **Renders** personalized text using proper Unicode shaping
4. **Rebuilds** the images back into individual PDFs

This pixel-based approach ensures **perfect text rendering** for complex scripts like Gujarati, where standard PDF text insertion fails.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT LAYER                              │
├──────────────────┬──────────────────┬───────────────────────────┤
│  Template PDF    │   config.json    │      CSV Guest Data       │
│  (Base Design)   │  (Zone Defs)     │  (Names, Values)          │
└────────┬─────────┴────────┬─────────┴────────────┬──────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSING PIPELINE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Rasterizer  │→ │ Pixel Engine │→ │       Builder        │   │
│  │ (PDF→Images) │  │ (Mask+Text)  │  │   (Images→PDF)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                           ↑                                      │
│                    ┌──────┴───────┐                              │
│                    │Pango Renderer│                              │
│                    │(Text Shaping)│                              │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OUTPUT LAYER                               │
│              Personalized PDF per Guest                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### `pdf_personalizer/core/`

#### 1. `types.py` - Data Models

Pydantic models defining the configuration schema:

| Class | Purpose |
|-------|---------|
| `Rect` | Rectangle coordinates (x, y, width, height) |
| `MaskMode` | Enum: `solid`, `auto_sample`, `none` |
| `Align` | Enum: `left`, `center`, `right` |
| `MaskConfig` | Masking settings (enabled, mode, color, padding) |
| `TextConfig` | Text styling (font_family, font_size, color, align) |
| `Zone` | Complete zone definition combining rect, mask, and text config |
| `Config` | Top-level config with template_id, base_pdf_path, and zones list |

**Example Zone Configuration:**
```json
{
  "zone_id": "guest_name",
  "page_number": 1,
  "rect": {"x": 27.6, "y": 401.4, "width": 498.6, "height": 36.0},
  "mask": {"enabled": true, "mode": "auto_sample", "padding": 2.0},
  "text": {
    "font_family": "Noto Sans Gujarati",
    "font_size": 22,
    "color_hex": "#000000",
    "align": "center"
  }
}
```

---

#### 2. `rasterizer.py` - PDF to Images

Converts PDF pages to PIL Images using PyMuPDF (fitz).

```python
def pdf_to_images(pdf_path: str, dpi: int = 300) -> List[Image.Image]
```

**How it works:**
- Opens PDF with fitz
- Calculates zoom matrix: `zoom = dpi / 72.0`
- Renders each page to pixmap (RGB, no alpha)
- Converts pixmap to PIL Image directly (no intermediate PPM encoding)

**Coordinate System:**
- Origin: Top-left of page
- Unit conversion: `pixels = points × (dpi / 72)`

---

#### 3. `pixel_engine.py` - Masking & Text Rendering

The heart of the system, handling zone masking and text compositing.

##### Key Functions:

**`mask_zone_pixels(img, zone, dpi)`**
- Calculates pixel rectangle from zone coordinates
- Determines fill color based on `MaskMode`:
  - `SOLID`: Uses explicit `color_hex`
  - `AUTO`: Samples background using ring median algorithm
  - `NONE`: Skips masking entirely
- Paints filled rectangle over zone area

**`composite_text(img, zone, text, dpi)`**
- Calculates inner rectangle (zone minus padding)
- Converts hex color to RGB
- Uses **Pango renderer** (preferred) or **PIL fallback**
- Implements **shrink-to-fit**: iterates font sizes from max to min until text fits
- Aligns text horizontally and centers vertically

##### Background Sampling Algorithm (`_sample_background_rgb`):

```
1. Create 6-pixel ring around zone boundary
2. Collect all pixel colors from ring
3. Calculate per-channel median (R, G, B separately)
4. Return median color (robust against decorative elements)

Fallback: If <10 pixels in ring, average 4 corner pixels
```

---

#### 4. `pango_renderer.py` - Complex Script Shaping

Handles proper text shaping for Gujarati, Devanagari, and other complex scripts.

```python
def render_text_rgba(
    text: str,
    width_px: int, height_px: int,
    font_family: str, font_size_px: int,
    color_rgb: Tuple[int, int, int],
    align: str = "center"
) -> Optional[PangoRenderResult]
```

**Dependencies:** Requires system packages:
- `pango`, `cairo`, `harfbuzz`
- `python3-gi`, `python3-gi-cairo`
- `gir1.2-pango-1.0`

**Returns:**
- `PangoRenderResult` with RGBA image and ink bounding box
- `None` if Pango is unavailable

**HarfBuzz Integration:** Pango uses HarfBuzz internally for OpenType shaping, handling:
- Vowel marks (matras)
- Conjuncts (half-letters)
- Reordering
- Ligatures

---

#### 5. `builder.py` - Images to PDF

Rebuilds processed images back into a PDF.

```python
def images_to_pdf(images: List[Image.Image], output_path: str, dpi: int = 300)
```

**Two Paths:**

1. **Primary (img2pdf):** Fast, high-fidelity JPEG encoding
2. **Fallback (PyMuPDF):** Creates new pages, embeds images

Both calculate page size from image dimensions and DPI:
```python
width_pt = image.width × (72 / dpi)
height_pt = image.height × (72 / dpi)
```

---

#### 6. `processor.py` - Batch Orchestration

Coordinates the entire pipeline for multiple guests.

```python
class BatchProcessor:
    def __init__(self, config: Config, output_dir: str, dpi: int = 300)
    def process_csv(self, csv_path: str, mapping: Dict[str, str])
    def process_batch(self, guests: List[Dict], mapping: Dict[str, str])
```

**Workflow per guest:**
1. Copy base images (cached from initial rasterization)
2. For each zone:
   - Get text value from CSV via mapping
   - Mask zone pixels
   - Composite text onto zone
3. Derive output filename (from name column or heuristics)
4. Rebuild images to PDF

**Output Naming Logic:**
1. Explicit `output_name_column` from config
2. Mapped zone with ID like "guest_name" or "name"
3. Common headers: "નામ", "name", "full name", etc.
4. Fallback: "guest_{index}"

---

## Configuration

### `config.json` Structure

```json
{
  "template_id": "demo_invite",
  "base_pdf_path": "template.pdf",
  "output_name_column": "નામ",
  "output_filename_template": "{name}.pdf",
  "zones": [
    {
      "zone_id": "guest_name",
      "page_number": 1,
      "rect": {"x": 27.6, "y": 401.4, "width": 498.6, "height": 36.0},
      "mask": {
        "enabled": true,
        "mode": "auto_sample",
        "padding": 2.0
      },
      "text": {
        "font_family": "Noto Sans Gujarati",
        "font_size": 22,
        "color_hex": "#000000",
        "align": "center"
      }
    }
  ]
}
```

### Zone Properties

| Property | Type | Description |
|----------|------|-------------|
| `zone_id` | string | Unique identifier for mapping |
| `page_number` | int | 1-indexed page number |
| `rect.x` | float | Left edge in PDF points |
| `rect.y` | float | Top edge in PDF points |
| `rect.width` | float | Zone width in points |
| `rect.height` | float | Zone height in points |
| `mask.enabled` | bool | Whether to mask zone |
| `mask.mode` | string | `auto_sample`, `solid`, or `none` |
| `mask.color_hex` | string | Color for solid mode (e.g., "#FFFFFF") |
| `mask.padding` | float | Extra pixels around zone |
| `text.font_family` | string | Font name (must be installed) |
| `text.font_size` | float | Base font size in points |
| `text.color_hex` | string | Text color |
| `text.align` | string | `left`, `center`, or `right` |

---

## How It Works

### Complete Processing Flow

```
Step 1: INITIALIZATION
├── Load config.json
├── Open template PDF
└── Rasterize all pages at 300 DPI → Cache as PIL Images

Step 2: PER-GUEST PROCESSING
├── Copy cached base images
├── For each zone in config:
│   ├── Calculate pixel coordinates
│   ├── Sample background color (ring median)
│   ├── Paint mask rectangle
│   ├── Render text with Pango (shrink-to-fit)
│   └── Composite onto image
└── Save modified images as PDF

Step 3: OUTPUT
└── Write {guest_name}.pdf to output directory
```

### Shrink-to-Fit Algorithm

```python
for size_px in range(base_size, min_size, -1):
    render text at size_px
    if ink_width <= zone_width AND ink_height <= zone_height:
        USE this size
        break
else:
    USE minimum size (may overflow)
```

### Background Sampling Visualization

```
     ←──── Ring (6px) ────→
    ┌───────────────────────┐
    │   Sample Area         │ ← Top ring
    ├───┬───────────────┬───┤
    │ L │               │ R │
    │ e │    ZONE       │ i │
    │ f │   (masked)    │ g │
    │ t │               │ h │
    │   │               │ t │
    ├───┴───────────────┴───┤
    │   Sample Area         │ ← Bottom ring
    └───────────────────────┘
```

---

## Usage

### Basic Usage

```bash
# Activate virtual environment
source .venv/bin/activate

# Generate personalized invites
python generate_invites.py \
    "template.pdf" \
    "template_config.json" \
    "guests.csv" \
    --out output_invites \
    --engine pango \
    --name-key "નામ"
```

### Command-Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--out` | `output_markers` | Output directory |
| `--engine` | `pango` | Rendering engine: `pango` or `fitz` |
| `--font-family` | `Noto Sans Gujarati` | Font for text rendering |
| `--fontfile` | None | Custom .ttf path (fitz engine only) |
| `--dpi` | 300 | Rasterization DPI |
| `--name-key` | None | CSV column for output filenames |

### Using the Core API

```python
from pathlib import Path
import json
from pdf_personalizer.core import Config, BatchProcessor

# Load configuration
config = Config.model_validate_json(Path("config.json").read_text())

# Initialize processor
processor = BatchProcessor(config, output_dir="output", dpi=300)

# Process from CSV
mapping = {"નામ": "guest_name"}  # CSV column → zone_id
processor.process_csv("guests.csv", mapping)

# Or process programmatically
guests = [
    {"નામ": "રાજેશભાઈ"},
    {"નામ": "મહેશભાઈ"},
]
processor.process_batch(guests, mapping)
```

---

## Scripts Reference

### `generate_invites.py`

Main CLI for generating personalized invites.

**Features:**
- Marker-based zone extraction
- Pango or fitz rendering engines
- Redaction-based masking (alternative approach)
- Automatic filename sanitization

### `extract_markers.py`

Extracts `{{MARKERS}}` from a template PDF.

```bash
python extract_markers.py template.pdf -o template_config.json
```

**Output:** Creates JSON with zone definitions based on marker positions.

### `debug_zones.py`

Visualizes zones on a PDF page for debugging.

```bash
python debug_zones.py
```

**Output:** Creates `output/debug_page1.png` with red rectangles around zones.

---

## System Requirements

### Python Dependencies

```
pymupdf (fitz)
pydantic
pillow
img2pdf
```

### System Packages (for Pango rendering)

**Ubuntu/Debian:**
```bash
sudo apt install -y \
    python3-gi \
    python3-gi-cairo \
    gir1.2-pango-1.0 \
    libcairo2 \
    libpango-1.0-0
```

### Fonts

Install Noto fonts for Gujarati/Indic support:
```bash
sudo apt install fonts-noto fonts-noto-extra
```

---

## File Structure

```
Project_B/
├── pdf_personalizer/
│   ├── __init__.py
│   └── core/
│       ├── __init__.py      # Exports: Config, Zone, BatchProcessor
│       ├── types.py         # Pydantic data models
│       ├── rasterizer.py    # PDF → PIL Images
│       ├── pixel_engine.py  # Masking & text compositing
│       ├── pango_renderer.py # Text shaping with Pango/Cairo
│       ├── builder.py       # PIL Images → PDF
│       └── processor.py     # Batch processing orchestration
├── generate_invites.py      # Main CLI script
├── extract_markers.py       # Marker extraction utility
├── debug_zones.py           # Zone visualization tool
├── config.json              # Template configuration
├── sample.csv               # Guest data
└── requirements.txt         # Python dependencies
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Pango/Cairo not available" | Missing system packages | Install python3-gi, gir1.2-pango-1.0 |
| "Base PDF not found" | Invalid path in config | Check `base_pdf_path` |
| Garbled Gujarati text | PIL fallback (no shaping) | Install Pango dependencies |
| Text overflow | Zone too small | Increase zone size or reduce font_size |

---

## Performance Notes

- **Rasterization is cached:** Template pages are rendered once per BatchProcessor instance
- **DPI tradeoff:** Higher DPI = better quality but larger files and slower processing
- **img2pdf is preferred:** Faster than PyMuPDF for PDF creation
- **Batch size:** Process in batches of ~100 for large guest lists to manage memory

---

*Documentation generated: December 2024*
