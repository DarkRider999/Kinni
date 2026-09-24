#!/usr/bin/env python3
"""Download model weights listed in the registry into NF_MODELS_DIR (default ./data/models).

    python scripts/fetch_models.py            # required models only (~25 MB)
    python scripts/fetch_models.py --all      # + optional models (ISNet, Real-ESRGAN; ~370 MB)

Only models whose license allows commercial use are listed (spec §15).
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from neonforge.config import get_settings  # noqa: E402
from neonforge.engine.adapters import MODEL_FILES  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="also fetch optional models")
    ap.add_argument("--dir", type=Path, default=None)
    args = ap.parse_args()
    dest = args.dir or get_settings().models_dir
    dest.mkdir(parents=True, exist_ok=True)
    failed = 0
    for model_id, spec in MODEL_FILES.items():
        if spec.get("optional") and not args.all:
            continue
        target = dest / spec["file"]
        if target.is_file() and target.stat().st_size > 0:
            print(f"✓ {model_id:28s} already present")
            continue
        print(f"↓ {model_id:28s} {spec['url']}")
        tmp = target.with_suffix(target.suffix + ".part")
        try:
            with urllib.request.urlopen(spec["url"], timeout=120) as r, open(tmp, "wb") as out:
                while chunk := r.read(1 << 20):
                    out.write(chunk)
            tmp.replace(target)
        except Exception as e:  # noqa: BLE001
            tmp.unlink(missing_ok=True)
            print(f"  ✗ failed: {e}", file=sys.stderr)
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
