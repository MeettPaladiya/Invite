from __future__ import annotations

import io
from typing import List

from PIL import Image


def images_to_pdf(images: List[Image.Image], output_path: str, dpi: int = 300) -> None:
    """Rebuild a PDF from a list of PIL images.

    Primary path: img2pdf (fast, good fidelity).
    Fallback path: PyMuPDF embedding (works without img2pdf).
    """

    # 1) Preferred: img2pdf
    try:
        import img2pdf

        img_bytes: list[bytes] = []
        for img in images:
            if img.mode != "RGB":
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=92, optimize=True)
            img_bytes.append(buf.getvalue())

        def layout_fun(_img: bytes, imgwidthpx: int, imgheightpx: int, ndpi):
            w_pt = imgwidthpx * (72.0 / dpi)
            h_pt = imgheightpx * (72.0 / dpi)
            return (w_pt, h_pt)

        pdf_bytes = img2pdf.convert(img_bytes, layout_fun=layout_fun)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
        return
    except Exception:
        pass

    # 2) Fallback: PyMuPDF
    import fitz

    doc = fitz.open()
    for img in images:
        if img.mode != "RGB":
            img = img.convert("RGB")

        w_pt = img.width * (72.0 / dpi)
        h_pt = img.height * (72.0 / dpi)
        page = doc.new_page(width=w_pt, height=h_pt)

        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format="JPEG", quality=92, optimize=True)
        page.insert_image(page.rect, stream=img_byte_arr.getvalue())

    doc.save(output_path)
    doc.close()
