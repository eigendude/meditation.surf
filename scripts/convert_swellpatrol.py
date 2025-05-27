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

import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

# ------------------------------------------------------------------------------
# -- Configuration -------------------------------------------------------------
# ------------------------------------------------------------------------------

# Directory where videos live
BASE_DIR: Path = Path(__file__).resolve().parent / "world"
# Name of the subfolder to put 720p encodes in
OUT_SUBDIR: str = "720p"
# Target height
TARGET_HEIGHT: int = 720
# Software encoder CRF
SW_CRF: int = 24


# ------------------------------------------------------------------------------
# -- Job Discovery -------------------------------------------------------------
# ------------------------------------------------------------------------------


def build_jobs() -> List[Tuple[Path, Path]]:
    """
    Walk BASE_DIR, find all .mkv files, and for each return a tuple of
    (input_path, output_path) where output_path lives under the OUT_SUBDIR.
    """
    jobs: List[Tuple[Path, Path]] = []
    for video_dir in sorted(p for p in BASE_DIR.iterdir() if p.is_dir()):
        # look for the .mkv matching the folder name, else pick the first .mkv
        inp: Path = video_dir / f"{video_dir.name}.mkv"
        if not inp.exists():
            all_mkvs = list(video_dir.glob("*.mkv"))  # type: List[Path]
            if not all_mkvs:
                continue
            inp = all_mkvs[0]
        out_dir: Path = video_dir / OUT_SUBDIR
        out_dir.mkdir(exist_ok=True)
        outp: Path = out_dir / inp.name
        jobs.append((inp, outp))
    return jobs


# ------------------------------------------------------------------------------
# -- ffmpeg Command Builder ----------------------------------------------------
# ------------------------------------------------------------------------------


def ffmpeg_command(inp: Path, outp: Path) -> List[str]:
    """
    Build the ffmpeg command for software x264.
    """
    return [
        "ffmpeg",
        "-hide_banner",
        "-y",  # overwrite output
        "-i",
        str(inp),
        "-vf",
        f"scale=-2:{TARGET_HEIGHT}",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        str(SW_CRF),
        "-c:a",
        "copy",
        str(outp),
    ]


# ------------------------------------------------------------------------------
# -- Main ----------------------------------------------------------------------
# ------------------------------------------------------------------------------


def main() -> None:
    """
    Go through all jobs and convert each video to 720p.
    Skip if the target already exists; clean up partials on failure.
    """
    jobs: List[Tuple[Path, Path]] = build_jobs()
    total: int = len(jobs)
    if total == 0:
        print("No MKV files found to convert.", file=sys.stderr)
        sys.exit(1)

    for idx, (inp, outp) in enumerate(jobs, start=1):
        print(f"[{idx}/{total}] {inp.parent.name}: ", end="", flush=True)
        if outp.exists():
            print("skipped (already exists)")
            continue

        # remove any stale .part file
        part_file: Path = outp.with_suffix(outp.suffix + ".part")
        if part_file.exists():
            part_file.unlink(missing_ok=True)

        cmd: List[str] = ffmpeg_command(inp, outp)
        try:
            subprocess.run(cmd, check=True)
            print("done (sw)")
        except subprocess.CalledProcessError as err:
            print(f"failed: {err}")
            outp.unlink(missing_ok=True)
        except KeyboardInterrupt:
            print("\n🛑  Interrupted by user. Exiting.")
            sys.exit(0)

    print("All done.")


if __name__ == "__main__":
    main()
