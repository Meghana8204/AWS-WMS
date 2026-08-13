"""Real-time OCR adapter for camera-captured purchase-order documents."""
from __future__ import annotations

import asyncio
import re
import shutil
from datetime import date
from decimal import Decimal, InvalidOperation

from app.modules.gate.domain.value_objects import AnprResult, OcrResult


class OcrUnavailableError(RuntimeError):
    """Raised when the configured OCR engine cannot be used."""


class TesseractOcrService:
    """Runs the local Tesseract binary against the bytes captured by the camera."""

    def __init__(self, command: str = "tesseract") -> None:
        self.command = command

    async def process_po_document(self, document_data: bytes | str) -> OcrResult:
        if isinstance(document_data, str):
            document_data = document_data.encode()
        if not document_data:
            raise ValueError("The captured document image is empty.")
        raw_text = await _read_image_text(self.command, document_data, page_segmentation_mode="6")
        return self._parse_purchase_order(raw_text)

    @staticmethod
    def _parse_purchase_order(raw_text: str) -> OcrResult:
        normalized = re.sub(r"[ \t]+", " ", raw_text)
        po_match = re.search(r"\b(?:P(?:URCHASE)?\s*O(?:RDER)?\s*(?:NO|NUMBER)?\s*[:#-]?\s*)?(PO[-\s/]?[A-Z0-9][A-Z0-9/-]{2,})\b", normalized, re.I)
        supplier_match = re.search(r"(?:supplier|vendor)\s*[:#-]\s*([^\n\r]{2,80})", raw_text, re.I)
        material_match = re.search(r"(?:material|item|product)\s*[:#-]\s*([^\n\r]{2,80})", raw_text, re.I)
        quantity_match = re.search(r"(?:quantity|qty)\s*[:#-]?\s*(\d+(?:\.\d+)?)", normalized, re.I)

        quantity = None
        if quantity_match:
            try:
                quantity = Decimal(quantity_match.group(1))
            except InvalidOperation:
                pass

        words = [word for word in re.findall(r"[A-Za-z0-9]+", raw_text) if len(word) > 1]
        confidence = min(0.99, 0.35 + len(words) / 120) if words else 0.0
        return OcrResult(
            po_number=po_match.group(1).upper().replace(" ", "") if po_match else None,
            supplier_name=supplier_match.group(1).strip() if supplier_match else None,
            product_material=material_match.group(1).strip() if material_match else None,
            quantity=quantity,
            confidence=round(confidence, 2),
            raw_text=raw_text,
        )


class TesseractAnprService:
    """Reads vehicle plates from a live camera image using the OCR engine."""

    def __init__(self, command: str = "tesseract") -> None:
        self.command = command

    async def recognize_license_plate(self, image_data: bytes | str) -> AnprResult:
        if isinstance(image_data, str):
            normalized = re.sub(r"[^A-Z0-9]", "", image_data.upper())
            if normalized:
                return AnprResult(detected_vehicle_number=normalized, confidence=1.0, raw_metadata={"source": "manual_entry"})
            raise ValueError("Vehicle registration number is empty.")
        if not image_data:
            raise ValueError("The captured vehicle image is empty.")

        raw_text = await _read_image_text(self.command, image_data, page_segmentation_mode="11")
        compact_text = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
        # Indian registration formats: MH12AB1234, DL01C1234, BH12AB1234A, etc.
        match = re.search(r"\b(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|[A-Z]{2}\d{2}[A-Z]{2}\d{4}[A-Z]?)\b", compact_text)
        if not match:
            raise ValueError("No vehicle registration number could be read. Reposition the plate and scan again.")

        plate = match.group(0)
        confidence = min(0.99, 0.65 + len(plate) / 40)
        return AnprResult(detected_vehicle_number=plate, confidence=round(confidence, 2), raw_metadata={"raw_text": raw_text})


async def _read_image_text(command: str, image_data: bytes, page_segmentation_mode: str) -> str:
    if not shutil.which(command):
        raise OcrUnavailableError(
            "Tesseract OCR is not installed. Run the Docker business-service or install Tesseract and set OCR_TESSERACT_COMMAND."
        )
    process = await asyncio.create_subprocess_exec(
        command,
        "stdin",
        "stdout",
        "--psm",
        page_segmentation_mode,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate(image_data)
    if process.returncode != 0:
        raise OcrUnavailableError(f"Tesseract could not read the image: {stderr.decode(errors='replace').strip()}")
    return stdout.decode("utf-8", errors="replace")
