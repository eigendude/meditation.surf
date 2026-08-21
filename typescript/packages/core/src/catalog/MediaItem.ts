/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PlaybackSource } from "@meditation-surf/player-core";

import { MediaItemMetadata } from "./MediaItemMetadata";

/**
 * @brief A single piece of playable meditation content
 *
 * This object keeps content metadata and playback information together so
 * app-layer code can reason about content through behavior-oriented methods.
 */
export class MediaItem {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  private readonly playbackSource: PlaybackSource;
  private readonly metadata: MediaItemMetadata;

  /**
   * @brief Create a media item from stable content metadata
   *
   * @param id - Stable media item identifier
   * @param title - Human-readable media item title
   * @param description - Media item description shown by app layers
   * @param playbackSource - Shared playback source metadata
   * @param metadata - Shared human-readable catalog metadata
   */
  public constructor(
    id: string,
    title: string,
    description: string,
    playbackSource: PlaybackSource,
    metadata: MediaItemMetadata,
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.playbackSource = playbackSource;
    this.metadata = metadata;
  }

  /**
   * @brief Return the playback source used to play this item
   *
   * @returns Shared playback source metadata for player adapters
   */
  public getPlaybackSource(): PlaybackSource {
    return this.playbackSource;
  }

  /**
   * @brief Return the human-readable metadata associated with this item
   *
   * @returns Shared metadata describing creation, stream details, and views
   */
  public getMetadata(): MediaItemMetadata {
    return this.metadata;
  }
}
