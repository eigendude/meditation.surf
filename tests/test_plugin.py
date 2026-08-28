import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import urlparse


PLUGIN_PATH = (
    Path(__file__).resolve().parents[1]
    / "addons"
    / "plugin.cinematic.earth"
    / "resources"
    / "lib"
    / "plugin.py"
)


class ListItem:
    def __init__(
        self,
        label: str | None = None,
        path: str | None = None,
        offscreen: bool = False,
    ) -> None:
        self.label = label
        self.path = path
        self.offscreen = offscreen
        self.properties = {}
        self.art = {}
        self.mime_type = None
        self.content_lookup = None

    def setProperty(self, key: str, value: str) -> None:
        self.properties[key] = value

    def setArt(self, value: dict[str, str]) -> None:
        self.art.update(value)

    def setMimeType(self, value: str) -> None:
        self.mime_type = value

    def setContentLookup(self, value: bool) -> None:
        self.content_lookup = value


def load_plugin() -> tuple[
    types.ModuleType,
    types.ModuleType,
    types.ModuleType,
]:
    xbmc = types.ModuleType("xbmc")
    xbmc.LOGERROR = 4
    xbmc.LOGINFO = 1
    xbmc.logs = []
    xbmc.log = lambda message, level: xbmc.logs.append((message, level))

    xbmcgui = types.ModuleType("xbmcgui")
    xbmcgui.ListItem = ListItem

    xbmcplugin = types.ModuleType("xbmcplugin")
    xbmcplugin.resolved_urls = []
    xbmcplugin.directory_items = []
    xbmcplugin.setResolvedUrl = lambda handle, succeeded, item: (
        xbmcplugin.resolved_urls.append((handle, succeeded, item))
    )
    xbmcplugin.setContent = lambda *args: None
    xbmcplugin.addDirectoryItem = lambda handle, url, item, isFolder=False: (
        xbmcplugin.directory_items.append((handle, url, item, isFolder))
    )
    xbmcplugin.endOfDirectory = lambda *args, **kwargs: None

    previous_modules = {
        name: sys.modules.get(name)
        for name in ("xbmc", "xbmcgui", "xbmcplugin")
    }
    sys.modules.update({
        "xbmc": xbmc,
        "xbmcgui": xbmcgui,
        "xbmcplugin": xbmcplugin,
    })
    try:
        spec = importlib.util.spec_from_file_location(
            "cinematic_earth_plugin",
            PLUGIN_PATH,
        )
        assert spec is not None
        assert spec.loader is not None
        plugin = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(plugin)
    finally:
        for name, module in previous_modules.items():
            if module is None:
                del sys.modules[name]
            else:
                sys.modules[name] = module

    return plugin, xbmc, xbmcplugin


class ResolveMediaUriTests(unittest.TestCase):
    def setUp(self) -> None:
        self.plugin, _, _ = load_plugin()
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.catalog_path = Path(self.temporary_directory.name) / "catalog.json"
        self.catalog_path.write_text("{}", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_resolves_catalog_relative_media_beneath_the_catalog_root(
        self,
    ) -> None:
        expected = (
            self.catalog_path.parent / "sleep-thunder/master.m3u8"
        ).resolve().as_uri()
        self.assertEqual(
            self.plugin.resolve_media_uri(
                "sleep-thunder/master.m3u8",
                self.catalog_path,
            ),
            expected,
        )

        root = self.catalog_path.parent.resolve()
        for media in (
            "collisions/master.m3u8",
            "winter-lullaby/master.m3u8",
            "sleep-thunder/master.m3u8",
            "relaxation-jazz/master.m3u8",
        ):
            resolved = self.plugin.resolve_media_uri(media, self.catalog_path)
            Path(urlparse(resolved).path).resolve().relative_to(root)

    def test_preserves_absolute_uris_byte_for_byte(self) -> None:
        for media in (
            "https://cinematic.earth/example/master.m3u8",
            "file:///tmp/example.m3u8",
            "magnet:?xt=urn:btih:example",
        ):
            self.assertEqual(
                self.plugin.resolve_media_uri(media, self.catalog_path),
                media,
            )

    def test_rejects_paths_that_escape_the_catalog_root(self) -> None:
        with self.assertRaisesRegex(ValueError, r"escape|containment"):
            self.plugin.resolve_media_uri(
                "../outside/master.m3u8",
                self.catalog_path,
            )

    def test_rejects_symlink_paths_that_escape_the_catalog_root(self) -> None:
        managed_root = Path(self.temporary_directory.name)
        catalog_root = managed_root / "catalog"
        catalog_root.mkdir()
        self.catalog_path = catalog_root / "catalog.json"
        outside = managed_root / "outside"
        outside.mkdir()
        (catalog_root / "linked").symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(ValueError, r"escape|containment"):
            self.plugin.resolve_media_uri("linked/master.m3u8", self.catalog_path)


class DirectoryArtworkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.plugin, self.xbmc, self.xbmcplugin = load_plugin()
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.catalog_path = Path(self.temporary_directory.name) / "catalog.json"
        self.plugin.CATALOG_PATH = self.catalog_path

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_catalog(self, art: object) -> None:
        self.catalog_path.write_text(
            json.dumps({
                "version": 1,
                "items": [{
                    "id": "sleep-thunder",
                    "name": "Thunderstorm Rain for Sleep",
                    "media": "sleep-thunder/master.m3u8",
                    "art": art,
                }],
            }),
            encoding="utf-8",
        )

    def test_directory_item_resolves_relative_kodi_artwork(self) -> None:
        self.write_catalog({
            "thumb": "sleep-thunder/poster.jpg",
            "poster": "sleep-thunder/poster.jpg",
            "fanart": "sleep-thunder/fanart.jpg",
        })

        self.plugin.show_directory("plugin://plugin.cinematic.earth/", 42)

        self.assertEqual(len(self.xbmcplugin.directory_items), 1)
        handle, url, item, is_folder = self.xbmcplugin.directory_items[0]
        self.assertEqual(handle, 42)
        self.assertEqual(
            url,
            "plugin://plugin.cinematic.earth/?action=play&id=sleep-thunder",
        )
        self.assertFalse(is_folder)
        self.assertEqual(item.label, "Thunderstorm Rain for Sleep")
        self.assertEqual(
            item.art,
            {
                "thumb": (
                    self.catalog_path.parent / "sleep-thunder/poster.jpg"
                ).resolve().as_uri(),
                "poster": (
                    self.catalog_path.parent / "sleep-thunder/poster.jpg"
                ).resolve().as_uri(),
                "fanart": (
                    self.catalog_path.parent / "sleep-thunder/fanart.jpg"
                ).resolve().as_uri(),
            },
        )

    def test_unsafe_artwork_is_omitted_without_hiding_item(self) -> None:
        self.write_catalog({
            "thumb": "sleep-thunder/poster.jpg",
            "fanart": "../outside.jpg",
        })

        self.plugin.show_directory("plugin://plugin.cinematic.earth/", 42)

        self.assertEqual(len(self.xbmcplugin.directory_items), 1)
        _, _, item, _ = self.xbmcplugin.directory_items[0]
        self.assertEqual(
            item.art,
            {
                "thumb": (
                    self.catalog_path.parent / "sleep-thunder/poster.jpg"
                ).resolve().as_uri(),
            },
        )
        self.assertTrue(any(level == self.xbmc.LOGERROR for _, level in self.xbmc.logs))

    def test_absolute_artwork_uris_are_omitted_without_hiding_item(
        self,
    ) -> None:
        for artwork in (
            "https://cinematic.earth/poster.jpg",
            "file:///tmp/poster.jpg",
            "special://home/poster.jpg",
            "//example.test/poster.jpg",
            r"C:\artwork\poster.jpg",
        ):
            with self.subTest(artwork=artwork):
                self.xbmc.logs.clear()
                self.xbmcplugin.directory_items.clear()
                self.write_catalog({"poster": artwork})

                self.plugin.show_directory(
                    "plugin://plugin.cinematic.earth/",
                    42,
                )

                self.assertEqual(len(self.xbmcplugin.directory_items), 1)
                _, _, item, _ = self.xbmcplugin.directory_items[0]
                self.assertEqual(item.art, {})
                self.assertTrue(
                    any(
                        level == self.xbmc.LOGERROR
                        for _, level in self.xbmc.logs
                    )
                )

    def test_artwork_resolution_errors_are_omitted_without_hiding_item(
        self,
    ) -> None:
        self.write_catalog({"poster": "sleep-thunder/poster.jpg"})

        with mock.patch.object(
            self.plugin,
            "resolve_artwork_uri",
            side_effect=OSError("unreadable path"),
        ):
            self.plugin.show_directory(
                "plugin://plugin.cinematic.earth/",
                42,
            )

        self.assertEqual(len(self.xbmcplugin.directory_items), 1)
        _, _, item, _ = self.xbmcplugin.directory_items[0]
        self.assertEqual(item.art, {})
        self.assertTrue(
            any(level == self.xbmc.LOGERROR for _, level in self.xbmc.logs)
        )

class PlayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.plugin, self.xbmc, self.xbmcplugin = load_plugin()
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.catalog_path = Path(self.temporary_directory.name) / "catalog.json"
        self.plugin.CATALOG_PATH = self.catalog_path

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_catalog(
        self,
        media: str,
        art: dict[str, str] | None = None,
    ) -> None:
        self.catalog_path.write_text(
            json.dumps({
                "version": 1,
                "items": [{
                    "id": "sleep-thunder",
                    "name": "Sleep Thunder",
                    "media": media,
                    **({"art": art} if art is not None else {}),
                }],
            }),
            encoding="utf-8",
        )

    def test_play_resolves_relative_media_and_preserves_isa_settings(
        self,
    ) -> None:
        self.write_catalog("sleep-thunder/master.m3u8")

        self.plugin.play(42, "sleep-thunder")

        self.assertEqual(len(self.xbmcplugin.resolved_urls), 1)
        handle, succeeded, item = self.xbmcplugin.resolved_urls[0]
        self.assertEqual(handle, 42)
        self.assertTrue(succeeded)
        self.assertEqual(
            item.path,
            (self.catalog_path.parent / "sleep-thunder/master.m3u8").resolve().as_uri(),
        )
        self.assertTrue(item.offscreen)
        self.assertEqual(
            item.properties,
            {
                "IsPlayable": "true",
                "inputstream": "inputstream.adaptive",
                "inputstream.adaptive.manifest_type": "hls",
            },
        )
        self.assertEqual(item.mime_type, "application/vnd.apple.mpegurl")
        self.assertFalse(item.content_lookup)

    def test_play_item_resolves_relative_kodi_artwork(self) -> None:
        self.write_catalog(
            "sleep-thunder/master.m3u8",
            {
                "thumb": "sleep-thunder/poster.jpg",
                "poster": "sleep-thunder/poster.jpg",
                "fanart": "sleep-thunder/fanart.jpg",
            },
        )

        self.plugin.play(42, "sleep-thunder")

        _, succeeded, item = self.xbmcplugin.resolved_urls[0]
        self.assertTrue(succeeded)
        poster_uri = (
            self.catalog_path.parent / "sleep-thunder/poster.jpg"
        ).resolve().as_uri()
        self.assertEqual(
            item.art,
            {
                "thumb": poster_uri,
                "poster": poster_uri,
                "fanart": (
                    self.catalog_path.parent / "sleep-thunder/fanart.jpg"
                ).resolve().as_uri(),
            },
        )

    def test_play_omits_absolute_artwork_without_failing_resolution(
        self,
    ) -> None:
        self.write_catalog(
            "sleep-thunder/master.m3u8",
            {"fanart": "https://cinematic.earth/fanart.jpg"},
        )

        self.plugin.play(42, "sleep-thunder")

        _, succeeded, item = self.xbmcplugin.resolved_urls[0]
        self.assertTrue(succeeded)
        self.assertEqual(item.art, {})
        self.assertTrue(
            any(level == self.xbmc.LOGERROR for _, level in self.xbmc.logs)
        )

    def test_play_rejects_traversal_media_and_logs_an_error(self) -> None:
        self.write_catalog("../outside/master.m3u8")

        self.plugin.play(42, "sleep-thunder")

        self.assertEqual(len(self.xbmcplugin.resolved_urls), 1)
        _, succeeded, _ = self.xbmcplugin.resolved_urls[0]
        self.assertFalse(succeeded)
        self.assertTrue(any(level == self.xbmc.LOGERROR for _, level in self.xbmc.logs))


if __name__ == "__main__":
    unittest.main()
