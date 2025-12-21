from __future__ import annotations

from typing import List

import fitz
from PIL import Image


def pdf_to_images(pdf_path: str, dpi: int = 300) -> List[Image.Image]:
    """Rasterize a PDF into PIL Images.

    Coordinates match PyMuPDF's page coordinate system (origin top-left) once
    converted with the same dpi (px = pt * dpi/72).
    """
    doc = fitz.open(pdf_path)
    images: List[Image.Image] = []

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)

    for page in doc:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        images.append(img)

    doc.close()
    return images


def get_pdf_page_count(pdf_path: str) -> int:
    """Get the number of pages in a PDF."""
    doc = fitz.open(pdf_path)
    count = doc.page_count
    doc.close()
    return count
