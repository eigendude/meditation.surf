import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generate_hls.py"
SPEC = importlib.util.spec_from_file_location("generate_hls", SCRIPT_PATH)
assert SPEC is not None
assert SPEC.loader is not None
generate_hls = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generate_hls
SPEC.loader.exec_module(generate_hls)


class CommandTests(unittest.TestCase):
    def assert_command_pair(
        self,
        command: list[str],
        option: str,
        value: str,
    ) -> None:
        self.assertIn((option, value), list(zip(command, command[1:])))

    def test_video_command_runs_to_eof(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/alpha.mp4"),
            nfo=Path("/sources/alpha.nfo"),
            media_id="alpha",
            title="Alpha",
            root=Path("/world/alpha"),
        )

        try:
            command = generate_hls.video_command(media, {"index": 3})
        except TypeError as error:
            self.fail(f"video command does not accept per-media context: {error}")

        self.assertNotIn("-t", command)
        self.assertEqual(command[command.index("-i") + 1], "/sources/alpha.mp4")
        self.assert_command_pair(command, "-map", "0:3")
        self.assert_command_pair(command, "-c:v", "copy")

    def test_eac3_command_runs_to_eof(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/bravo.mp4"),
            nfo=Path("/sources/bravo.nfo"),
            media_id="bravo",
            title="Bravo",
            root=Path("/world/bravo"),
        )

        try:
            command = generate_hls.atmos_command(media, {"index": 4})
        except TypeError as error:
            self.fail(f"E-AC-3 command does not accept per-media context: {error}")

        self.assertNotIn("-t", command)
        self.assertEqual(command[command.index("-i") + 1], "/sources/bravo.mp4")
        self.assert_command_pair(command, "-map", "0:4")
        self.assert_command_pair(command, "-c:a", "copy")

    def test_aac_command_runs_to_eof(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/charlie.mp4"),
            nfo=Path("/sources/charlie.nfo"),
            media_id="charlie",
            title="Charlie",
            root=Path("/world/charlie"),
        )

        try:
            command = generate_hls.aac_command(media, {"index": 5})
        except TypeError as error:
            self.fail(f"AAC command does not accept per-media context: {error}")

        self.assertNotIn("-t", command)
        self.assertEqual(command[command.index("-i") + 1], "/sources/charlie.mp4")
        self.assert_command_pair(command, "-map", "0:5")
        self.assert_command_pair(command, "-c:a", "aac")
        self.assert_command_pair(command, "-b:a", "256k")
        self.assert_command_pair(command, "-ac", "2")


class ProbeTests(unittest.TestCase):
    def test_probe_uses_the_current_media_source(self) -> None:
        completed = mock.Mock(stdout='{"streams": [], "format": {}}')

        with mock.patch.object(
            generate_hls.subprocess,
            "run",
            return_value=completed,
        ) as run:
            try:
                probe = generate_hls.probe_source(Path("/sources/alpha.mp4"))
            except TypeError as error:
                self.fail(f"probe does not accept per-media source: {error}")

        self.assertEqual(probe, {"streams": [], "format": {}})
        self.assertEqual(run.call_args.args[0][-1], "/sources/alpha.mp4")

    def test_probe_failure_identifies_source(self) -> None:
        failure = generate_hls.subprocess.CalledProcessError(
            1,
            ["ffprobe"],
            stderr="invalid media",
        )

        with mock.patch.object(
            generate_hls.subprocess,
            "run",
            side_effect=failure,
        ):
            try:
                generate_hls.probe_source(Path("/sources/broken.mp4"))
            except Exception as error:
                self.assertIsInstance(error, ValueError)
                self.assertRegex(
                    str(error),
                    r"broken\.mp4.*ffprobe.*invalid media",
                )
            else:
                self.fail("ffprobe failure was accepted")

    def test_invalid_probe_json_identifies_source(self) -> None:
        completed = mock.Mock(stdout="not json")

        with mock.patch.object(
            generate_hls.subprocess,
            "run",
            return_value=completed,
        ):
            with self.assertRaisesRegex(
                ValueError,
                r"broken\.mp4.*ffprobe.*invalid JSON",
            ):
                generate_hls.probe_source(Path("/sources/broken.mp4"))

    def test_analysis_prefers_first_eac3_for_both_audio_renditions(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/alpha.mp4"),
            nfo=Path("/sources/alpha.nfo"),
            media_id="alpha",
            title="Alpha",
            root=Path("/world/alpha"),
        )
        probe = {
            "streams": [
                {"index": 0, "codec_type": "video", "codec_name": "h264"},
                {"index": 1, "codec_type": "audio", "codec_name": "aac"},
                {"index": 2, "codec_type": "audio", "codec_name": "eac3"},
                {"index": 3, "codec_type": "audio", "codec_name": "eac3"},
            ],
            "format": {},
        }

        try:
            analyzed = generate_hls.analyze_media(media, probe)
        except AttributeError as error:
            self.fail(f"per-media stream analysis is missing: {error}")

        self.assertEqual(analyzed.video["index"], 0)
        self.assertEqual(analyzed.eac3_audio["index"], 2)
        self.assertEqual(analyzed.fallback_audio["index"], 2)

    def test_analysis_falls_back_to_first_audio_without_eac3(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/alpha.mp4"),
            nfo=Path("/sources/alpha.nfo"),
            media_id="alpha",
            title="Alpha",
            root=Path("/world/alpha"),
        )
        probe = {
            "streams": [
                {"index": 0, "codec_type": "video", "codec_name": "h264"},
                {"index": 5, "codec_type": "audio", "codec_name": "aac"},
                {"index": 6, "codec_type": "audio", "codec_name": "flac"},
            ],
            "format": {},
        }

        analyzed = generate_hls.analyze_media(media, probe)

        self.assertIsNone(analyzed.eac3_audio)
        self.assertIsNotNone(analyzed.fallback_audio)
        self.assertEqual(analyzed.fallback_audio["index"], 5)

    def test_analysis_rejects_non_h264_video(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/hevc.mp4"),
            nfo=Path("/sources/hevc.nfo"),
            media_id="hevc",
            title="HEVC",
            root=Path("/world/hevc"),
        )
        probe = {
            "streams": [
                {"index": 0, "codec_type": "video", "codec_name": "hevc"},
                {"index": 1, "codec_type": "audio", "codec_name": "aac"},
            ],
            "format": {},
        }

        with self.assertRaisesRegex(
            ValueError,
            r"hevc\.mp4.*requires H\.264.*hevc",
        ):
            generate_hls.analyze_media(media, probe)

    def test_analysis_rejects_source_without_video(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/audio-only.mp4"),
            nfo=Path("/sources/audio-only.nfo"),
            media_id="audio-only",
            title="Audio Only",
            root=Path("/world/audio-only"),
        )
        probe = {
            "streams": [
                {"index": 0, "codec_type": "audio", "codec_name": "aac"},
            ],
            "format": {},
        }

        try:
            generate_hls.analyze_media(media, probe)
        except Exception as error:
            self.assertIsInstance(error, ValueError)
            self.assertRegex(str(error), r"audio-only\.mp4.*no video")
        else:
            self.fail("source without video was accepted")

    def test_analysis_rejects_source_without_audio(self) -> None:
        media = generate_hls.Media(
            source=Path("/sources/silent.mp4"),
            nfo=Path("/sources/silent.nfo"),
            media_id="silent",
            title="Silent",
            root=Path("/world/silent"),
        )
        probe = {
            "streams": [
                {"index": 0, "codec_type": "video", "codec_name": "h264"},
            ],
            "format": {},
        }

        try:
            generate_hls.analyze_media(media, probe)
        except Exception as error:
            self.assertIsInstance(error, ValueError)
            self.assertRegex(str(error), r"silent\.mp4.*no audio")
        else:
            self.fail("source without audio was accepted")


class CatalogTests(unittest.TestCase):
    def test_catalog_contains_every_media_in_input_order(self) -> None:
        media = [
            generate_hls.Media(
                source=Path("/sources/a.mp4"),
                nfo=Path("/sources/a.nfo"),
                media_id="alpha",
                title="Alpha Title",
                root=Path("/world/alpha"),
            ),
            generate_hls.Media(
                source=Path("/sources/b.mp4"),
                nfo=Path("/sources/b.nfo"),
                media_id="bravo",
                title="Bravo Title",
                root=Path("/world/bravo"),
            ),
        ]

        try:
            catalog = generate_hls.make_catalog(media)
        except TypeError as error:
            self.fail(f"catalog does not accept discovered media: {error}")

        self.assertEqual(
            json.loads(catalog),
            {
                "version": 1,
                "items": [
                    {
                        "id": "alpha",
                        "name": "Alpha Title",
                        "media": "alpha/master.m3u8",
                    },
                    {
                        "id": "bravo",
                        "name": "Bravo Title",
                        "media": "bravo/master.m3u8",
                    },
                ],
            },
        )


class PlaylistTests(unittest.TestCase):
    def make_playlist(self, audio: dict) -> str:
        return generate_hls.make_master_playlist(
            {"format": {"bit_rate": "10000000"}},
            {
                "index": 0,
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "24/1",
            },
            audio,
        )

    def test_eac3_without_explicit_atmos_metadata_is_not_labeled_atmos(self) -> None:
        playlist = self.make_playlist(
            {"index": 1, "codec_name": "eac3", "channels": 6},
        )

        self.assertIn('NAME="E-AC-3"', playlist)
        self.assertNotIn("Dolby Atmos", playlist)
        self.assertNotIn("/JOC", playlist)

    def test_incidental_tag_text_does_not_claim_atmos(self) -> None:
        playlist = self.make_playlist(
            {
                "index": 1,
                "codec_name": "eac3",
                "channels": 6,
                "tags": {"title": "Not Atmos; ordinary E-AC-3"},
            },
        )

        self.assertIn('NAME="E-AC-3"', playlist)
        self.assertNotIn("Dolby Atmos", playlist)
        self.assertNotIn("/JOC", playlist)

    def test_explicit_atmos_profile_is_labeled_atmos(self) -> None:
        playlist = self.make_playlist(
            {
                "index": 1,
                "codec_name": "eac3",
                "profile": "Dolby Digital Plus + Dolby Atmos",
                "channels": 6,
            },
        )

        self.assertIn('NAME="Dolby Atmos"', playlist)
        self.assertIn('CHANNELS="6/JOC"', playlist)


class FileTests(unittest.TestCase):
    def test_write_file_replaces_existing_contents_without_leaving_temp(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            target = Path(temporary_directory) / "catalog.json"
            target.write_text("old\n", encoding="utf-8")

            try:
                generate_hls.write_file(target, "new\n")
            except AttributeError as error:
                self.fail(f"atomic rewrite helper is missing: {error}")

            self.assertEqual(target.read_text(encoding="utf-8"), "new\n")
            self.assertFalse(
                target.with_name(".catalog.json.tmp").exists(),
            )


class GenerationTests(unittest.TestCase):
    def test_missing_configured_source_preserves_existing_world(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            world_root = repository / "world"
            content_root.mkdir()
            stale = world_root / "stale"
            stale.parent.mkdir()
            stale.write_text("keep", encoding="utf-8")

            source = content_root / "a.mp4"
            source.touch()
            source.with_suffix(".nfo").write_text(
                "<movie><title>Alpha</title></movie>",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(
                ValueError,
                r"missing configured source.*b\.mp4",
            ):
                generate_hls.build_world(
                    content_root,
                    world_root,
                    {"a.mp4": "alpha", "b.mp4": "bravo"},
                    probe=lambda _: {
                        "streams": [
                            {
                                "index": 0,
                                "codec_type": "video",
                                "codec_name": "h264",
                            },
                            {
                                "index": 1,
                                "codec_type": "audio",
                                "codec_name": "aac",
                            },
                        ],
                        "format": {},
                    },
                    generate=lambda _: None,
                )

            self.assertTrue(stale.exists())

    def test_all_sources_are_probed_before_any_generation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            world_root = repository / "world"
            content_root.mkdir()
            stale = world_root / "stale"
            stale.parent.mkdir()
            stale.write_text("keep", encoding="utf-8")

            for filename in ("a.mp4", "b.mp4"):
                source = content_root / filename
                source.touch()
                source.with_suffix(".nfo").write_text(
                    f"<movie><title>{filename}</title></movie>",
                    encoding="utf-8",
                )

            events = []

            def probe(source: Path) -> dict:
                events.append(f"probe:{source.name}")
                if source.name == "b.mp4":
                    raise ValueError("b.mp4 cannot be probed")
                return {
                    "streams": [
                        {
                            "index": 0,
                            "codec_type": "video",
                            "codec_name": "h264",
                        },
                        {
                            "index": 1,
                            "codec_type": "audio",
                            "codec_name": "aac",
                        },
                    ],
                    "format": {},
                }

            def generate(analyzed) -> None:
                events.append(f"generate:{analyzed.media.source.name}")

            try:
                build_world = generate_hls.build_world
            except AttributeError as error:
                self.fail(f"multi-media orchestration is missing: {error}")

            with self.assertRaisesRegex(ValueError, r"b\.mp4 cannot be probed"):
                build_world(
                    content_root,
                    world_root,
                    {"a.mp4": "alpha", "b.mp4": "bravo"},
                    probe=probe,
                    generate=generate,
                )

            self.assertEqual(events, ["probe:a.mp4", "probe:b.mp4"])
            self.assertTrue(stale.exists())
            self.assertFalse((world_root / "catalog.json").exists())

    def test_successful_build_generates_all_media_then_writes_catalog(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            world_root = repository / "world"
            content_root.mkdir()
            stale = world_root / "stale"
            stale.parent.mkdir()
            stale.write_text("discard", encoding="utf-8")

            for filename, title in (
                ("a.mp4", "Alpha"),
                ("b.mp4", "Bravo"),
            ):
                source = content_root / filename
                source.touch()
                source.with_suffix(".nfo").write_text(
                    f"<movie><title>{title}</title></movie>",
                    encoding="utf-8",
                )

            events = []

            def probe(source: Path) -> dict:
                events.append(f"probe:{source.name}")
                return {
                    "streams": [
                        {
                            "index": 0,
                            "codec_type": "video",
                            "codec_name": "h264",
                        },
                        {
                            "index": 1,
                            "codec_type": "audio",
                            "codec_name": "aac",
                        },
                    ],
                    "format": {},
                }

            def generate(analyzed) -> None:
                self.assertFalse(stale.exists())
                events.append(f"generate:{analyzed.media.source.name}")

            generate_hls.build_world(
                content_root,
                world_root,
                {"a.mp4": "alpha", "b.mp4": "bravo"},
                probe=probe,
                generate=generate,
            )

            self.assertEqual(
                events,
                [
                    "probe:a.mp4",
                    "probe:b.mp4",
                    "generate:a.mp4",
                    "generate:b.mp4",
                ],
            )
            self.assertFalse(stale.exists())
            self.assertEqual(
                json.loads((world_root / "catalog.json").read_text("utf-8")),
                {
                    "version": 1,
                    "items": [
                        {
                            "id": "alpha",
                            "name": "Alpha",
                            "media": "alpha/master.m3u8",
                        },
                        {
                            "id": "bravo",
                            "name": "Bravo",
                            "media": "bravo/master.m3u8",
                        },
                    ],
                },
            )


class DiscoveryTests(unittest.TestCase):
    def discover_single(
        self,
        temporary_directory: str,
        nfo_contents: str,
    ):
        repository = Path(temporary_directory)
        content_root = repository / "content"
        content_root.mkdir()
        source = content_root / "source.mp4"
        source.touch()
        source.with_suffix(".nfo").write_text(nfo_contents, encoding="utf-8")

        return generate_hls.discover_media(
            content_root,
            repository / "world",
            {source.name: "source"},
        )

    def test_discovers_direct_mp4s_in_filename_order_with_nfo_titles(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            world_root = repository / "world"
            content_root.mkdir()

            for filename, title in (
                ("b.mp4", "  Bravo  "),
                ("a.mp4", "Alpha"),
            ):
                (content_root / filename).touch()
                (content_root / filename).with_suffix(".nfo").write_text(
                    f"<movie><title>{title}</title></movie>",
                    encoding="utf-8",
                )

            (content_root / ".hidden.mp4").touch()
            (content_root / "draft.tmp.mp4").touch()
            (content_root / "notes.txt").touch()
            nested = content_root / "nested"
            nested.mkdir()
            (nested / "nested.mp4").touch()

            media = generate_hls.discover_media(
                content_root,
                world_root,
                {"a.mp4": "alpha", "b.mp4": "bravo"},
            )

            self.assertEqual(
                [
                    (
                        item.source.name,
                        item.nfo.name,
                        item.media_id,
                        item.title,
                        item.root,
                    )
                    for item in media
                ],
                [
                    (
                        "a.mp4",
                        "a.nfo",
                        "alpha",
                        "Alpha",
                        world_root / "alpha",
                    ),
                    (
                        "b.mp4",
                        "b.nfo",
                        "bravo",
                        "Bravo",
                        world_root / "bravo",
                    ),
                ],
            )

    def test_rejects_nfo_without_movie_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaisesRegex(
                ValueError,
                r"source\.mp4.*source\.nfo.*root.*movie",
            ):
                self.discover_single(
                    temporary_directory,
                    "<episode><title>Wrong root</title></episode>",
                )

    def test_rejects_source_without_matching_nfo(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            content_root.mkdir()
            source = content_root / "source.mp4"
            source.touch()

            try:
                generate_hls.discover_media(
                    content_root,
                    repository / "world",
                    {source.name: "source"},
                )
            except Exception as error:
                self.assertIsInstance(error, ValueError)
                self.assertRegex(
                    str(error),
                    r"source\.mp4.*source\.nfo.*missing",
                )
            else:
                self.fail("missing NFO was accepted")

    def test_rejects_malformed_nfo_with_source_context(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            try:
                self.discover_single(
                    temporary_directory,
                    "<movie><title>Broken</movie>",
                )
            except Exception as error:
                self.assertIsInstance(error, ValueError)
                self.assertRegex(
                    str(error),
                    r"source\.mp4.*source\.nfo.*malformed",
                )
            else:
                self.fail("malformed NFO was accepted")

    def test_rejects_nfo_without_title(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            try:
                self.discover_single(temporary_directory, "<movie></movie>")
            except Exception as error:
                self.assertIsInstance(error, ValueError)
                self.assertRegex(
                    str(error),
                    r"source\.mp4.*source\.nfo.*missing.*title",
                )
            else:
                self.fail("NFO without a title was accepted")

    def test_rejects_nfo_with_empty_title(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaisesRegex(
                ValueError,
                r"source\.mp4.*source\.nfo.*empty.*title",
            ):
                self.discover_single(
                    temporary_directory,
                    "<movie><title>   </title></movie>",
                )

    def test_rejects_source_without_configured_media_id(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            content_root.mkdir()
            source = content_root / "source.mp4"
            source.touch()
            source.with_suffix(".nfo").write_text(
                "<movie><title>Source</title></movie>",
                encoding="utf-8",
            )

            try:
                generate_hls.discover_media(
                    content_root,
                    repository / "world",
                    {},
                )
            except Exception as error:
                self.assertIsInstance(error, ValueError)
                self.assertRegex(str(error), r"source\.mp4.*media ID")
            else:
                self.fail("source without a configured media ID was accepted")

    def test_rejects_unsafe_media_id(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaisesRegex(
                ValueError,
                r"source\.mp4.*unsafe media ID.*\.\./outside",
            ):
                repository = Path(temporary_directory)
                content_root = repository / "content"
                content_root.mkdir()
                source = content_root / "source.mp4"
                source.touch()
                source.with_suffix(".nfo").write_text(
                    "<movie><title>Source</title></movie>",
                    encoding="utf-8",
                )
                generate_hls.discover_media(
                    content_root,
                    repository / "world",
                    {source.name: "../outside"},
                )

    def test_rejects_duplicate_media_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            content_root = repository / "content"
            content_root.mkdir()

            for filename in ("a.mp4", "b.mp4"):
                source = content_root / filename
                source.touch()
                source.with_suffix(".nfo").write_text(
                    f"<movie><title>{filename}</title></movie>",
                    encoding="utf-8",
                )

            with self.assertRaisesRegex(
                ValueError,
                r"a\.mp4.*b\.mp4.*duplicate media ID.*same",
            ):
                generate_hls.discover_media(
                    content_root,
                    repository / "world",
                    {"a.mp4": "same", "b.mp4": "same"},
                )


if __name__ == "__main__":
    unittest.main()
