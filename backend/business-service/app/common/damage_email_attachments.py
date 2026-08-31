"""Collect saved damage photos belonging to the selected GRN."""

from pathlib import Path, PurePosixPath
import re


MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_TOTAL_BYTES = 15 * 1024 * 1024
MAX_PHOTOS = 10


def collect_damage_attachments(grn, upload_dir, item_codes=None):
    root = Path(upload_dir).resolve()

    attachments = []
    total = 0
    seen = set()

    for line in grn.lines:
        if item_codes is not None and line.item_code not in item_codes:
            continue

        is_damaged = (
            (line.damaged_quantity or 0) > 0
            or (line.rejected_quantity or 0) > 0
            or line.quality_result == "REJECTED"
            or bool(line.damage_lots)
        )

        if not is_damaged:
            continue

        for evidence in line.damage_evidence:
            if evidence.id in seen:
                continue

            seen.add(evidence.id)

            stored = PurePosixPath(evidence.file_path)

            if stored.parent != PurePosixPath("/media/grn_documents"):
                raise ValueError(
                    "A damage photo has an invalid stored path."
                )

            path = (root / stored.name).resolve()

            if path.parent != root:
                raise ValueError(
                    "A damage photo is outside the upload folder."
                )

            try:
                with path.open("rb") as photo:
                    content = photo.read(MAX_PHOTO_BYTES + 1)
            except OSError as exc:
                raise ValueError(
                    "A saved damage photo is missing or unreadable. "
                    "Upload it again."
                ) from exc

            if not content or len(content) > MAX_PHOTO_BYTES:
                raise ValueError(
                    "Each damage photo must be non-empty "
                    "and at most 5 MB."
                )

            # Check the file signature instead of trusting its extension.
            if content.startswith(b"\xff\xd8\xff"):
                mime_type = "image/jpeg"
                suffix = ".jpg"

            elif content.startswith(b"\x89PNG\r\n\x1a\n"):
                mime_type = "image/png"
                suffix = ".png"

            elif (
                content[:4] == b"RIFF"
                and content[8:12] == b"WEBP"
            ):
                mime_type = "image/webp"
                suffix = ".webp"

            else:
                raise ValueError(
                    "Damage email attachments must be "
                    "JPG, PNG or WebP images."
                )

            total += len(content)

            if (
                total > MAX_TOTAL_BYTES
                or len(attachments) >= MAX_PHOTOS
            ):
                raise ValueError(
                    "Email allows at most 10 photos "
                    "and 15 MB of photo data."
                )

            material_code = re.sub(
                r"[^A-Za-z0-9_-]",
                "_",
                line.item_code or "material",
            )[:60]

            filename = (
                f"{material_code}_damage_"
                f"{len(attachments) + 1}{suffix}"
            )

            attachments.append(
                (filename, content, mime_type)
            )

    return attachments