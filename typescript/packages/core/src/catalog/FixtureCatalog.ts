/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { PlaybackSource } from "@meditation-surf/player-core";

import { Catalog } from "./Catalog";
import { CatalogSection } from "./CatalogSection";
import { MediaItem } from "./MediaItem";
import { MediaItemMetadata } from "./MediaItemMetadata";

/**
 * @brief Shared catalog fixture used by workspace apps
 *
 * This class keeps fixture content assembly in one place so the rest of the
 * shared domain can depend on stable content objects instead of ad hoc data.
 */
export class FixtureCatalog {
  private static readonly GIANT_TEAHUPOO_XXL: MediaItem = new MediaItem(
    "giant-teahupoo-xxl",
    "Giant Teahupoo XXL",
    "A large surf break fixture clip used as the canonical background item.",
    FixtureCatalog.createMuxPlaybackSource(
      "7YtWnCpXIt014uMcBK65ZjGfnScdcAneU9TjM9nGAJhk",
    ),
    new MediaItemMetadata({
      duration: "14:52",
      status: "Ready",
      created: "May 27, 1:22 PM",
      viewCount: "1 view",
      resolution: "4K",
      aspectRatio: "16:9",
      videoCodec: "H.265",
      audioCodec: "AAC",
      channelLayout: "2.0",
    }),
  );

  private static readonly BLOCKTRAIN_2025: MediaItem = new MediaItem(
    "blocktrain-2025",
    "BlockTrain 2025",
    "A fixture clip showcasing the 2025 BlockTrain sequence.",
    FixtureCatalog.createMuxPlaybackSource(
      "tt5vuhvalEUU5XlliVzHb00Fc2rMDkCSu1KEmAS01ovbA",
    ),
    new MediaItemMetadata({
      duration: "0:42",
      status: "Ready",
      created: "Dec 23, 2:45 PM",
      viewCount: "100,000 views",
      resolution: "1080p",
      aspectRatio: "16:9",
      videoCodec: "H.264",
      audioCodec: "AAC",
      channelLayout: "5.1",
    }),
  );

  private static readonly BLOCKTRAIN_2025_CLOSE_UP: MediaItem = new MediaItem(
    "blocktrain-2025-close-up",
    "BlockTrain 2025 Close Up",
    "A closer fixture view of the 2025 BlockTrain sequence.",
    FixtureCatalog.createMuxPlaybackSource(
      "x1s1daoUyt1HAHHPpqyrIM7G501dbX1Nbx9ES01pTE8rE",
    ),
    new MediaItemMetadata({
      duration: "0:34",
      status: "Ready",
      created: "Dec 23, 3:19 PM",
      viewCount: "1 view",
      resolution: "4K",
      aspectRatio: "16:9",
      videoCodec: "H.265",
      audioCodec: "AAC",
      channelLayout: "7.1",
    }),
  );

  private static readonly SEVEN_ONE_FOUR_TEST: MediaItem = new MediaItem(
    "7-1-4-test",
    "7.1.4 Test",
    "A fixture clip used for shared 7.1.4 playback validation content.",
    FixtureCatalog.createMuxPlaybackSource(
      "wuWgaivJDEjgfE7te9dqsZ5Z02Lyy02ltcAeREkug55YI",
    ),
    new MediaItemMetadata({
      duration: "3:18",
      status: "Ready",
      created: "Mar 2, 1:52 AM",
      viewCount: "100,000 views",
      resolution: "4K",
      aspectRatio: "16:9",
      videoCodec: "H.265",
      audioCodec: "AAC",
      channelLayout: "Atmos",
    }),
  );

  private static readonly CATALOG: Catalog = new Catalog([
    new CatalogSection("featured", "Featured", [
      FixtureCatalog.GIANT_TEAHUPOO_XXL,
      FixtureCatalog.BLOCKTRAIN_2025,
      FixtureCatalog.BLOCKTRAIN_2025_CLOSE_UP,
      FixtureCatalog.SEVEN_ONE_FOUR_TEST,
    ]),
  ]);

  /**
   * @brief Return the canonical fixture item used as the background source
   *
   * @returns First fixture media item used for the default background
   */
  public static getBackgroundVideoItem(): MediaItem {
    return FixtureCatalog.GIANT_TEAHUPOO_XXL;
  }

  /**
   * @brief Return the shared fixture catalog
   *
   * @returns Static catalog fixture used across workspace apps
   */
  public static getCatalog(): Catalog {
    return FixtureCatalog.CATALOG;
  }

  /**
   * @brief Create a shared Mux HLS playback source from a public playback ID
   *
   * @param publicPlaybackId - Public Mux playback identifier
   *
   * @returns Shared HLS playback source metadata
   */
  private static createMuxPlaybackSource(
    publicPlaybackId: string,
  ): PlaybackSource {
    const playbackUrl: string = `https://stream.mux.com/${publicPlaybackId}.m3u8`;

    return new PlaybackSource(
      playbackUrl,
      "application/x-mpegURL",
      undefined,
      "stereo",
    );
  }
}
