from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Optional, Tuple

from PIL import Image


@dataclass(frozen=True)
class PangoRenderResult:
    image: Image.Image  # RGBA
    ink_bbox: Tuple[int, int, int, int]


def _try_import_pango():
    try:
        import gi

        gi.require_version("Pango", "1.0")
        gi.require_version("PangoCairo", "1.0")

        from gi.repository import Pango, PangoCairo
        import cairo

        return Pango, PangoCairo, cairo
    except Exception:
        return None


def is_available() -> bool:
    return _try_import_pango() is not None


def render_text_rgba(
    text: str,
    width_px: int,
    height_px: int,
    *,
    font_family: str,
    font_size_px: int,
    color_rgb: Tuple[int, int, int],
    align: str = "center",
) -> Optional[PangoRenderResult]:
    """Render shaped text using Pango+Cairo.

    Returns None if Pango/Cairo are not available.
    """
    deps = _try_import_pango()
    if deps is None:
        return None

    Pango, PangoCairo, cairo = deps

    txt = unicodedata.normalize("NFC", text or "")

    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, max(1, width_px), max(1, height_px))
    ctx = cairo.Context(surface)

    layout = PangoCairo.create_layout(ctx)
    layout.set_text(txt, -1)

    desc = Pango.FontDescription()
    desc.set_family(font_family)
    desc.set_absolute_size(int(font_size_px * Pango.SCALE))
    layout.set_font_description(desc)

    layout.set_width(int(width_px * Pango.SCALE))
    layout.set_height(int(height_px * Pango.SCALE))

    if align == "right":
        layout.set_alignment(Pango.Alignment.RIGHT)
    elif align == "left":
        layout.set_alignment(Pango.Alignment.LEFT)
    else:
        layout.set_alignment(Pango.Alignment.CENTER)

    r, g, b = color_rgb
    ctx.set_source_rgba(r / 255.0, g / 255.0, b / 255.0, 1.0)
    PangoCairo.update_layout(ctx, layout)
    PangoCairo.show_layout(ctx, layout)

    buf = surface.get_data()
    img = Image.frombuffer(
        "RGBA",
        (surface.get_width(), surface.get_height()),
        bytes(buf),
        "raw",
        "BGRA",
        0,
        1,
    )

    ink_rect, _ = layout.get_pixel_extents()
    ink_bbox = (ink_rect.x, ink_rect.y, ink_rect.x + ink_rect.width, ink_rect.y + ink_rect.height)

    return PangoRenderResult(image=img, ink_bbox=ink_bbox)
