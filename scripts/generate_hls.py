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
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass
from pathlib import Path


# -----------------------------------------------------------------------------
# Repository configuration
# -----------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DOMAIN = "cinematic.earth"

CONTENT_ROOT = REPO_ROOT / "content" / DOMAIN
WORLD_ROOT = REPO_ROOT / "world" / DOMAIN

# Filesystem identity is intentionally explicit and independent of NFO titles.
# Add a stable, URL-safe ID here whenever a source video is added.
MEDIA_IDS = {
    "H.264_ES_Collisions_BonnieGrace_LogicPro_3.mp4": "collisions",
    "PIANO_ARTLIST_RoieShpigler_WinterLullaby_16TRACKS_5PAN.mp4": (
        "winter-lullaby"
    ),
    "REAL_SLEEP_THUNDER_Rain_12_10Min._DaVinci_Atmos_MASTER_7.1.4_V.2.mp4": (
        "sleep-thunder"
    ),
    "Real_Relaxation_CinematicEarth_Jazz_1_DolbyAtmosVideo.mp4": (
        "relaxation-jazz"
    ),
}

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


@dataclass(frozen=True)
class Media:
    source: Path
    nfo: Path
    media_id: str
    title: str
    root: Path


@dataclass(frozen=True)
class AnalyzedMedia:
    media: Media
    probe: dict
    video: dict
    eac3_audio: dict | None
    fallback_audio: dict


def analyze_media(media: Media, probe: dict) -> AnalyzedMedia:
    streams = probe.get("streams", [])
    video = next(
        (
            stream
            for stream in streams
            if stream.get("codec_type") == "video"
        ),
        None,
    )

    if video is None:
        raise ValueError(f"{media.source}: source contains no video stream")

    if video.get("codec_name") != "h264":
        raise ValueError(
            f"{media.source}: stream-copy generation requires H.264 video; "
            f"found {video.get('codec_name')}"
        )

    audio_streams = [
        stream for stream in streams if stream.get("codec_type") == "audio"
    ]

    if not audio_streams:
        raise ValueError(f"{media.source}: source contains no audio stream")

    eac3_audio = next(
        (
            stream
            for stream in audio_streams
            if stream.get("codec_name") == "eac3"
        ),
        None,
    )

    return AnalyzedMedia(
        media=media,
        probe=probe,
        video=video,
        eac3_audio=eac3_audio,
        fallback_audio=eac3_audio or audio_streams[0],
    )


def discover_media(
    content_root: Path,
    world_root: Path,
    media_ids: dict[str, str],
) -> list[Media]:
    sources = sorted(
        (
            path
            for path in content_root.iterdir()
            if path.is_file()
            and path.suffix.lower() == ".mp4"
            and not path.name.startswith((".", "~"))
            and not path.stem.lower().endswith((".tmp", ".part", ".partial"))
        ),
        key=lambda path: path.name,
    )

    missing_sources = sorted(
        set(media_ids).difference(source.name for source in sources)
    )
    if missing_sources:
        raise ValueError(
            "missing configured source"
            f"{'s' if len(missing_sources) > 1 else ''}: "
            + ", ".join(missing_sources)
        )

    media = []
    source_by_id = {}

    for source in sources:
        nfo = source.with_suffix(".nfo")

        if not nfo.is_file():
            raise ValueError(f"{source}: {nfo}: missing matching NFO")

        try:
            root = ElementTree.parse(nfo).getroot()
        except ElementTree.ParseError as error:
            raise ValueError(
                f"{source}: {nfo}: malformed XML: {error}"
            ) from error

        if root.tag != "movie":
            raise ValueError(
                f"{source}: {nfo}: root element must be <movie>"
            )

        title_element = root.find("title")

        if title_element is None:
            raise ValueError(f"{source}: {nfo}: missing movie/title")

        title = (title_element.text or "").strip()

        if not title:
            raise ValueError(f"{source}: {nfo}: empty movie/title")

        media_id = media_ids.get(source.name)

        if media_id is None:
            raise ValueError(f"{source}: no media ID configured")

        if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", media_id) is None:
            raise ValueError(f"{source}: unsafe media ID: {media_id}")

        previous_source = source_by_id.get(media_id)

        if previous_source is not None:
            raise ValueError(
                f"{previous_source} and {source}: duplicate media ID: {media_id}"
            )

        source_by_id[media_id] = source

        media.append(
            Media(
                source=source,
                nfo=nfo,
                media_id=media_id,
                title=title,
                root=world_root / media_id,
            )
        )

    return media


FFMPEG = require_program("ffmpeg")
FFPROBE = require_program("ffprobe")


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print()
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def probe_source(source: Path) -> dict:
    command = [
        FFPROBE,
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        str(source),
    ]

    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or "").strip() or str(error)
        raise ValueError(
            f"{source}: ffprobe failed: {detail}"
        ) from error

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"{source}: ffprobe returned invalid JSON: {error}"
        ) from error


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

    technical_metadata = {
        "codec_long_name": stream.get("codec_long_name"),
        "profile": stream.get("profile"),
        "side_data_list": stream.get("side_data_list", []),
    }
    metadata = json.dumps(technical_metadata).lower()

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
    target.mkdir(parents=True)

    print(f"GENERATE {name}")
    run(command, cwd=target)
    verify_hls_directory(target)


def write_file(path: Path, contents: str) -> None:
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


def video_command(media: Media, video: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(media.source),
        "-map",
        f"0:{video['index']}",
        "-an",
        "-c:v",
        "copy",
        "-hls_flags",
        "independent_segments",
        *hls_common(),
    ]


def atmos_command(media: Media, audio: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(media.source),
        "-map",
        f"0:{audio['index']}",
        "-vn",
        "-c:a",
        "copy",
        *hls_common(),
    ]


def aac_command(media: Media, audio: dict) -> list[str]:
    return [
        FFMPEG,
        "-hide_banner",
        "-y",
        "-i",
        str(media.source),
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

def make_catalog(media: list[Media]) -> str:
    catalog = {
        "version": 1,
        "items": [
            {
                "id": item.media_id,
                "name": item.title,
                "media": f"{item.media_id}/master.m3u8",
            }
            for item in media
        ],
    }

    return json.dumps(catalog, indent=2) + "\n"


# -----------------------------------------------------------------------------
# Per-media generation
# -----------------------------------------------------------------------------

def generate_media(analyzed: AnalyzedMedia) -> None:
    media = analyzed.media
    media.root.mkdir(parents=True, exist_ok=True)

    generate_directory_stage(
        "video",
        media.root / "video",
        video_command(media, analyzed.video),
    )

    if analyzed.eac3_audio is not None:
        generate_directory_stage(
            "high-quality E-AC-3 audio",
            media.root / "audio-atmos",
            atmos_command(media, analyzed.eac3_audio),
        )

    generate_directory_stage(
        "AAC stereo audio",
        media.root / "audio-aac",
        aac_command(media, analyzed.fallback_audio),
    )

    write_file(
        media.root / "master.m3u8",
        make_master_playlist(
            analyzed.probe,
            analyzed.video,
            analyzed.eac3_audio,
        ),
    )


def build_world(
    content_root: Path,
    world_root: Path,
    media_ids: dict[str, str],
    *,
    probe=probe_source,
    generate=generate_media,
) -> list[Media]:
    media = discover_media(content_root, world_root, media_ids)
    analyzed_media = [
        analyze_media(item, probe(item.source))
        for item in media
    ]

    if world_root.exists():
        shutil.rmtree(world_root)
    world_root.mkdir(parents=True)

    for index, analyzed in enumerate(analyzed_media, start=1):
        item = analyzed.media
        video = analyzed.video

        print()
        print(f"Media {index}/{len(analyzed_media)}: {item.title}")
        print(f"  Source: {item.source}")
        print(f"  NFO:    {item.nfo}")
        print(f"  ID:     {item.media_id}")
        print(f"  Output: {item.root}")
        print(
            "  Video:  "
            f"stream {video['index']}, {stream_description(video)}, "
            f"{video.get('width', '?')}x{video.get('height', '?')}"
        )

        if analyzed.eac3_audio is not None:
            eac3 = analyzed.eac3_audio
            atmos_suffix = " [Atmos/JOC detected]" if is_atmos(eac3) else ""
            print(
                "  Audio:  "
                f"stream {eac3['index']}, {stream_description(eac3)}"
                f"{atmos_suffix}"
            )
        else:
            print("  Audio:  no E-AC-3 high-quality rendition")

        print(
            "  AAC:    "
            f"stream {analyzed.fallback_audio['index']}, "
            f"{stream_description(analyzed.fallback_audio)}"
        )

        generate(analyzed)

    write_file(world_root / "catalog.json", make_catalog(media))

    return media


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> None:
    print(f"Repository: {REPO_ROOT}")
    print(f"Domain:     {DOMAIN}")
    print(f"Sources:    {CONTENT_ROOT}")
    print(f"Output:     {WORLD_ROOT}")
    print("Duration:   full source (to EOF)")
    print()

    try:
        media = build_world(CONTENT_ROOT, WORLD_ROOT, MEDIA_IDS)
    except ValueError as error:
        die(str(error))

    print()
    print("Done.")
    print()
    print(f"Catalog: https://{DOMAIN}/catalog.json")

    for item in media:
        print(
            f"Media:   https://{DOMAIN}/{item.media_id}/master.m3u8"
        )

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
