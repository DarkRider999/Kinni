"""SQLite-backed processing database with SHA-256 deduplication."""

import hashlib
import logging
import os
import sqlite3

logger = logging.getLogger("satair.database")

SCHEMA = """
CREATE TABLE IF NOT EXISTS processed_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name       TEXT    NOT NULL,
    file_path       TEXT    NOT NULL,
    sha256          TEXT    NOT NULL UNIQUE,
    status          TEXT    NOT NULL DEFAULT 'pending',
    line_item_count INTEGER DEFAULT 0,
    processed_at    TEXT,
    error_message   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sha256 ON processed_files(sha256);
CREATE INDEX IF NOT EXISTS idx_file_path ON processed_files(file_path);

CREATE TABLE IF NOT EXISTS line_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    file_sha256     TEXT    NOT NULL,
    invoice_no      TEXT,
    po_no           TEXT,
    awb             TEXT,
    part_number     TEXT,
    qty             TEXT,
    dedup_key       TEXT    NOT NULL UNIQUE,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (file_sha256) REFERENCES processed_files(sha256)
);
CREATE INDEX IF NOT EXISTS idx_dedup_key ON line_items(dedup_key);
"""


def _connect(db_path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: str) -> None:
    with _connect(db_path) as conn:
        conn.executescript(SCHEMA)
    logger.debug("Database initialised at %s", db_path)


def compute_sha256(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def is_file_processed(db_path: str, sha256: str) -> bool:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT status FROM processed_files WHERE sha256 = ?", (sha256,)
        ).fetchone()
    return row is not None and row["status"] == "done"


def register_file(db_path: str, file_path: str, sha256: str) -> None:
    file_name = os.path.basename(file_path)
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO processed_files (file_name, file_path, sha256, status)
            VALUES (?, ?, ?, 'pending')
            """,
            (file_name, file_path, sha256),
        )


def mark_done(db_path: str, sha256: str, line_item_count: int) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            """
            UPDATE processed_files
            SET status='done', line_item_count=?, processed_at=datetime('now')
            WHERE sha256=?
            """,
            (line_item_count, sha256),
        )


def mark_error(db_path: str, sha256: str, error: str) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            """
            UPDATE processed_files
            SET status='error', error_message=?, processed_at=datetime('now')
            WHERE sha256=?
            """,
            (error[:500], sha256),
        )


def build_dedup_key(
    invoice_no: str, po_no: str, awb: str, part_number: str, occurrence: int
) -> str:
    parts = [
        invoice_no or "",
        po_no or "",
        awb or "",
        part_number or "",
        str(occurrence),
    ]
    return "|".join(parts)


def is_line_item_duplicate(db_path: str, dedup_key: str) -> bool:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT id FROM line_items WHERE dedup_key=?", (dedup_key,)
        ).fetchone()
    return row is not None


def insert_line_item(
    db_path: str,
    file_sha256: str,
    invoice_no: str,
    po_no: str,
    awb: str,
    part_number: str,
    qty: str,
    dedup_key: str,
) -> bool:
    try:
        with _connect(db_path) as conn:
            conn.execute(
                """
                INSERT INTO line_items (file_sha256, invoice_no, po_no, awb, part_number, qty, dedup_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (file_sha256, invoice_no, po_no, awb, part_number, qty, dedup_key),
            )
        return True
    except sqlite3.IntegrityError:
        return False


def get_all_processed_paths(db_path: str) -> set:
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT file_path FROM processed_files WHERE status='done'"
        ).fetchall()
    return {row["file_path"] for row in rows}
