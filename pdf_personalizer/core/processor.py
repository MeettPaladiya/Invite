from __future__ import annotations

import csv
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image

from .builder import images_to_pdf
from .pixel_engine import composite_text, mask_zone_pixels
from .rasterizer import pdf_to_images
from .types import Config, Zone


class BatchProcessor:
    def __init__(self, config: Config, output_dir: str, *, dpi: int = 300):
        self.config = config
        self.dpi = dpi

        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)

        base_path = Path(self.config.base_pdf_path)
        if not base_path.exists():
            raise FileNotFoundError(f"Base PDF not found: {self.config.base_pdf_path}")

        self._base_images: List[Image.Image] = pdf_to_images(str(base_path), dpi=self.dpi)

    def process_csv(self, csv_path: str, mapping: Dict[str, str], *, encoding: str = "utf-8") -> List[str]:
        with open(csv_path, "r", encoding=encoding, newline="") as f:
            reader = csv.DictReader(f)
            guests = list(reader)
        return self.process_batch(guests, mapping)

    def process_batch(self, guests: List[Dict[str, str]], mapping: Dict[str, str]) -> List[str]:
        """Process all guests and return list of output file paths."""
        zone_map = {z.zone_id: z for z in self.config.zones}
        output_files: List[str] = []

        for i, guest_data in enumerate(guests):
            try:
                guest_data_norm = {
                    (k or ""): unicodedata.normalize("NFC", (v or "")) for k, v in (guest_data or {}).items()
                }
                output_path = self._process_single(guest_data_norm, mapping, zone_map, i)
                output_files.append(output_path)
            except Exception as e:
                print(f"Error row {i + 1}: {e}")

        print(f"✅ Processed {len(output_files)}/{len(guests)} files.")
        return output_files

    def process_single_guest(self, guest_data: Dict[str, str], mapping: Dict[str, str]) -> str:
        """Process a single guest and return output path."""
        zone_map = {z.zone_id: z for z in self.config.zones}
        guest_data_norm = {
            (k or ""): unicodedata.normalize("NFC", (v or "")) for k, v in (guest_data or {}).items()
        }
        return self._process_single(guest_data_norm, mapping, zone_map, 0)

    def _process_single(
        self,
        guest_data: Dict[str, str],
        mapping: Dict[str, Any],
        zone_map: Dict[str, Zone],
        index: int,
    ) -> str:
        images = [img.copy() for img in self._base_images]

        for csv_col, zone_ids in mapping.items():
            # Support both single zone_id string and list of zone_ids
            if isinstance(zone_ids, str):
                zone_ids = [zone_ids]
            elif not isinstance(zone_ids, list):
                continue
            
            text_val = (guest_data.get(csv_col) or "").strip()
            print(f"🔍 Processing column '{csv_col}' -> zones {zone_ids} -> text: '{text_val[:30]}...' " if len(text_val) > 30 else f"🔍 Processing column '{csv_col}' -> zones {zone_ids} -> text: '{text_val}'")
            
            for zone_id in zone_ids:
                zone = zone_map.get(zone_id)
                if not zone:
                    print(f"   ⚠️  Zone '{zone_id}' not found in zone_map. Available: {list(zone_map.keys())}")
                    continue

                page_idx = zone.page_number - 1
                if page_idx < 0 or page_idx >= len(images):
                    print(f"   ⚠️  Zone page {zone.page_number} out of range (1-{len(images)})")
                    continue

                print(f"   ✅ Applying to page {zone.page_number}, zone rect: x={zone.rect.x:.1f}, y={zone.rect.y:.1f}, w={zone.rect.width:.1f}, h={zone.rect.height:.1f}")
                
                img = images[page_idx]
                img = mask_zone_pixels(img, zone, dpi=self.dpi)
                if text_val:
                    img = composite_text(img, zone, text_val, dpi=self.dpi)
                images[page_idx] = img

        name_part = unicodedata.normalize("NFC", self._derive_output_name(guest_data, mapping, index))
        safe_name = self._sanitize_filename(name_part) or f"guest_{index + 1}"

        filename = (self.config.output_filename_template or "{name}.pdf").format(name=safe_name)
        if not filename.lower().endswith(".pdf"):
            filename += ".pdf"

        output_path = self.output_dir / filename
        images_to_pdf(images, str(output_path), dpi=self.dpi)
        return str(output_path)

    def _sanitize_filename(self, value: str) -> str:
        keep = []
        for ch in (value or ""):
            if ch in {"/", "\\", "\0"}:
                continue
            if ord(ch) < 32:
                continue
            if ch in " _-":
                keep.append(ch)
                continue

            cat = unicodedata.category(ch)
            if cat and cat[0] in {"L", "M", "N"}:
                keep.append(ch)

        return "".join(keep).strip()

    def _derive_output_name(self, guest_data: Dict[str, str], mapping: Dict[str, Any], index: int) -> str:
        col = (self.config.output_name_column or "").strip()
        if col:
            v = (guest_data.get(col) or "").strip()
            if v:
                return v

        for csv_col, zone_ids in mapping.items():
            # Handle both single zone_id and list of zone_ids
            if isinstance(zone_ids, str):
                zone_ids = [zone_ids]
            elif not isinstance(zone_ids, list):
                continue
            
            for zone_id in zone_ids:
                if (zone_id or "").lower() in {"guest_name", "name", "fullname", "full_name"}:
                    v = (guest_data.get(csv_col) or "").strip()
                    if v:
                        return v

        preferred_headers = ["નામ", "name", "full name", "fullname", "guest name", "guest_name"]
        for h in preferred_headers:
            for k, v in guest_data.items():
                if (k or "").strip().lower() == h:
                    vv = (v or "").strip()
                    if vv:
                        return vv

        for k, v in guest_data.items():
            kk = (k or "").strip().lower()
            if ("name" in kk) or ("નામ" in (k or "")):
                vv = (v or "").strip()
                if vv:
                    return vv

        return f"guest_{index + 1}"
