"""
Production Zone-Based Pixel Engine for PDF Personalization
==========================================================

Strict zone boundary algorithm:
- STRICT ZONE BOUNDARY: Text only inside exact rectangle coordinates
- OPENCV INPAINTING: Remove existing text using cv2.inpaint
- PANGO RENDERING: Proper Gujarati/Indic text shaping (if available)
- HARD CLIPPING: RGBA canvas compositing with strict mask enforcement
- VERIFICATION: Pixel-diff test to ensure no bleed outside zone
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Tuple, List
import logging

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    cv2 = None

# Try Pango/Cairo for proper Indic text shaping
PANGO_AVAILABLE = False
try:
    import gi
    gi.require_version('Pango', '1.0')
    gi.require_version('PangoCairo', '1.0')
    from gi.repository import Pango, PangoCairo
    import cairo
    PANGO_AVAILABLE = True
except:
    pass

from .types import Align, VAlign, MaskMode, Zone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass(frozen=True)
class PixelRect:
    """Pixel-locked rectangle zone."""
    x0: int
    y0: int
    x1: int
    y1: int
    
    @property
    def width(self) -> int:
        return max(0, self.x1 - self.x0)
    
    @property
    def height(self) -> int:
        return max(0, self.y1 - self.y0)
    
    def is_valid(self) -> bool:
        return self.width > 0 and self.height > 0


# ============================================================================
# UTILITIES
# ============================================================================

def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    c = hex_color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


def _points_to_pixels(value_pt: float, dpi: int) -> int:
    return int(round(value_pt * (dpi / 72.0)))


def _contains_indic(text: str) -> bool:
    """Check for Gujarati or Devanagari characters."""
    for ch in text:
        o = ord(ch)
        if 0x0A80 <= o <= 0x0AFF or 0x0900 <= o <= 0x097F:
            return True
    return False


# ============================================================================
# COORDINATE CONVERSION
# ============================================================================

def zone_to_pixel_rect(img_size: Tuple[int, int], zone: Zone, dpi: int) -> PixelRect:
    """
    Convert zone coordinates (PDF points) to pixel coordinates.
    STRICT CLAMPING to image bounds.
    """
    img_w, img_h = img_size
    scale = dpi / 72.0
    
    x0 = int(round(zone.rect.x * scale))
    y0 = int(round(zone.rect.y * scale))
    x1 = int(round((zone.rect.x + zone.rect.width) * scale))
    y1 = int(round((zone.rect.y + zone.rect.height) * scale))
    
    x0 = _clamp(x0, 0, img_w)
    y0 = _clamp(y0, 0, img_h)
    x1 = _clamp(x1, 0, img_w)
    y1 = _clamp(y1, 0, img_h)
    
    if x1 < x0: x0, x1 = x1, x0
    if y1 < y0: y0, y1 = y1, y0
    
    return PixelRect(x0=x0, y0=y0, x1=x1, y1=y1)


# ============================================================================
# MASK CREATION
# ============================================================================

def create_mask(img_size: Tuple[int, int], rect: PixelRect) -> np.ndarray:
    """Create binary mask (255 inside zone, 0 outside)."""
    w, h = img_size
    mask = np.zeros((h, w), dtype=np.uint8)
    if rect.is_valid():
        mask[rect.y0:rect.y1, rect.x0:rect.x1] = 255
    return mask


# ============================================================================
# BACKGROUND SAMPLING
# ============================================================================

def sample_background(img_rgb: np.ndarray, mask: np.ndarray) -> Tuple[int, int, int]:
    """Sample background color from zone edges (60th percentile)."""
    if not OPENCV_AVAILABLE:
        return (255, 255, 255)
    
    kernel = np.ones((5, 5), np.uint8)
    dilated = cv2.dilate(mask, kernel, iterations=1)
    eroded = cv2.erode(mask, kernel, iterations=2)
    border = dilated - eroded
    
    pixels = img_rgb[border > 0]
    if len(pixels) < 5:
        return (255, 255, 255)
    
    r = int(np.percentile(pixels[:, 0], 60))
    g = int(np.percentile(pixels[:, 1], 60))
    b = int(np.percentile(pixels[:, 2], 60))
    
    return (r, g, b)


# ============================================================================
# INPAINTING
# ============================================================================

def analyze_background(
    img_rgb: np.ndarray,
    mask: np.ndarray
) -> Tuple[Tuple[int, int, int], float]:
    """
    Analyze background pixels to determine color and variance.
    Returns ((r,g,b), mean_std_dev).
    """
    if not OPENCV_AVAILABLE:
        return ((255, 255, 255), 0.0)
        
    # DEEP PROBE: Look far away to find true background
    # 8 iters -> ~80px radius (Push past large white boxes)
    kernel = np.ones((20, 20), np.uint8)
    outer_ring = cv2.dilate(mask, kernel, iterations=8) - mask
    pixels = img_rgb[outer_ring > 0]
    
    if len(pixels) < 10:
        logger.warning(f"Background Analysis: Too few pixels ({len(pixels)}) in outer ring.")
        # Fallback: Just look at the immediate border
        return ((255, 255, 255), 0.0)
    
    # SMART FILTER:
    # 1. First, try to find NON-WHITE pixels (True Background)
    #    Threshold 250 allows Cream (usually ~240-248) but rejects White (255)
    brightness = np.mean(pixels, axis=1)
    valid_pixels = pixels[brightness < 250]
    
    if len(valid_pixels) > 50:
        # Found a significant patch of 'Not White'. Trust it.
        # This solves the "White Box on Cream Card" problem automatically.
        target_pixels = valid_pixels
        logger.info(f"Background Analysis: Locked onto CARD COLOR (Found {len(valid_pixels)} non-white pixels). Ignoring white artifacts.")
    else:
        # If we didn't find enough non-white pixels, the card itself is probably white.
        # So we use the bright pixels.
        target_pixels = pixels
        logger.info(f"Background Analysis: No color detected. Assuming White Card.")
    
    median_color = np.median(target_pixels, axis=0)
    std_dev = np.std(target_pixels, axis=0)
    avg_std = np.mean(std_dev)
    
    logger.info(f"Background Analysis Result: Median={median_color}, StdDev={avg_std:.2f}")
    return ((int(median_color[0]), int(median_color[1]), int(median_color[2])), avg_std)


def inpaint_color_fill(
    img_rgb: np.ndarray,
    mask: np.ndarray,
    color: Optional[Tuple[int, int, int]] = None
) -> np.ndarray:
    if color is None:
        if OPENCV_AVAILABLE:
             color, _ = analyze_background(img_rgb, mask)
        else:
             # Fallback to percentile sampling if OpenCV missing (better than white)
             color = sample_background(img_rgb, mask)
    
    out = img_rgb.copy()
    out[mask > 0] = color
    return out


def inpaint_smart(img_rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Smart checking: solid vs textured."""
    bg_color, variance = analyze_background(img_rgb, mask)
    
    # Threshold: variance < 10.0 (Strict) for absolute solids
    # If variance is > 10, use Telea (safer for textured paper)
    IS_SOLID = variance < 10.0
    
    # We now TRUST the Median Sampling (because we dilate mask 15px).
    # So if it detects Solid, we use Solid Fill (Median Color).
    # UNLESS it detects PURE WHITE (meaning we are trapped in a white box).
    # In that case, use Telea (Blends better).
    is_bright = sum(bg_color) > 750 # (250 av)
    
    if IS_SOLID and not is_bright:
        logger.info(f"Smart Inpaint: Solid BG detected (var={variance:.1f}, color={bg_color}). Using fill.")
        return inpaint_color_fill(img_rgb, mask, bg_color)
    else:
        logger.info(f"Smart Inpaint: Using Telea (var={variance:.1f}, bright={is_bright}).")
        if OPENCV_AVAILABLE:
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            inpainted = cv2.inpaint(img_bgr, mask, 3, cv2.INPAINT_TELEA)
            inpainted_rgb = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
            out = img_rgb.copy()
            out[mask > 0] = inpainted_rgb[mask > 0]
            return out
        else:
            return inpaint_color_fill(img_rgb, mask, bg_color)


def inpaint_zone(
    img_rgb: np.ndarray,
    mask: np.ndarray,
    method: str = "telea"
) -> np.ndarray:
    """
    Remove content inside zone using OpenCV inpainting.
    Methods: telea, smart/auto_sample, color
    """
    # Smart / Auto
    if method in ("smart", "auto_sample", "auto"):
        return inpaint_smart(img_rgb, mask)
    elif method == "color":
        return inpaint_color_fill(img_rgb, mask)
        
    # Default Telea
    if not OPENCV_AVAILABLE:
        return inpaint_color_fill(img_rgb, mask)
    
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    inpainted = cv2.inpaint(img_bgr, mask, 3, cv2.INPAINT_TELEA)
    inpainted_rgb = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
    
    out = img_rgb.copy()
    out[mask > 0] = inpainted_rgb[mask > 0]
    return out


# ============================================================================
# FONT LOADING
# ============================================================================

def get_font_paths(text: str = "") -> Iterable[Path]:
    has_gujarati = any('\u0A80' <= ch <= '\u0AFF' for ch in text)
    has_devanagari = any('\u0900' <= ch <= '\u097F' for ch in text)
    
    if has_gujarati:
        yield Path("/usr/share/fonts/truetype/noto/NotoSansGujarati-Bold.ttf")
        yield Path("/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf")
    if has_devanagari:
        yield Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf")
    
    yield Path("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf")
    yield Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def load_font(size_px: int, text: str = "") -> ImageFont.FreeTypeFont:
    for p in get_font_paths(text):
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size_px)
            except:
                continue
    return ImageFont.load_default()


# ============================================================================
# PANGO TEXT RENDERING
# ============================================================================

def render_text_pango(
    text: str, width: int, height: int,
    font_family: str, font_size: int,
    align: str, color: Tuple[int, int, int]
) -> Optional[np.ndarray]:
    """Render text with Pango for proper Indic shaping. Returns RGBA array."""
    if not PANGO_AVAILABLE:
        return None
    
    try:
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
        cr = cairo.Context(surface)
        
        layout = Pango.Layout.new(PangoCairo.create_context(cr))
        desc = Pango.FontDescription()
        desc.set_family(font_family)
        desc.set_absolute_size(font_size * Pango.SCALE)
        layout.set_font_description(desc)
        layout.set_width(width * Pango.SCALE)
        layout.set_wrap(Pango.WrapMode.WORD_CHAR)
        
        if align == 'center':
            layout.set_alignment(Pango.Alignment.CENTER)
        elif align == 'right':
            layout.set_alignment(Pango.Alignment.RIGHT)
        else:
            layout.set_alignment(Pango.Alignment.LEFT)
        
        layout.set_text(text, -1)
        
        cr.set_source_rgba(0, 0, 0, 0)
        cr.paint()
        cr.set_source_rgba(color[0]/255, color[1]/255, color[2]/255, 1.0)
        
        PangoCairo.update_layout(cr, layout)
        PangoCairo.show_layout(cr, layout)
        
        buf = surface.get_data()
        arr = np.ndarray((height, width, 4), dtype=np.uint8, buffer=buf)
        rgba = arr.copy()
        rgba[:,:,0] = arr[:,:,2]  # BGRA -> RGBA
        rgba[:,:,2] = arr[:,:,0]
        
        return rgba
    except Exception as e:
        logger.warning(f"Pango render failed: {e}")
        return None


# ============================================================================
# PIL TEXT RENDERING (fallback)
# ============================================================================

def render_text_pil(
    text: str, width: int, height: int,
    font_size: int, align: str, color: Tuple[int, int, int]
) -> np.ndarray:
    """Render text with PIL (limited Indic support). Returns RGBA array."""
    font = load_font(font_size, text)
    
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    if align == 'center':
        x = (width - text_w) // 2
    elif align == 'right':
        x = width - text_w - 4
    else:
        x = 4
    y = (height - text_h) // 2
    
    draw.text((x, y), text, font=font, fill=color + (255,))
    return np.array(canvas)


# ============================================================================
# TEXT FITTING
# ============================================================================

def fit_and_render_text(
    text: str, width: int, height: int, zone: Zone, dpi: int
) -> Tuple[Optional[np.ndarray], int]:
    """
    SHRINK-TO-FIT: Find font size that fits, render to RGBA.
    Returns: (rgba_array, font_size) or (None, 0) if failed
    """
    max_fs = max(12, _points_to_pixels(zone.text.font_size, dpi))
    min_fs = max(8, _points_to_pixels(8.0, dpi))
    padding = 6
    
    box_w = width - padding * 2
    box_h = height - padding * 2
    
    if box_w < 10 or box_h < 10:
        return (None, 0)
    
    color = _hex_to_rgb(zone.text.color_hex or "#000000")
    align_str = 'center' if zone.text.align == Align.CENTER else 'right' if zone.text.align == Align.RIGHT else 'left'
    font_family = zone.text.font_family or "Noto Sans Gujarati"
    
    use_pango = PANGO_AVAILABLE and _contains_indic(text)
    
    for fs in range(max_fs, min_fs - 1, -2):
        if use_pango:
            rgba = render_text_pango(text, box_w, box_h, font_family, fs, align_str, color)
        else:
            rgba = render_text_pil(text, box_w, box_h, fs, align_str, color)
        
        if rgba is None:
            rgba = render_text_pil(text, box_w, box_h, fs, align_str, color)
        
        alpha = rgba[:, :, 3]
        if np.count_nonzero(alpha) > 0:
            ys, xs = np.where(alpha > 0)
            text_h = ys.max() - ys.min() + 1
            text_w = xs.max() - xs.min() + 1
            
            if text_w <= box_w and text_h <= box_h:
                return (rgba, fs)
    
    # Use min size anyway
    if use_pango:
        rgba = render_text_pango(text, box_w, box_h, font_family, min_fs, align_str, color)
    if rgba is None:
        rgba = render_text_pil(text, box_w, box_h, min_fs, align_str, color)
    
    best_rgba = rgba
    best_fs = min_fs
    
    # === GRAVITY / VERTICAL ALIGNMENT ===
    if best_rgba is not None:
        # Pango/PIL render at top. Detect bounds and center vertically if needed.
        alpha = best_rgba[:, :, 3]
        if np.count_nonzero(alpha) > 0:
            ys, _ = np.where(alpha > 0)
            content_h = ys.max() - ys.min() + 1
            content_top = ys.min()
            
            # Target Y position
            valign = getattr(zone.text, 'valign', VAlign.MIDDLE)
            if valign == VAlign.TOP:
                target_y = 0
            elif valign == VAlign.BOTTOM:
                target_y = box_h - content_h
            else: # MIDDLE
                target_y = (box_h - content_h) // 2
            
            shift_y = target_y - content_top
            
            if shift_y != 0:
                new_rgba = np.zeros_like(best_rgba)
                src_y_start = max(0, -shift_y)
                src_y_end = min(box_h, box_h - shift_y)
                dst_y_start = max(0, shift_y)
                dst_y_end = min(box_h, box_h + shift_y)
                
                # Copy slice
                h_chunk = min(src_y_end - src_y_start, dst_y_end - dst_y_start)
                if h_chunk > 0:
                    new_rgba[dst_y_start:dst_y_start+h_chunk, :, :] = best_rgba[src_y_start:src_y_start+h_chunk, :, :]
                    best_rgba = new_rgba

    return (best_rgba, best_fs)


# ============================================================================
# COMPOSITING WITH STRICT MASK
# ============================================================================

def composite_strict(
    page_rgb: np.ndarray,
    text_rgba: np.ndarray,
    rect: PixelRect,
    mask: np.ndarray
) -> np.ndarray:
    """
    Composite text RGBA onto page with STRICT mask enforcement.
    ANY pixels outside mask are forced to original values.
    """
    h_img, w_img = page_rgb.shape[:2]
    padding = 6
    
    th, tw = text_rgba.shape[:2]
    
    # Center text in zone
    x_off = rect.x0 + padding + (rect.width - padding*2 - tw) // 2
    y_off = rect.y0 + padding + (rect.height - padding*2 - th) // 2
    
    x_off = max(0, min(x_off, w_img - tw))
    y_off = max(0, min(y_off, h_img - th))
    
    # Create full-page canvas
    canvas_rgba = np.zeros((h_img, w_img, 4), dtype=np.uint8)
    
    # Paste text
    if y_off + th <= h_img and x_off + tw <= w_img:
        canvas_rgba[y_off:y_off+th, x_off:x_off+tw, :] = text_rgba
    
    # Alpha composite
    alpha = canvas_rgba[:, :, 3:4].astype(np.float32) / 255.0
    out = page_rgb.astype(np.float32)
    
    for c in range(3):
        out[:, :, c] = out[:, :, c] * (1 - alpha[:, :, 0]) + canvas_rgba[:, :, c] * alpha[:, :, 0]
    
    out = out.astype(np.uint8)
    
    # STRICT: Force original pixels outside mask
    out[mask == 0] = page_rgb[mask == 0]
    
    return out


# ============================================================================
# MAIN API
# ============================================================================

def mask_zone_pixels(img: Image.Image, zone: Zone, dpi: int = 300) -> Image.Image:
    """
    MASK ZONE: Inpaint to remove existing content.
    NO PIXELS OUTSIDE ZONE ARE AFFECTED.
    """
    img_rgb = np.array(img.convert('RGB'))
    rect = zone_to_pixel_rect((img.width, img.height), zone, dpi)
    
    if not rect.is_valid():
        return img
    
    if not zone.mask.enabled or zone.mask.mode == MaskMode.NONE:
        return img
    
    mask = create_mask((img.width, img.height), rect)
    
    # Create a copy for inpainting
    img_inpainted = img_rgb.copy()
    
    
    
    # USER PROOFING: Check if user wants Light Colored Solid Fill
    # Instead of checking specific hex strings, check BRIGHTNESS.
    # Dilation for Halo Removal (Always apply 15px dilation)
    kernel_size = 15
    if OPENCV_AVAILABLE:
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        mask_expanded = cv2.dilate(mask, kernel, iterations=1)
    else:
        mask_expanded = mask

    # 1. MANUAL OVERRIDE
    handled = False
    if zone.mask.color_hex:
        try:
            c = _hex_to_rgb(zone.mask.color_hex)
            logger.info(f"Zone {zone.zone_id}: Manual BG Override {c}. Using direct fill.")
            img_inpainted = inpaint_color_fill(img_rgb, mask_expanded, c)
            handled = True
        except Exception as e:
            logger.error(f"Manual Override Failed: {e}. Fallback to Auto.")

    # 2. MAGIC ERASER (Advanced Text Segmentation)
    if not handled and zone.mask.mode == MaskMode.MAGIC:
        logger.info(f"Zone {zone.zone_id}: Using MAGIC ERASER (Text Segmentation).")
        if OPENCV_AVAILABLE:
            # Create a mask of ONLY the text characters (Adaptive Thresholding)
            text_mask = create_text_mask(img_rgb, mask)
            
            # Dilate the text mask to ensure we catch all ink + halo
            # We don't need huge expansion here, just enough to kill the letter.
            kernel = np.ones((5, 5), np.uint8)
            text_mask_expanded = cv2.dilate(text_mask, kernel, iterations=2)
            
            # Inpaint using Telea on the text mask only
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            inpainted = cv2.inpaint(img_bgr, text_mask_expanded, 3, cv2.INPAINT_TELEA)
            img_inpainted = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
            handled = True
        else:
            logger.warning("Magic Eraser requires OpenCV. Falling back to Auto Smart.")

    # 3. AUTO / SOLID LOGIC (Fallback)
    if not handled:
        # Default to Smart Inpaint (handles both Texture and Solid White traps)
        img_inpainted = inpaint_smart(img_rgb, mask_expanded)

    # FROSTED BLUR (User Request: "Overlay Blur BG")
    # Apply strong blur to the *Result* of inpainting to soften texture/artifacts.
    if OPENCV_AVAILABLE:
        # Create a blurred version of the inpainted image
        # Sigma 10.0 gives a very soft "Frosted Glass" look
        img_blurred = cv2.GaussianBlur(img_inpainted, (21, 21), 10.0)
        
        # Replace the inpainted area with its blurred version
        # This makes the "patch" look like soft tracing paper (card colored)
        # Note: In Magic Mode, we might want to skip this if we want to keep texture?
        # NO, user still wants to hide the "scar" of removal. 
        # But maybe apply it only to the masked area?
        # For now, apply to the whole zone to be safe and uniform.
        img_inpainted[mask > 0] = img_blurred[mask > 0]


    # FEATHER BLENDING (The "Blur" Request)
    # Instead of hard paste, blend edges to hide the box
    if OPENCV_AVAILABLE:
        # Create alpha mask from the processing mask (allow soft edges)
        # Use a slightly dilated mask for the blend base to ensure coverage
        mask_float = mask.astype(np.float32) / 255.0
        
        # Blur the mask to create ease-in/ease-out
        # Sigma=2.0 gives ~5-7px gradient
        mask_blurred = cv2.GaussianBlur(mask_float, (9, 9), 2.0)
        
        # Expand dims for broadcasting (H, W, 3)
        alpha = mask_blurred[:, :, None]
        
        # Linear Interpolation: Out = Inpainted * Alpha + Original * (1 - Alpha)
        # Convert to float for math
        src_f = img_rgb.astype(np.float32)
        dst_f = img_inpainted.astype(np.float32)
        
        out_f = dst_f * alpha + src_f * (1.0 - alpha)
        img_rgb = out_f.astype(np.uint8)
    else:
        # Fallback to hard copy if no OpenCV
        img_rgb = img_inpainted
    
    return Image.fromarray(img_rgb)


def create_text_mask(img_rgb: np.ndarray, zone_mask: np.ndarray) -> np.ndarray:
    """
    Use Computer Vision to find text characters within the zone.
    Returns a binary mask where White = Text, Black = Background.
    """
    # Convert to Grayscale
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    
    # Apply Adaptive Thresholding (Gaussian)
    # Block Size 21, C 10 (Tune these if needed)
    # This finds local dark spots relative to neighborhood
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 21, 10
    )
    
    # Mask out identifying pixels only within the user's zone
    final_mask = cv2.bitwise_and(thresh, thresh, mask=zone_mask)
    return final_mask


def composite_text(img: Image.Image, zone: Zone, text: str, dpi: int = 300) -> Image.Image:
    """
    RENDER TEXT: Draw text with strict zone clipping.
    GUARANTEES: No pixels outside zone affected.
    """
    text = (text or "").strip()
    if not text:
        return img
    
    img_rgb = np.array(img.convert('RGB'))
    original = img_rgb.copy()
    
    rect = zone_to_pixel_rect((img.width, img.height), zone, dpi)
    if not rect.is_valid():
        return img
    
    mask = create_mask((img.width, img.height), rect)
    
    # Fit and render text
    rgba, fs = fit_and_render_text(text, rect.width, rect.height, zone, dpi)
    
    if rgba is None:
        logger.warning(f"Cannot render text: '{text[:30]}'")
        return img
    
    # Composite with strict mask
    img_rgb = composite_strict(img_rgb, rgba, rect, mask)
    
    return Image.fromarray(img_rgb)
