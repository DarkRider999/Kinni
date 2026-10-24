"""
Filesystem monitor for SATAIR Invoice Tracker.

Watches the invoice folder for new PDF files using watchdog, validates
file stability before processing, and runs a periodic reconciliation
scan as a fallback for any missed events.

Processing pipeline per file:
    1. File stability check (configurable polls × delay)
    2. SHA-256 hash → duplicate detection
    3. PDF extraction
    4. Per-line-item dedup-key DB insertion  (Fix 16: DB before Excel)
    5. Excel append (via COM or openpyxl)
    6. Database status update (done / error)
"""

import logging
import os
import sqlite3
import threading
import time
from typing import Any

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers.polling import PollingObserver

import database
import excel_writer
import pdf_extractor

logger = logging.getLogger("satair.file_monitor")


# ── helpers ──────────────────────────────────────────────────────────────────


def _is_pdf(path: str) -> bool:
    return path.lower().endswith(".pdf")


def _wait_for_stable(path: str, polls: int, delay: float) -> bool:
    """Return True when the file size is identical across *polls* checks."""
    last_size = -1
    for attempt in range(polls):
        try:
            size = os.path.getsize(path)
        except OSError as exc:
            logger.warning(
                "Stability check %d/%d failed for %s: %s", attempt + 1, polls, path, exc
            )
            return False
        if size == last_size and attempt > 0:
            logger.debug(
                "File stable at %d bytes after %d polls: %s", size, attempt + 1, path
            )
            return True
        last_size = size
        time.sleep(delay)
    # Final check: still stable at the last size
    try:
        return os.path.getsize(path) == last_size
    except OSError:
        return False


# ── core processing ───────────────────────────────────────────────────────────


def process_file(pdf_path: str, cfg: dict[str, Any]) -> bool:
    """
    Run the full extraction-and-write pipeline for *pdf_path*.

    Returns True on success, False on any failure (after logging).
    Never raises.
    """
    db_path: str = cfg["db_path"]
    stability_polls: int = cfg.get("file_stability_polls", 5)
    stability_delay: float = float(cfg.get("file_stability_seconds", 3))

    file_name = os.path.basename(pdf_path)

    # ── stability ─────────────────────────────────────────────────────────────
    logger.info("Waiting for stable file: %s", pdf_path)
    if not _wait_for_stable(pdf_path, stability_polls, stability_delay):
        logger.warning("File did not stabilise, skipping: %s", pdf_path)
        return False

    # ── SHA-256 dedup ─────────────────────────────────────────────────────────
    try:
        sha256 = database.compute_sha256(pdf_path)
    except (OSError, PermissionError) as exc:
        logger.error("Cannot hash %s: %s", pdf_path, exc)
        return False

    if database.is_file_processed(db_path, sha256):
        logger.info("Already processed (sha256 %s): %s", sha256[:8], pdf_path)
        return True

    # Fix 13: wrap register_file in try/except sqlite3.Error
    try:
        database.register_file(db_path, pdf_path, sha256)
    except sqlite3.Error as exc:
        logger.error("DB register failed for %s: %s", pdf_path, exc)
        return False

    logger.info("Processing: %s  [sha256: %s…]", file_name, sha256[:8])

    # ── PDF extraction ────────────────────────────────────────────────────────
    # Fix 14: wrap extract_invoice_data in try/except Exception
    try:
        data = pdf_extractor.extract_invoice_data(pdf_path)
    except Exception as exc:  # noqa: BLE001
        err = f"PDF extraction raised {type(exc).__name__}: {exc}"
        logger.error("%s: %s", err, pdf_path)
        database.mark_error(db_path, sha256, err)
        return False

    if data is None:
        err = "PDF extraction returned None"
        logger.error("%s: %s", err, pdf_path)
        database.mark_error(db_path, sha256, err)
        return False

    invoice_no: str = data.get("invoice_no", "")
    po_no: str = data.get("po_no", "")
    awb: str = data.get("awb", "")
    line_items: list[dict[str, str]] = data.get("line_items", [])

    if not line_items:
        err = "No line items extracted"
        logger.warning("%s: %s", err, pdf_path)
        database.mark_error(db_path, sha256, err)
        return False

    # ── per-line-item dedup ────────────────────────────────────────────────────
    new_items: list[dict[str, str]] = []
    for idx, item in enumerate(line_items):
        key = database.build_dedup_key(
            invoice_no, po_no, awb, item.get("part_number", ""), idx
        )
        if database.is_line_item_duplicate(db_path, key):
            logger.debug("Duplicate line item %d skipped (key=%s…)", idx, key[:20])
        else:
            item["_dedup_key"] = key
            new_items.append(item)

    if not new_items:
        logger.info("All line items already written for %s; marking done.", file_name)
        database.mark_done(db_path, sha256, 0)
        return True

    # ── Fix 16 CRITICAL: DB insert FIRST, then Excel write ────────────────────
    # Record line items in DB before touching Excel so that if DB fails we
    # don't leave Excel dirty with rows that are not tracked.
    for item in new_items:
        database.insert_line_item(
            db_path=db_path,
            file_sha256=sha256,
            invoice_no=invoice_no,
            po_no=po_no,
            awb=awb,
            part_number=item.get("part_number", ""),
            qty=item.get("qty", ""),
            dedup_key=item["_dedup_key"],
        )

    # ── Excel write ───────────────────────────────────────────────────────────
    retry_attempts: int = cfg.get("network_retry_attempts", 3)
    retry_delay: float = float(cfg.get("network_retry_delay_seconds", 10))

    # Fix 15: catch Exception (not just OSError/PermissionError/ValueError) so
    #         pywintypes.com_error is also handled
    try:
        written = excel_writer.append_line_items(
            excel_path=cfg["excel_tracker"],
            worksheet=cfg["excel_worksheet"],
            table_name=cfg["excel_table_name"],
            file_name=file_name,
            invoice_no=invoice_no,
            po_no=po_no,
            awb=awb,
            line_items=[
                {k: v for k, v in it.items() if k != "_dedup_key"} for it in new_items
            ],
            retry_attempts=retry_attempts,
            retry_delay=retry_delay,
        )
    except Exception as exc:  # noqa: BLE001
        err = f"Excel write failed: {exc}"
        logger.error("%s for %s", err, pdf_path)
        database.mark_error(db_path, sha256, err)
        return False

    database.mark_done(db_path, sha256, written)
    logger.info(
        "Done: %s — invoice=%s po=%s awb=%s rows=%d",
        file_name,
        invoice_no,
        po_no,
        awb,
        written,
    )
    return True


# ── watchdog handler ──────────────────────────────────────────────────────────


class InvoiceEventHandler(FileSystemEventHandler):
    """Handle file-created and file-moved events in the invoice folder."""

    def __init__(self, cfg: dict[str, Any]) -> None:
        super().__init__()
        self._cfg = cfg

    def _handle(self, path: str) -> None:
        if _is_pdf(path):
            process_file(path, self._cfg)

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._handle(str(event.src_path))

    def on_moved(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._handle(str(event.dest_path))


# ── reconciliation scan ───────────────────────────────────────────────────────


def reconciliation_scan(cfg: dict[str, Any]) -> int:
    """
    Walk the invoice folder and process any PDF not yet in the database.

    Returns the number of new files processed.
    """
    folder: str = cfg["invoice_folder"]
    db_path: str = cfg["db_path"]

    # Fix 17: wrap get_all_processed_paths in try/except sqlite3.Error
    try:
        already_done = database.get_all_processed_paths(db_path)
    except sqlite3.Error as exc:
        logger.error("Reconciliation: cannot read processed paths from DB: %s", exc)
        return 0

    count = 0
    try:
        for entry in os.scandir(folder):
            if (
                entry.is_file()
                and _is_pdf(entry.path)
                and entry.path not in already_done
            ):
                logger.info("Reconciliation: found unprocessed file %s", entry.path)
                if process_file(entry.path, cfg):
                    count += 1
    except (OSError, PermissionError) as exc:
        logger.warning("Reconciliation scan failed: %s", exc)

    if count:
        logger.info("Reconciliation complete: %d new file(s) processed.", count)
    else:
        logger.debug("Reconciliation complete: no new files.")
    return count


# ── monitor ───────────────────────────────────────────────────────────────────


class InvoiceMonitor:
    """
    Manages the watchdog observer and the periodic reconciliation thread.

    Usage::

        monitor = InvoiceMonitor(cfg)
        monitor.start()
        # … run until stopped …
        monitor.stop()
    """

    def __init__(self, cfg: dict[str, Any]) -> None:
        self._cfg = cfg
        self._observer: PollingObserver | None = None
        self._recon_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    # ── public ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        folder: str = self._cfg["invoice_folder"]
        database.init_db(self._cfg["db_path"])

        # Watchdog uses PollingObserver for network-drive compatibility
        handler = InvoiceEventHandler(self._cfg)
        self._observer = PollingObserver()
        self._observer.schedule(handler, folder, recursive=False)
        self._observer.start()
        logger.info("Watching folder: %s", folder)

        # Reconciliation thread
        self._stop_event.clear()
        self._recon_thread = threading.Thread(
            target=self._reconciliation_loop, daemon=True, name="recon"
        )
        self._recon_thread.start()

        # Initial scan on startup
        reconciliation_scan(self._cfg)

    def stop(self) -> None:
        self._stop_event.set()
        if self._observer is not None:
            self._observer.stop()
            self._observer.join(timeout=10)
            self._observer = None
        if self._recon_thread is not None:
            self._recon_thread.join(timeout=15)
            self._recon_thread = None
        logger.info("Monitor stopped.")

    @property
    def is_running(self) -> bool:
        return self._observer is not None and self._observer.is_alive()

    # ── private ─────────────────────────────────────────────────────────────

    def _reconciliation_loop(self) -> None:
        interval: float = float(self._cfg.get("reconciliation_interval_seconds", 300))
        while not self._stop_event.wait(timeout=interval):
            logger.debug("Periodic reconciliation triggered.")
            # Fix 18: catch sqlite3.Error so the recon thread doesn't die silently
            try:
                reconciliation_scan(self._cfg)
            except (OSError, PermissionError, ValueError, sqlite3.Error) as exc:
                logger.warning("Reconciliation loop error: %s", exc)
