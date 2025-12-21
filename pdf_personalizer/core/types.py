from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class MaskMode(str, Enum):
    SOLID = "solid"
    AUTO = "auto_sample"
    MAGIC = "magic_erase"  # New: Text Segmentation Mode
    NONE = "none"


class Align(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class VAlign(str, Enum):
    TOP = "top"
    MIDDLE = "middle"
    BOTTOM = "bottom"


class Rect(BaseModel):
    x: float
    y: float
    width: float
    height: float


class MaskConfig(BaseModel):
    enabled: bool = True
    mode: MaskMode = MaskMode.AUTO
    color_hex: Optional[str] = None
    padding: float = 2.0

    @field_validator("color_hex")
    @classmethod
    def validate_hex(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("#"):
            raise ValueError("Color must start with #")
        if v and len(v) not in (4, 7):
            raise ValueError("Color must be #RGB or #RRGGBB")
        return v





class TextConfig(BaseModel):
    font_family: str = "Noto Sans Gujarati"
    font_size: float = 12.0
    color_hex: str = "#000000"
    align: Align = Align.CENTER
    valign: VAlign = VAlign.MIDDLE  # Default to middle alignment


class Zone(BaseModel):
    zone_id: str
    page_number: int = 1
    rect: Rect
    mask: MaskConfig = Field(default_factory=MaskConfig)
    text: TextConfig = Field(default_factory=TextConfig)

    @model_validator(mode="before")
    @classmethod
    def _backward_compat(cls, data: Any) -> Any:
        """Allow older JSON shapes with `style` and `behavior` keys."""
        if not isinstance(data, dict):
            return data

        if "mask" in data or "text" in data:
            return data

        style = data.get("style") or {}
        behavior = data.get("behavior") or {}

        mask_enabled = behavior.get("mask_background")
        mask: dict[str, Any] = {}
        if mask_enabled is not None:
            mask["enabled"] = bool(mask_enabled)

        text: dict[str, Any] = {}
        for key in ("font_family", "font_size", "color_hex", "align"):
            if key in style:
                text[key] = style[key]

        if mask:
            data["mask"] = mask
        if text:
            data["text"] = text

        return data


class Config(BaseModel):
    template_id: str = "default"
    base_pdf_path: str
    zones: list[Zone] = Field(default_factory=list)
    output_name_column: Optional[str] = None
    output_filename_template: str = "{name}.pdf"
