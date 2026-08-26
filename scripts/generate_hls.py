#!/usr/bin/env python3
################################################################################
#
#  Copyright (C) 2026 Rick Memsic
#  This file is part of cinematic.earth - https://cinematic.earth
#
#  SPDX-License-Identifier: AGPL-3.0-or-later
#  See the file LICENSE.txt for more information.
#
################################################################################

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


# -----------------------------------------------------------------------------
# Hardcoded initial configuration
# -----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent

SOURCE = (
    REPO_ROOT
    / "content"
    / "cinematic.earth"
    / "H.264_ES_Collisions_BonnieGrace_LogicPro_3.mp4"
)

DOMAIN = "cinematic.earth"

MEDIA_ID = "collisions"
MEDIA_NAME = "Collisions"

WORLD_ROOT = REPO_ROOT / "world" / DOMAIN
MEDIA_ROOT = WORLD_ROOT / MEDIA_ID

VIDEO_DIR = MEDIA_ROOT / "video"
ATMOS_DIR = MEDIA_ROOT / "audio-atmos"
AAC_DIR = MEDIA_ROOT / "audio-aac"

MASTER_PLAYLIST = MEDIA_ROOT / "master.m3u8"
CATALOG = WORLD_ROOT / "catalog.json"

PUBLIC_MEDIA_URL = f"https://{DOMAIN}/{MEDIA_ID}/master.m3u8"

# Only generate the first 20 seconds while developing.
TEST_DURATION = 20

# HLS target duration. With video stream-copy, actual boundaries will follow
# source keyframes and can therefore be somewhat longer.
SEGMENT_DURATION = 4

AAC_BITRATE = "256k"


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def die(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_program(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        die(f"{name} not found in PATH")
    return path


FFMPEG = require_program("ffmpeg")
FFPROBE = require_program("ffprobe")


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print()
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def probe_source() -> dict:
    command = [
        FFPROBE,
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        str(SOURCE),
    ]

    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )

    return json.loads(result.stdout)


def parse_frame_rate(value: str | None) -> float | None:
    if not value:
        return None

    try:
        numerator, denominator = value.split("/", 1)
        denominator_value = float(denominator)
        if denominator_value == 0:
            return None
        return float(numerator) / denominator_value
    except (ValueError, ZeroDivisionError):
        return None


def stream_description(stream: dict) -> str:
    codec = stream.get("codec_name", "?")
    profile = stream.get("profile")
    channels = stream.get("channels")
    layout = stream.get("channel_layout")

    parts = [codec]

    if profile:
        parts.append(str(profile))

    if channels:
        parts.append(f"{channels}ch")

    if layout:
        parts.append(str(layout))

    return ", ".join(parts)


def is_atmos(stream: dict) -> bool:
    """
    Detect an explicit Atmos/JOC indication from ffprobe metadata.

    E-AC-3 by itself does not necessarily mean Atmos, so don't claim Atmos
    unless ffprobe exposes something identifying Atmos/JOC.
    """
    if stream.get("codec_name") != "eac3":
        return False

    metadata = json.dumps(stream).lower()

    return "atmos" in metadata or "joc" in metadata


def verify_hls_directory(path: Path) -> None:
    if not (path / "index.m3u8").is_file():
        die(f"generated stage has no index.m3u8: {path}")

    if not (path / "init.mp4").is_file():
        die(f"generated stage has no init.mp4: {path}")

    if not any(path.glob("*.m4s")):
        die(f"generated stage has no media fragments: {path}")


def generate_directory_stage(
    name: str,
    target: Path,
    command: list[str],
) -> None:
    """
    Generate a directory atomically.

    Completed directories are never regenerated.

    If the previous invocation was aborted, only the incomplete .tmp directory
    is removed and that stage starts again.
    """
    if target.exists():
        print(f"SKIP {name}: {target} already exists")
        return

    temporary = target.with_name(f".{target.name}.tmp")

    if temporary.exists():
        print(f"Removing incomplete stage: {temporary}")
        shutil.rmtree(temporary)

    temporary.mkdir(parents=True)

    print(f"GENERATE {name}")

    try:
        run(command, cwd=temporary)
        verify_hls_directory(temporary)
        temporary.rename(target)
    except KeyboardInterrupt:
        print()
        print(f"Interrupted. Incomplete stage left at {temporary}")
        print("Run the script again to resume from this stage.")
        raise
    except Exception:
        print()
        print(f"Stage failed. Incomplete output left at {temporary}")
        print("Run the script again to retry this stage.")
        raise


def write_once(path: Path, contents: str) -> None:
    if path.exists():
        print(f"SKIP file: {path} already exists")
        return

    path.parent.mkdir(parents=True, exist_ok=True)

    temporary = path.with_name(f".{path.name}.tmp")

    if temporary.exists():
        temporary.unlink()

    temporary.write_text(contents, encoding="utf-8")
    os.replace(temporary, path)

    print(f"WRITE {path}")


# -----------------------------------------------------------------------------
# HLS
# -----------------------------------------------------------------------------

def hls_common() -> list[str]:
    return [
        "-f",
        "hls",
        "-hls_time",
        str(SEGMENT_DURATION),
        "-hls_playlist_type",
        "vod",
        "-hls_segment_type",
        "fmp4",
        "-hls_fmp4_init_filename",
        "init.mp4",
        "-hls_segment_filename",
        "segment%05d.m4s",
        "index.m3u8",
    ]


def video_command(video: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(SOURCE),
        "-t",
        str(TEST_DURATION),
        "-map",
        f"0:{video['index']}",
        "-an",
        "-c:v",
        "copy",
        "-hls_flags",
        "independent_segments",
        *hls_common(),
    ]


def atmos_command(audio: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(SOURCE),
        "-t",
        str(TEST_DURATION),
        "-map",
        f"0:{audio['index']}",
        "-vn",
        "-c:a",
        "copy",
        *hls_common(),
    ]


def aac_command(audio: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(SOURCE),
        "-t",
        str(TEST_DURATION),
        "-map",
        f"0:{audio['index']}",
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        AAC_BITRATE,
        "-ac",
        "2",
        *hls_common(),
    ]


# -----------------------------------------------------------------------------
# Master playlist
# -----------------------------------------------------------------------------

def make_master_playlist(
    probe: dict,
    video: dict,
    atmos_audio: dict | None,
) -> str:
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:7",
        "",
    ]

    if atmos_audio is not None:
        channels = int(atmos_audio.get("channels", 2))

        if is_atmos(atmos_audio):
            audio_name = "Dolby Atmos"
            channel_description = f"{channels}/JOC"
        else:
            audio_name = "E-AC-3"
            channel_description = str(channels)

        # Prefer the high-quality E-AC-3 / Atmos rendition.
        # The frontend can still select the AAC fallback when necessary.
        lines.append(
            '#EXT-X-MEDIA:TYPE=AUDIO,'
            'GROUP-ID="audio",'
            f'NAME="{audio_name}",'
            'DEFAULT=YES,'
            'AUTOSELECT=YES,'
            f'CHANNELS="{channel_description}",'
            'URI="audio-atmos/index.m3u8"'
        )

        lines.append(
            '#EXT-X-MEDIA:TYPE=AUDIO,'
            'GROUP-ID="audio",'
            'NAME="Stereo",'
            'DEFAULT=NO,'
            'AUTOSELECT=YES,'
            'CHANNELS="2",'
            'URI="audio-aac/index.m3u8"'
        )
    else:
        lines.append(
            '#EXT-X-MEDIA:TYPE=AUDIO,'
            'GROUP-ID="audio",'
            'NAME="Stereo",'
            'DEFAULT=YES,'
            'AUTOSELECT=YES,'
            'CHANNELS="2",'
            'URI="audio-aac/index.m3u8"'
        )

    lines.append("")

    format_info = probe.get("format", {})

    try:
        source_bitrate = int(format_info.get("bit_rate", 0))
    except (TypeError, ValueError):
        source_bitrate = 0

    # EXT-X-STREAM-INF requires BANDWIDTH. Use a conservative estimate when
    # ffprobe doesn't provide one.
    bandwidth = max(int(source_bitrate * 1.15), 10_000_000)

    attributes = [
        f"BANDWIDTH={bandwidth}",
        'AUDIO="audio"',
    ]

    width = video.get("width")
    height = video.get("height")

    if width and height:
        attributes.append(f"RESOLUTION={width}x{height}")

    frame_rate = parse_frame_rate(
        video.get("avg_frame_rate") or video.get("r_frame_rate")
    )

    if frame_rate:
        attributes.append(f"FRAME-RATE={frame_rate:.3f}")

    lines.append("#EXT-X-STREAM-INF:" + ",".join(attributes))
    lines.append("video/index.m3u8")
    lines.append("")

    return "\n".join(lines)


# -----------------------------------------------------------------------------
# Catalog
# -----------------------------------------------------------------------------

def make_catalog() -> str:
    catalog = {
        "version": 1,
        "items": [
            {
                "id": MEDIA_ID,
                "name": MEDIA_NAME,
                "media": PUBLIC_MEDIA_URL,
            }
        ],
    }

    return json.dumps(catalog, indent=2) + "\n"


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> None:
    print(f"Repository: {REPO_ROOT}")
    print(f"Source:     {SOURCE}")
    print(f"Domain:     {DOMAIN}")
    print(f"Output:     {MEDIA_ROOT}")
    print(f"Duration:   first {TEST_DURATION} seconds")
    print()

    if not SOURCE.is_file():
        die(f"source does not exist: {SOURCE}")

    probe = probe_source()

    streams = probe.get("streams", [])

    video_streams = [
        stream for stream in streams
        if stream.get("codec_type") == "video"
    ]

    audio_streams = [
        stream for stream in streams
        if stream.get("codec_type") == "audio"
    ]

    if not video_streams:
        die("source contains no video stream")

    if not audio_streams:
        die("source contains no audio stream")

    video = video_streams[0]

    if video.get("codec_name") != "h264":
        die(
            "initial generator expects H.264 so it can stream-copy video; "
            f"found {video.get('codec_name')}"
        )

    print(
        "Video:",
        f"stream {video['index']},",
        stream_description(video),
        f"{video.get('width', '?')}x{video.get('height', '?')}",
    )

    print("Audio streams:")

    for audio in audio_streams:
        suffix = ""

        if is_atmos(audio):
            suffix = " [Atmos/JOC detected]"

        print(
            f"  stream {audio['index']}: "
            f"{stream_description(audio)}{suffix}"
        )

    # Prefer E-AC-3 for the high-quality/Atmos rendition.
    atmos_audio = next(
        (
            stream
            for stream in audio_streams
            if stream.get("codec_name") == "eac3"
        ),
        None,
    )

    # Generate AAC from the same E-AC-3 stream when possible so the two
    # renditions represent the same program.
    fallback_audio = atmos_audio or audio_streams[0]

    if atmos_audio is not None:
        if is_atmos(atmos_audio):
            print(
                f"\nSelected stream {atmos_audio['index']} "
                "for Dolby Atmos / E-AC-3."
            )
        else:
            print(
                f"\nSelected E-AC-3 stream {atmos_audio['index']}. "
                "ffprobe did not explicitly identify JOC/Atmos."
            )
    else:
        print(
            "\nNo E-AC-3 stream found; no audio-atmos rendition "
            "will be generated."
        )

    print(
        f"Selected stream {fallback_audio['index']} "
        "for AAC stereo fallback."
    )

    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    generate_directory_stage(
        "video",
        VIDEO_DIR,
        video_command(video),
    )

    if atmos_audio is not None:
        generate_directory_stage(
            "E-AC-3 / Atmos audio",
            ATMOS_DIR,
            atmos_command(atmos_audio),
        )

    generate_directory_stage(
        "AAC stereo audio",
        AAC_DIR,
        aac_command(fallback_audio),
    )

    write_once(
        MASTER_PLAYLIST,
        make_master_playlist(probe, video, atmos_audio),
    )

    write_once(
        CATALOG,
        make_catalog(),
    )

    print()
    print("Done.")
    print()
    print(f"Catalog: https://{DOMAIN}/catalog.json")
    print(f"Media:   {PUBLIC_MEDIA_URL}")
    print()
    print("Generated tree:")

    for path in sorted(WORLD_ROOT.rglob("*")):
        relative = path.relative_to(WORLD_ROOT)

        if path.is_dir():
            print(f"  {relative}/")
        else:
            print(f"  {relative}")


if __name__ == "__main__":
    main()
