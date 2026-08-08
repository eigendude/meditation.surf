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
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

import xbmc
import xbmcgui
import xbmcplugin


ADDON_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ADDON_ROOT.parent.parent

CATALOG_PATH = REPO_ROOT / "world" / "cinematic.earth" / "catalog.json"


def load_catalog():
    """Load the locally generated cinematic.earth catalog."""
    with CATALOG_PATH.open("r", encoding="utf-8") as file:
        catalog = json.load(file)

    if catalog.get("version") != 1:
        raise ValueError(f"Unsupported catalog version: {catalog.get('version')}")

    items = catalog.get("items")
    if not isinstance(items, list):
        raise ValueError("Catalog 'items' must be an array")

    return catalog


def get_catalog():
    try:
        return load_catalog()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        xbmc.log(
            f"plugin.cinematic.earth: Failed to load {CATALOG_PATH}: {error}",
            xbmc.LOGERROR,
        )
        return None


def show_directory(plugin_url, plugin_handle):
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


def play(plugin_handle, item_id):
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

    media = item["media"]

    xbmc.log(
        f"plugin.cinematic.earth: Playing {media}",
        xbmc.LOGINFO,
    )

    play_item = xbmcgui.ListItem(
        path=media,
        offscreen=True,
    )

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


def main():
    plugin_url = sys.argv[0]
    plugin_handle = int(sys.argv[1])
    params = dict(parse_qsl(sys.argv[2][1:]))

    if params.get("action") == "play":
        play(plugin_handle, params.get("id", ""))
    else:
        show_directory(plugin_url, plugin_handle)


if __name__ == "__main__":
    main()
