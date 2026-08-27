"""Build the combined AMS/WMS technical Markdown and PDF documents."""

from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "business-service" / "TECHNICAL_DOCUMENTATION.md"
FRONTEND = ROOT / "frontend" / "TECHNICAL_DOCUMENTATION.md"
MERGED = ROOT / "AMS_WMS_TECHNICAL_DOCUMENTATION.md"
PDF = ROOT / "AMS_WMS_TECHNICAL_DOCUMENTATION.pdf"

NAVY = colors.HexColor("#12324A")
BLUE = colors.HexColor("#176B87")
PALE_BLUE = colors.HexColor("#EAF4F7")
INK = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#CBD5E1")
CODE_BG = colors.HexColor("#F1F5F9")


def register_fonts() -> tuple[str, str, str]:
    font_dir = Path("C:/Windows/Fonts")
    regular = font_dir / "arial.ttf"
    bold = font_dir / "arialbd.ttf"
    mono = font_dir / "consola.ttf"
    if regular.exists() and bold.exists() and mono.exists():
        pdfmetrics.registerFont(TTFont("DocSans", str(regular)))
        pdfmetrics.registerFont(TTFont("DocSans-Bold", str(bold)))
        pdfmetrics.registerFont(TTFont("DocMono", str(mono)))
        return "DocSans", "DocSans-Bold", "DocMono"
    return "Helvetica", "Helvetica-Bold", "Courier"


SANS, SANS_BOLD, MONO = register_fonts()


class TechnicalDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=20 * mm,
            bottomMargin=18 * mm,
            title="AMS/WMS Platform Technical Documentation",
            author="AMS/WMS Engineering",
            subject="Combined backend business-service and frontend technical documentation",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="body")
        self.addPageTemplates(PageTemplate(id="document", frames=[frame], onPage=self.draw_page))

    def draw_page(self, canvas, doc) -> None:
        canvas.saveState()
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.line(18 * mm, A4[1] - 14 * mm, A4[0] - 18 * mm, A4[1] - 14 * mm)
            canvas.setFont(SANS, 8)
            canvas.setFillColor(MUTED)
            canvas.drawString(18 * mm, A4[1] - 10.5 * mm, "AMS/WMS Platform Technical Documentation")
            canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable: Flowable) -> None:
        if not isinstance(flowable, Paragraph):
            return
        level = getattr(flowable, "toc_level", None)
        if level is None:
            return
        text = flowable.getPlainText()
        key = f"heading-{self.seq.nextf('heading')}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        self.notify("TOCEntry", (level, text, self.page, key))


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontName=SANS_BOLD, fontSize=28,
            leading=34, textColor=NAVY, alignment=TA_CENTER, spaceAfter=10 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle", parent=base["Normal"], fontName=SANS, fontSize=13,
            leading=19, textColor=BLUE, alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName=SANS_BOLD, fontSize=20,
            leading=25, textColor=NAVY, spaceBefore=7 * mm, spaceAfter=3 * mm,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName=SANS_BOLD, fontSize=13.5,
            leading=18, textColor=BLUE, spaceBefore=5 * mm, spaceAfter=2 * mm,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontName=SANS_BOLD, fontSize=11,
            leading=15, textColor=NAVY, spaceBefore=3 * mm, spaceAfter=1.5 * mm,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName=SANS, fontSize=9.2,
            leading=13.2, textColor=INK, alignment=TA_LEFT, spaceAfter=2.2 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["BodyText"], fontName=SANS, fontSize=9.1,
            leading=13, textColor=INK, leftIndent=5 * mm, firstLineIndent=-3 * mm,
            bulletIndent=1.5 * mm, spaceAfter=1.2 * mm,
        ),
        "code": ParagraphStyle(
            "Code", parent=base["Code"], fontName=MONO, fontSize=7.2,
            leading=10, textColor=INK, backColor=CODE_BG, borderColor=LINE,
            borderWidth=0.5, borderPadding=5, spaceBefore=1.5 * mm, spaceAfter=3 * mm,
        ),
        "table": ParagraphStyle(
            "TableCell", parent=base["BodyText"], fontName=SANS, fontSize=7.2,
            leading=9.2, textColor=INK,
        ),
        "table_header": ParagraphStyle(
            "TableHeader", parent=base["BodyText"], fontName=SANS_BOLD, fontSize=7.3,
            leading=9.4, textColor=colors.white,
        ),
        "toc_title": ParagraphStyle(
            "TocTitle", parent=base["Heading1"], fontName=SANS_BOLD, fontSize=20,
            textColor=NAVY, spaceAfter=5 * mm,
        ),
    }


STYLES = styles()


def inline_markup(value: str) -> str:
    value = html.escape(value.strip())
    value = re.sub(r"\[([^]]+)]\(([^)]+)\)", r'<link href="\2" color="#176B87">\1</link>', value)
    value = re.sub(r"`([^`]+)`", rf'<font name="{MONO}" backColor="#F1F5F9">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    return value


def table_flowable(rows: list[list[str]]) -> Table:
    columns = max(len(row) for row in rows)
    normalized = [row + [""] * (columns - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = STYLES["table_header"] if row_index == 0 else STYLES["table"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])
    widths = [174 * mm / columns] * columns
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_BLUE]),
    ]))
    return table


def parse_markdown(markdown: str, heading_offset: int = 0) -> list[Flowable]:
    lines = markdown.splitlines()
    story: list[Flowable] = []
    paragraph: list[str] = []
    code: list[str] = []
    in_code = False
    index = 0

    def flush_paragraph() -> None:
        if paragraph:
            story.append(Paragraph(inline_markup(" ".join(paragraph)), STYLES["body"]))
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        if line.startswith("```"):
            flush_paragraph()
            if in_code:
                story.append(Paragraph(html.escape("\n".join(code)).replace("\n", "<br/>"), STYLES["code"]))
                code.clear()
            in_code = not in_code
            index += 1
            continue
        if in_code:
            code.append(line)
            index += 1
            continue
        if line.startswith("|") and index + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[index + 1]):
            flush_paragraph()
            rows = []
            rows.append([cell.strip() for cell in line.strip("|").split("|")])
            index += 2
            while index < len(lines) and lines[index].startswith("|"):
                rows.append([cell.strip() for cell in lines[index].strip("|").split("|")])
                index += 1
            story.extend([table_flowable(rows), Spacer(1, 3 * mm)])
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            raw_level = len(heading.group(1))
            level = min(3, raw_level + heading_offset)
            item = Paragraph(inline_markup(heading.group(2)), STYLES[f"h{level}"])
            item.toc_level = level - 1
            story.append(item)
        elif re.match(r"^[-*]\s+", line):
            flush_paragraph()
            story.append(Paragraph(inline_markup(re.sub(r"^[-*]\s+", "", line)), STYLES["bullet"], bulletText="•"))
        elif re.match(r"^\d+\.\s+", line):
            flush_paragraph()
            match = re.match(r"^(\d+)\.\s+(.+)$", line)
            story.append(Paragraph(inline_markup(match.group(2)), STYLES["bullet"], bulletText=f"{match.group(1)}."))
        elif not line.strip():
            flush_paragraph()
        else:
            paragraph.append(line.strip())
        index += 1
    flush_paragraph()
    return story


def strip_title(markdown: str) -> str:
    lines = markdown.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).lstrip()


def build_merged_markdown(backend: str, frontend: str) -> str:
    return f"""# AMS/WMS Platform — Combined Technical Documentation

Generated from the implemented backend business-service and frontend source documentation.

## Document map

- Part I — Backend Business Service
- Part II — Frontend Application

---

# Part I — Backend Business Service

{strip_title(backend)}

---

# Part II — Frontend Application

{strip_title(frontend)}
"""


def build() -> None:
    backend = BACKEND.read_text(encoding="utf-8")
    frontend = FRONTEND.read_text(encoding="utf-8")
    merged = build_merged_markdown(backend, frontend)
    MERGED.write_text(merged, encoding="utf-8", newline="\n")

    story: list[Flowable] = [
        Spacer(1, 42 * mm),
        Paragraph("AMS/WMS Platform", STYLES["cover_title"]),
        Paragraph("Combined Technical Documentation", STYLES["cover_subtitle"]),
        Spacer(1, 8 * mm),
        Table([[""]], colWidths=[55 * mm], rowHeights=[1.2 * mm], style=[("BACKGROUND", (0, 0), (-1, -1), BLUE)]),
        Spacer(1, 12 * mm),
        Paragraph("Backend Business Service and Frontend Application", STYLES["cover_subtitle"]),
        Spacer(1, 40 * mm),
        Paragraph(f"Generated {date.today().isoformat()}", STYLES["cover_subtitle"]),
        PageBreak(),
        Paragraph("Contents", STYLES["toc_title"]),
    ]
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOC1", fontName=SANS_BOLD, fontSize=10, leading=14, leftIndent=0, textColor=NAVY),
        ParagraphStyle("TOC2", fontName=SANS, fontSize=8.5, leading=12, leftIndent=5 * mm, textColor=INK),
        ParagraphStyle("TOC3", fontName=SANS, fontSize=8, leading=11, leftIndent=10 * mm, textColor=MUTED),
    ]
    story.extend([toc, PageBreak()])

    backend_title = Paragraph("Part I — Backend Business Service", STYLES["h1"])
    backend_title.toc_level = 0
    story.append(backend_title)
    story.extend(parse_markdown(strip_title(backend)))
    story.append(PageBreak())
    frontend_title = Paragraph("Part II — Frontend Application", STYLES["h1"])
    frontend_title.toc_level = 0
    story.append(frontend_title)
    story.extend(parse_markdown(strip_title(frontend)))

    TechnicalDocTemplate(str(PDF)).multiBuild(story)
    print(f"Wrote {MERGED}")
    print(f"Wrote {PDF}")


if __name__ == "__main__":
    build()
