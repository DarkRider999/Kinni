"""
Excel writer for SATAIR Invoice Tracker.

Write strategy (in priority order):
1. pywin32 COM — used when Excel has the workbook open; preserves VBA macros,
   avoids file-lock conflicts, and appends via the live ListObject API.
2. openpyxl — used when Excel is closed; reads the .xlsm, appends rows to the
   named table, and writes back without touching the VBA project.

Both paths append to table "InvoiceData" on worksheet "Data" with columns:
    File Name | Invoice No | PO No | Airway Bill | Part Number | Qty

Neither path modifies existing rows.
"""

import logging
import os
import time
from typing import Any

logger = logging.getLogger("satair.excel_writer")

# Column order expected by the InvoiceData table
_COLUMNS = ["File Name", "Invoice No", "PO No", "Airway Bill", "Part Number", "Qty"]


# ── helpers ──────────────────────────────────────────────────────────────────


def _build_row(
    file_name: str,
    invoice_no: str,
    po_no: str,
    awb: str,
    part_number: str,
    qty: str,
) -> list[str]:
    return [file_name, invoice_no, po_no, awb, part_number, qty]


# Fix 4: renamed from _retry to _retry_excel_write
def _retry_excel_write(func, attempts: int, delay: float) -> Any:
    """Call *func* up to *attempts* times, sleeping *delay* seconds between tries."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return func()
        except (OSError, PermissionError, TimeoutError) as exc:
            last_exc = exc
            logger.warning(
                "Excel write attempt %d/%d failed: %s", attempt, attempts, exc
            )
            if attempt < attempts:
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]


# ── COM path (pywin32) ────────────────────────────────────────────────────────


def _is_workbook_open_com(excel_path: str) -> bool:
    """Return True if the workbook is currently open in a running Excel instance."""
    try:
        import win32com.client  # type: ignore[import-untyped]

        xl = win32com.client.GetActiveObject("Excel.Application")
        for wb in xl.Workbooks:
            if wb.FullName.lower() == excel_path.lower():
                return True
        return False
    except ImportError:
        return False
    except Exception:  # noqa: BLE001
        # Fix 5: GetActiveObject raises pywintypes.com_error (not a subclass of OSError)
        # when Excel is not running; catch all COM failures here
        return False


def _append_via_com(
    excel_path: str,
    worksheet: str,
    table_name: str,
    rows: list[list[str]],
) -> None:
    """Append *rows* to *table_name* using the live Excel COM object."""
    import win32com.client  # type: ignore[import-untyped]

    # Fix 6: wrap all win32com calls in try/except, log and re-raise on failure
    # Fix 7: collect all rows and write them + save in one try block to avoid
    #        duplicate appends on retry if Save() raises
    try:
        xl = win32com.client.GetActiveObject("Excel.Application")
        wb = None
        for candidate in xl.Workbooks:
            if candidate.FullName.lower() == excel_path.lower():
                wb = candidate
                break

        if wb is None:
            raise OSError(f"Workbook not found in running Excel: {excel_path}")

        ws = wb.Sheets(worksheet)
        lo = ws.ListObjects(table_name)

        for row_values in rows:
            new_row = lo.ListRows.Add()
            for col_idx, value in enumerate(row_values, start=1):
                new_row.Range.Cells(1, col_idx).Value = value

        wb.Save()
        logger.debug(
            "COM: appended %d row(s) to %s!%s", len(rows), worksheet, table_name
        )
    except Exception as exc:
        logger.error("COM write failed for %s: %s", excel_path, exc)
        raise


# ── openpyxl path ─────────────────────────────────────────────────────────────


def _append_via_openpyxl(
    excel_path: str,
    worksheet: str,
    table_name: str,
    rows: list[list[str]],
) -> None:
    """Append *rows* to *table_name* using openpyxl (Excel must be closed)."""
    import openpyxl  # type: ignore[import-untyped]
    from openpyxl.worksheet.table import Table  # type: ignore[import-untyped]

    wb = openpyxl.load_workbook(excel_path, keep_vba=True)

    # Fix 8: atomic save — write to .tmp then os.replace(); close wb in finally
    try:
        if worksheet not in wb.sheetnames:
            raise ValueError(
                f"Worksheet '{worksheet}' not found in {excel_path}. "
                f"Available: {wb.sheetnames}"
            )

        ws = wb[worksheet]

        # Locate the named table
        tbl: Table | None = None
        for t in ws.tables.values():
            if t.displayName == table_name or t.name == table_name:
                tbl = t
                break

        if tbl is None:
            raise ValueError(
                f"Table '{table_name}' not found on worksheet '{worksheet}'."
            )

        # Parse current table reference (e.g. "A1:F10")
        ref = tbl.ref  # e.g. "A1:F10"
        from openpyxl.utils import range_boundaries  # type: ignore[import-untyped]

        min_col, min_row, max_col, max_row = range_boundaries(ref)

        # Append each new row directly below the current last table row
        for row_values in rows:
            max_row += 1
            for col_offset, value in enumerate(row_values):
                ws.cell(row=max_row, column=min_col + col_offset, value=value)

        # Expand the table reference to include the new rows
        from openpyxl.utils import get_column_letter  # type: ignore[import-untyped]

        new_ref = f"{get_column_letter(min_col)}{min_row}:{get_column_letter(max_col)}{max_row}"
        tbl.ref = new_ref

        tmp_path = excel_path + ".tmp"
        wb.save(tmp_path)
        os.replace(tmp_path, excel_path)
        logger.debug(
            "openpyxl: appended %d row(s) to %s!%s (new ref: %s)",
            len(rows),
            worksheet,
            table_name,
            new_ref,
        )
    finally:
        wb.close()


# ── public API ────────────────────────────────────────────────────────────────


def append_line_items(
    excel_path: str,
    worksheet: str,
    table_name: str,
    file_name: str,
    invoice_no: str,
    po_no: str,
    awb: str,
    line_items: list[dict[str, str]],
    retry_attempts: int = 3,
    retry_delay: float = 10.0,
) -> int:
    """
    Append one Excel row per entry in *line_items* to the named table.

    Returns the number of rows successfully written.

    Raises OSError / ValueError / PermissionError on unrecoverable failure
    (after exhausting retries).
    """
    if not line_items:
        logger.debug("No line items to write for %s", file_name)
        return 0

    rows = [
        _build_row(
            file_name,
            invoice_no,
            po_no,
            awb,
            item.get("part_number", ""),
            item.get("qty", ""),
        )
        for item in line_items
    ]

    use_com = _is_workbook_open_com(excel_path)

    if use_com:
        logger.info(
            "Excel workbook is open — using COM to append %d row(s) for %s",
            len(rows),
            file_name,
        )
        _retry_excel_write(
            lambda: _append_via_com(excel_path, worksheet, table_name, rows),
            attempts=retry_attempts,
            delay=retry_delay,
        )
    else:
        logger.info(
            "Excel workbook is closed — using openpyxl to append %d row(s) for %s",
            len(rows),
            file_name,
        )
        _retry_excel_write(
            lambda: _append_via_openpyxl(excel_path, worksheet, table_name, rows),
            attempts=retry_attempts,
            delay=retry_delay,
        )

    return len(rows)
