#!/usr/bin/env python3
################################################################################
#
#  Copyright (C) 2025 Garrett Brown
#  This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
#
#  SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
#  See the file LICENSE.txt for more information.
#
################################################################################

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Directory where videos live
BASE_DIR: Path = Path(__file__).resolve().parent / "world"


def get_mkv_info(mkv_path: Path) -> Tuple[str, float]:
    """
    Probe an MKV file and return a tuple of (title, duration_seconds).
    If no title tag is present, fall back to filename stem.
    """
    cmd: List[str] = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        str(mkv_path),
    ]
    result: subprocess.CompletedProcess[str] = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True,
    )
    info: Dict[str, Any] = json.loads(result.stdout)
    fmt: Dict[str, Any] = info.get("format", {})
    tags: Dict[str, str] = fmt.get("tags", {})  # type: ignore
    title: str = tags.get("title", mkv_path.stem)
    duration_str: str = fmt.get("duration", "0")  # type: ignore
    duration_seconds: float = float(duration_str)
    return title, duration_seconds


def format_duration(seconds: float) -> str:
    """
    Convert a duration in seconds to H:MM:SS or M:SS.
    """
    hours: int = int(seconds // 3600)
    minutes: int = int((seconds % 3600) // 60)
    secs: int = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def list_videos() -> None:
    """
    Enumerate all MKV files under BASE_DIR and print their
    title and formatted duration.
    """
    dirs: List[Path] = [d for d in BASE_DIR.iterdir() if d.is_dir()]
    for d in sorted(dirs):
        mkvs: List[Path] = list(d.glob("*.mkv"))
        for mkv in mkvs:
            try:
                title: str
                duration: float
                title, duration = get_mkv_info(mkv)
                duration_fmt: str = format_duration(duration)
                print(f"{title} — {duration_fmt}")
            except subprocess.CalledProcessError as e:
                print(f"⚠️  Failed to probe {mkv.name}: {e}")


def main() -> None:
    """
    Entry point.
    """
    if not BASE_DIR.exists():
        print(f"Error: world directory not found at {BASE_DIR}", file=sys.stderr)
        return
    list_videos()


if __name__ == "__main__":
    main()
