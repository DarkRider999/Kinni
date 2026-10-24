"""Logging configuration with rotating file handlers."""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def setup_logger(
    log_dir: str, max_bytes: int = 5_242_880, backup_count: int = 5
) -> logging.Logger:
    logger = logging.getLogger("satair")
    logger.setLevel(logging.DEBUG)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Fix 1: wrap file handler setup in try/except, fall back to stderr
    try:
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "satair_automation.log")
        file_handler = RotatingFileHandler(
            log_path, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except OSError as exc:
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.DEBUG)
        stderr_handler.setFormatter(formatter)
        logger.addHandler(stderr_handler)
        logger.warning(
            "Could not create log file in %s (%s); falling back to stderr", log_dir, exc
        )

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)

    return logger
