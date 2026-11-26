"""
PDF extraction for SATAIR invoices.

Field mappings verified against Invoice 94708103 (2026-10-22):
- Invoice No : label "INVOICE" → next token on same or adjacent line
- PO No      : label "Your Purchase" → value on the same or next line
                (NOT "Order No" which is Satair's internal sales order)
- AWB        : under "Shipping Details", second line after carrier name
                e.g. "FedEx International Priority" → next standalone numeric line
                (NOT "Shipment No" which is a different Satair reference)
- Part Number: item table, column "Part No"
- Qty        : item table, column "Qty"

Line-item row pattern: [Item#] [PartNo] [Qty] [UoM] [UnitPrice] …
Header row (to skip):  Item | Part No | Description | Shipping Location | Qty | …
Exclusions: Total line, Batch Number, Commodity Code, ECCN No, Class No,
            US export control paragraph on page 2.
"""

import logging
import re
from typing import Any

import pdfplumber

logger = logging.getLogger("satair.pdf_extractor")

# ── label patterns ──────────────────────────────────────────────────────────
_RE_INVOICE_LABEL = re.compile(r"\bINVOICE\b", re.IGNORECASE)
_RE_PO_LABEL = re.compile(r"Your\s+Purchase", re.IGNORECASE)
_RE_SHIPPING_DETAILS = re.compile(r"Shipping\s+Details", re.IGNORECASE)
_RE_CARRIER = re.compile(
    r"(FedEx|DHL|UPS|TNT|Aramex|Lufthansa|Qatar Airways|Emirates|Etihad)",
    re.IGNORECASE,
)
_RE_SHIPMENT_NO = re.compile(r"Shipment\s+No", re.IGNORECASE)

# numeric-only AWB: 10–20 digits (FedEx tracking numbers are 12 digits)
_RE_AWB_VALUE = re.compile(r"^\d{10,20}$")

# item table header tokens — row containing these should be skipped
_HEADER_TOKENS = {
    "Item",
    "Part No",
    "Description",
    "Shipping Location",
    "UoM",
    "Unit price",
}

# lines to skip entirely
_SKIP_PREFIXES = (
    "Total",
    "Batch Number",
    "Commodity Code",
    "ECCN",
    "Class No",
    "This document",
    "EAR99",
    "No License",
    "controlled",
    "U.S.",
    "Shipper",
    "Bill to",
    "Invoice Date",
)

# part-number: alphanumeric + hyphens, at least 4 chars, contains a letter
_RE_PART_NO = re.compile(r"^[A-Z0-9][A-Z0-9\-]{3,}$", re.IGNORECASE)
_RE_QTY = re.compile(r"^\d+(\.\d+)?$")


# Fix 2: renamed from _clean to _sanitize_field
def _sanitize_field(s: str) -> str:
    return s.strip() if s else ""


def _is_header_row(tokens: list[str]) -> bool:
    return bool(_HEADER_TOKENS.intersection(set(tokens)))


def _is_skip_line(line: str) -> bool:
    stripped = line.strip()
    for prefix in _SKIP_PREFIXES:
        if stripped.lower().startswith(prefix.lower()):
            return True
    return False


def extract_invoice_data(pdf_path: str) -> dict[str, Any] | None:
    """
    Extract invoice fields and all line items from a SATAIR invoice PDF.

    Returns:
        {
            "invoice_no": str,
            "po_no": str,
            "awb": str,
            "line_items": [{"part_number": str, "qty": str}, ...]
        }
        or None on failure.
    """
    # Fix 3: catch all exceptions from PDF library, log type
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_text: list[list[str]] = []
            for page in pdf.pages:
                raw = page.extract_text() or ""
                pages_text.append(raw.splitlines())
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to open PDF %s: %s: %s", pdf_path, type(e).__name__, e)
        return None

    all_lines: list[str] = []
    for page_lines in pages_text:
        all_lines.extend(page_lines)

    invoice_no = _extract_invoice_no(all_lines)
    po_no = _extract_po_no(all_lines)
    awb = _extract_awb(all_lines)
    line_items = _extract_line_items(all_lines)

    if not invoice_no:
        logger.warning("Invoice number not found in %s", pdf_path)
    if not po_no:
        logger.warning("PO number not found in %s", pdf_path)
    if not awb:
        logger.warning("AWB not found in %s", pdf_path)
    if not line_items:
        logger.warning("No line items found in %s", pdf_path)

    return {
        "invoice_no": invoice_no or "",
        "po_no": po_no or "",
        "awb": awb or "",
        "line_items": line_items,
    }


def _extract_invoice_no(lines: list[str]) -> str | None:
    """
    Find the INVOICE label then return the numeric value that follows.
    The value may be on the same line after the label, or on the next line.
    """
    for i, line in enumerate(lines):
        if _RE_INVOICE_LABEL.search(line):
            # Try same line: "INVOICE  94708103"
            after = _RE_INVOICE_LABEL.sub("", line).strip()
            tokens = after.split()
            for tok in tokens:
                if tok.isdigit():
                    return tok
            # Try next line
            if i + 1 < len(lines):
                next_tok = lines[i + 1].strip()
                if next_tok.isdigit():
                    return next_tok
    return None


def _extract_po_no(lines: list[str]) -> str | None:
    """
    Find "Your Purchase" label and return the numeric PO value.
    Layout observed: "Your Purchase" on one line, value on next,
    or on same line separated by whitespace.
    """
    for i, line in enumerate(lines):
        if _RE_PO_LABEL.search(line):
            after = _RE_PO_LABEL.sub("", line).strip()
            tokens = after.split()
            for tok in tokens:
                if tok.isdigit():
                    return tok
            # Check next line
            if i + 1 < len(lines):
                next_tok = lines[i + 1].strip()
                if next_tok.isdigit():
                    return next_tok
    return None


def _extract_awb(lines: list[str]) -> str | None:
    """
    Find "Shipping Details" section, skip the Shipment No line,
    skip carrier name lines, and return the first standalone numeric
    string that matches AWB format (10-20 digits).

    Verified: FedEx 384296758475 appears after "FedEx International Priority"
    and before/after "Shipment No 2811856".
    """
    in_shipping = False
    for i, line in enumerate(lines):
        stripped = line.strip()

        if _RE_SHIPPING_DETAILS.search(stripped):
            in_shipping = True
            continue

        if not in_shipping:
            continue

        # Stop at the next major section header (all-caps label or "Bill to" etc.)
        if re.match(r"^(Bill\s+to|Item|INVOICE|Payment)", stripped, re.IGNORECASE):
            break

        # Skip Shipment No lines — that's the Satair internal reference
        if _RE_SHIPMENT_NO.search(stripped):
            continue

        # Skip carrier name lines
        if _RE_CARRIER.search(stripped):
            continue

        # A line that is purely digits could be the AWB
        tokens = stripped.split()
        for tok in tokens:
            if _RE_AWB_VALUE.match(tok):
                return tok

    return None


def _extract_line_items(lines: list[str]) -> list[dict[str, str]]:
    """
    Parse item table rows.  Each data row follows the pattern:
        [Item#]  [PartNo]  [Qty]  [UoM]  [UnitPrice]  [Disc%/Surcharge]  [Total]

    We skip:
    - Header rows (contain "Item", "Part No", etc.)
    - Total/summary lines
    - Description continuation lines (no PartNo pattern)
    - Skip lines matching _SKIP_PREFIXES
    """
    items: list[dict[str, str]] = []

    for line in lines:
        if _is_skip_line(line):
            continue

        tokens = [t for t in line.split() if t]
        if not tokens:
            continue

        if _is_header_row(tokens):
            continue

        # Row must start with a numeric item number
        if not tokens[0].isdigit():
            continue

        # Second token should match part-number pattern
        if len(tokens) < 3:
            continue
        part_candidate = tokens[1]
        if not _RE_PART_NO.match(part_candidate):
            continue

        # Third token should be a quantity (integer or decimal)
        qty_candidate = tokens[2]
        if not _RE_QTY.match(qty_candidate):
            continue

        items.append({"part_number": part_candidate, "qty": qty_candidate})
        logger.debug("Line item parsed: part=%s qty=%s", part_candidate, qty_candidate)

    return items
