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

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from googleapiclient.discovery import build
from yt_dlp import YoutubeDL

# ------------------------------------------------------------------------------
# -- Configuration / Secret management -----------------------------------------
# ------------------------------------------------------------------------------


# Load environment variables from parent-folder .env
dotenv_path: Path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

YOUTUBE_API_KEY: str = os.environ["YOUTUBE_API_KEY"]
CHANNEL_ID: str = "UC"  # We'll resolve it below

# Directory where videos will go
BASE_DIR: Path = Path(__file__).parent / "world"


# ------------------------------------------------------------------------------
# Locate ffmpeg on the system -----------------------------------------------
# ------------------------------------------------------------------------------


# Try to find ffmpeg in PATH
FFMPEG_BIN: str | None = shutil.which("ffmpeg")
if FFMPEG_BIN is None:
    raise RuntimeError(
        "`ffmpeg` not found in PATH; please install FFmpeg or adjust your PATH"
    )


# ------------------------------------------------------------------------------
# -- YouTube API helpers -------------------------------------------------------
# ------------------------------------------------------------------------------


def get_channel_id_by_username(username: str) -> str:
    """
    Resolve a channel's ID from its @username
    """
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

    # 1) Try legacy username lookup
    if not username.startswith("UC"):
        try:
            resp = (
                youtube.channels()
                .list(part="id", forUsername=username.lstrip("@"))
                .execute()
            )
            items = resp.get("items", [])
            if items:
                return items[0]["id"]
        except Exception:
            pass

    # 2) Fallback: search for the handle as a channel name
    resp = (
        youtube.search()
        .list(
            part="id",
            q=username.lstrip("@"),
            type="channel",
            maxResults=1,
        )
        .execute()
    )
    items = resp.get("items", [])
    if not items:
        raise ValueError(f"Could not resolve channel ID for handle {username}")

    # Search() returns the channelId in items[].id.channelId
    return items[0]["id"]["channelId"]


def list_all_video_ids(channel_id: str) -> List[str]:
    """
    List **all** video IDs uploaded by a channel, handling pagination.
    """
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    video_ids: List[str] = []
    next_page_token: str = ""
    while True:
        resp: Dict[str, Any] = (
            youtube.search()
            .list(
                part="id",
                channelId=channel_id,
                maxResults=50,
                order="date",
                pageToken=next_page_token or None,
                type="video",
            )
            .execute()
        )
        for item in resp.get("items", []):
            video_ids.append(item["id"]["videoId"])
        next_page_token = resp.get("nextPageToken", "")
        if not next_page_token:
            break
    return video_ids


def get_video_title(video_id: str) -> str:
    """
    Fetch the video's title (to use as folder + filename).
    """
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    resp: Dict[str, Any] = youtube.videos().list(part="snippet", id=video_id).execute()
    snippets: List[Dict[str, Any]] = resp.get("items", [])
    title: str = snippets[0]["snippet"]["title"]
    # sanitize for filesystem
    return re.sub(r"[\/:*?\"<>|]", "_", title)


def get_video_info(video_id: str) -> Dict[str, Any]:
    """
    Returns the `snippet` dict for a given video ID.

    Contains: title, channelTitle, description, publishedAt, tags, thumbnails…
    """
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    resp: Dict[str, Any] = youtube.videos().list(part="snippet", id=video_id).execute()
    items: List[Dict[str, Any]] = resp.get("items", [])
    if not items:
        raise ValueError(f"No video found for ID {video_id}")
    return items[0]["snippet"]  # type: ignore


def parse_chapters(description: str) -> List[Dict[str, Any]]:
    """
    Pull out lines like “0:26 - Eli Olson” into a list of
    { start: int(ms), title: str }.
    """
    pattern = re.compile(r"(\d{1,2}):(\d{2})\s*[-–]\s*(.+)")
    chapters: List[Dict[str, Any]] = []
    for match in pattern.finditer(description):
        mins: int = int(match.group(1))
        secs: int = int(match.group(2))
        title: str = match.group(3).strip()
        start_ms: int = (mins * 60 + secs) * 1000
        chapters.append({"start": start_ms, "title": title})
    return chapters


def embed_metadata(video_id: str, title: str, mkv_path: Path) -> None:
    """
    Overwrite the MKV’s metadata so it only contains:
      • title
      • description
    """
    snippet: Dict[str, Any] = get_video_info(video_id)

    # --- 1) build ffmetadata file with only title+description ---
    meta_path = mkv_path.with_suffix(".ffmetadata")
    with open(meta_path, "w", encoding="utf-8") as mf:
        mf.write("FFMETADATA1\n")
        mf.write(f"title={snippet['title']}\n")

        # write description as a true multiline field
        desc_lines = snippet["description"].splitlines()
        if desc_lines:
            mf.write(f"description={desc_lines[0]}\n")
            for extra in desc_lines[1:]:
                mf.write(f" {extra}\n")
        else:
            mf.write("description=\n")

    # --- 2) remux with ffmpeg (metadata first!) ---
    tagged = mkv_path.with_name(mkv_path.stem + "_tagged.mkv")
    cmd = [
        FFMPEG_BIN,
        "-nostdin",  # never enter interactive mode
        "-y",  # overwrite output
        "-f",
        "ffmetadata",  # first input is ffmetadata
        "-i",
        str(meta_path),
        "-i",
        str(mkv_path),  # second input is the video
        "-map_metadata",
        "0",  # take only title+description
        "-c",
        "copy",  # no re-encode
        str(tagged),
    ]
    subprocess.run(cmd, check=True)

    # replace original file
    mkv_path.unlink()
    tagged.rename(mkv_path)

    # cleanup
    meta_path.unlink()


# ------------------------------------------------------------------------------
# -- Download helper using yt-dlp ----------------------------------------------
# ------------------------------------------------------------------------------


def download_video(video_id: str, title: str) -> None:
    """
    Download the highest-resolution stream (with Dolby metadata if present)
    into scripts/world/{title}/{title}.mp4

    Skip already-downloaded .mp4, allow resuming, and clean up on failure.
    """
    # Where we'll end up
    target_dir = BASE_DIR / title
    final_mp4 = target_dir / f"{title}.mp4"

    # 1) If it's already there, skip it
    if final_mp4.exists():
        print(f"→ Skipping “{title}”: already exists.")
        return

    # 2) Ensure folder exists (any partials inside will be resumed)
    target_dir.mkdir(parents=True, exist_ok=True)

    ydl_opts: Dict[str, Any] = {
        "outtmpl": str(target_dir / f"{title}.%(ext)s"),
        "format": "bv*[height<=2160]+ba/b[height<=2160]",  # Up to 4K (2160p)
        # If Dolby-enhanced streams exist, yt-dlp will pick them via "bestvideo"
        "merge_output_format": "mkv",  # Use Matroska to preserve metadata, native for VP9+Opus
        "ffmpeg_location": FFMPEG_BIN,
        "noplaylist": True,
        "continuedl": True,  # Resume .part files if present
    }

    # 3) Try to download (and merge); on any error, clean up and continue
    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://youtu.be/{video_id}"])
    except KeyboardInterrupt:
        print(f"\n⏸️  Download interrupted for “{title}”. Cleaning up…")
        shutil.rmtree(target_dir, ignore_errors=True)
        sys.exit(1)
    except Exception as e:
        print(f"⚠️  Download failed for “{title}”: {e}")
        print("   Removing incomplete files…")
        shutil.rmtree(target_dir, ignore_errors=True)
        return

    # When the mkv is fully downloaded, embed metadata & thumbnail
    mkv_path: Path = target_dir / f"{title}.mkv"
    embed_metadata(video_id, title, mkv_path)


# ------------------------------------------------------------------------------
# -- Main ----------------------------------------------------------------------
# ------------------------------------------------------------------------------


def main() -> None:
    """
    Orchestrate: resolve channel → list videos → download each.
    """
    global CHANNEL_ID
    CHANNEL_ID = get_channel_id_by_username("@swellpatrol5638")

    BASE_DIR.mkdir(exist_ok=True)  # Ensure base 'world/' exists

    video_ids: List[str] = list_all_video_ids(CHANNEL_ID)
    try:
        for vid in video_ids:
            title: str = get_video_title(vid)
            print(f"Downloading {title} ({vid})...")
            download_video(vid, title)
    except KeyboardInterrupt:
        print("\n🛑  Interrupted by user. Exiting.")
        sys.exit(0)


if __name__ == "__main__":
    main()
