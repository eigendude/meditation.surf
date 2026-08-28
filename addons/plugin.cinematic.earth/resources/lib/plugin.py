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
import sys
from pathlib import Path, PureWindowsPath
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse

import xbmc
import xbmcgui
import xbmcplugin


ADDON_ROOT: Path = Path(__file__).resolve().parents[2]
REPO_ROOT: Path = ADDON_ROOT.parent.parent

CATALOG_PATH: Path = REPO_ROOT / "world" / "cinematic.earth" / "catalog.json"
ART_TYPES: tuple[str, ...] = ("thumb", "poster", "fanart")


def resolve_media_uri(media: str, catalog_path: Path = CATALOG_PATH) -> str:
    """Resolve catalog-relative media safely from the catalog's directory."""
    if not isinstance(media, str) or not media:
        raise ValueError("Catalog media must be a non-empty string")

    if urlparse(media).scheme:
        return media

    root = catalog_path.parent.resolve()
    candidate = (root / media).resolve()

    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(
            f"Catalog media escapes catalog root: {media}"
        ) from error

    return candidate.as_uri()


def resolve_artwork_uri(
    artwork: str,
    catalog_path: Path = CATALOG_PATH,
) -> str:
    """Resolve artwork only when it is local to the catalog directory."""
    if not isinstance(artwork, str) or not artwork:
        raise ValueError("Catalog artwork must be a non-empty string")

    if (
        urlparse(artwork).scheme
        or Path(artwork).is_absolute()
        or PureWindowsPath(artwork).is_absolute()
    ):
        raise ValueError("Catalog artwork must be a relative path")

    return resolve_media_uri(artwork, catalog_path)


def resolve_artwork(
    item: dict[str, Any],
    catalog_path: Path = CATALOG_PATH,
) -> dict[str, str]:
    artwork = item.get("art")
    if artwork is None:
        return {}
    if not isinstance(artwork, dict):
        xbmc.log(
            f"plugin.cinematic.earth: Invalid artwork for "
            f"'{item.get('id', '')}': art must be an object",
            xbmc.LOGERROR,
        )
        return {}

    resolved: dict[str, str] = {}
    for art_type in ART_TYPES:
        if art_type not in artwork:
            continue
        try:
            resolved[art_type] = resolve_artwork_uri(
                artwork[art_type],
                catalog_path,
            )
        except (OSError, RuntimeError, ValueError) as error:
            xbmc.log(
                f"plugin.cinematic.earth: Invalid {art_type} artwork for "
                f"'{item.get('id', '')}': {error}",
                xbmc.LOGERROR,
            )

    return resolved


def load_catalog() -> dict[str, Any]:
    """Load the locally generated cinematic.earth catalog."""
    with CATALOG_PATH.open("r", encoding="utf-8") as file:
        catalog = json.load(file)

    if catalog.get("version") != 1:
        raise ValueError(f"Unsupported catalog version: {catalog.get('version')}")

    items = catalog.get("items")
    if not isinstance(items, list):
        raise ValueError("Catalog 'items' must be an array")

    return catalog


def get_catalog() -> dict[str, Any] | None:
    try:
        return load_catalog()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        xbmc.log(
            f"plugin.cinematic.earth: Failed to load {CATALOG_PATH}: {error}",
            xbmc.LOGERROR,
        )
        return None


def show_directory(plugin_url: str, plugin_handle: int) -> None:
    """Populate the cinematic.earth directory."""
    catalog = get_catalog()
    if catalog is None:
        xbmcplugin.endOfDirectory(plugin_handle, succeeded=False)
        return

    xbmcplugin.setContent(plugin_handle, "videos")

    for item in catalog["items"]:
        try:
            item_id = item["id"]
            name = item["name"]
        except (KeyError, TypeError) as error:
            xbmc.log(
                f"plugin.cinematic.earth: Invalid catalog item: {error}",
                xbmc.LOGERROR,
            )
            continue

        list_item = xbmcgui.ListItem(label=name)
        artwork = resolve_artwork(item, CATALOG_PATH)
        if artwork:
            list_item.setArt(artwork)
        list_item.setProperty("IsPlayable", "true")

        play_url = f"{plugin_url}?{urlencode({
            'action': 'play',
            'id': item_id,
        })}"

        xbmcplugin.addDirectoryItem(
            plugin_handle,
            play_url,
            list_item,
            isFolder=False,
        )

    xbmcplugin.endOfDirectory(plugin_handle)


def play(plugin_handle: int, item_id: str) -> None:
    """Resolve a catalog item for playback through InputStream Adaptive."""
    catalog = get_catalog()
    if catalog is None:
        xbmcplugin.setResolvedUrl(
            plugin_handle,
            False,
            xbmcgui.ListItem(),
        )
        return

    item = next(
        (item for item in catalog["items"] if item.get("id") == item_id),
        None,
    )

    if item is None:
        xbmc.log(
            f"plugin.cinematic.earth: Unknown media id '{item_id}'",
            xbmc.LOGERROR,
        )
        xbmcplugin.setResolvedUrl(
            plugin_handle,
            False,
            xbmcgui.ListItem(),
        )
        return

    try:
        media = resolve_media_uri(item.get("media"), CATALOG_PATH)
    except ValueError as error:
        xbmc.log(
            f"plugin.cinematic.earth: Failed to resolve media for "
            f"'{item_id}': {error}",
            xbmc.LOGERROR,
        )
        xbmcplugin.setResolvedUrl(
            plugin_handle,
            False,
            xbmcgui.ListItem(),
        )
        return

    xbmc.log(
        f"plugin.cinematic.earth: Playing {media}",
        xbmc.LOGINFO,
    )

    play_item = xbmcgui.ListItem(
        path=media,
        offscreen=True,
    )

    artwork = resolve_artwork(item, CATALOG_PATH)
    if artwork:
        play_item.setArt(artwork)
    play_item.setProperty("IsPlayable", "true")
    play_item.setProperty("inputstream", "inputstream.adaptive")
    play_item.setProperty(
        "inputstream.adaptive.manifest_type",
        "hls",
    )

    play_item.setMimeType("application/vnd.apple.mpegurl")
    play_item.setContentLookup(False)

    xbmcplugin.setResolvedUrl(
        plugin_handle,
        True,
        play_item,
    )


def main() -> None:
    plugin_url = sys.argv[0]
    plugin_handle = int(sys.argv[1])
    params = dict(parse_qsl(sys.argv[2][1:]))

    if params.get("action") == "play":
        play(plugin_handle, params.get("id", ""))
    else:
        show_directory(plugin_url, plugin_handle)


if __name__ == "__main__":
    main()
