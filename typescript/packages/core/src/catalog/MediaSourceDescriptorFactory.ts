/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  type MediaSourceDescriptor,
  MediaSourceDescriptorFactory as SharedMediaSourceDescriptorFactory,
  type MediaSourcePlaybackSource,
} from "@meditation-surf/media";

import type { MediaItem } from "./MediaItem";

/**
 * @brief Build stable source descriptors for shared media planning
 *
 * This core adapter keeps the reusable media package independent from the
 * product-specific `MediaItem` model while preserving the existing behavior.
 */
export class MediaSourceDescriptorFactory {
  /**
   * @brief Create a stable source descriptor from a shared media item
   *
   * @param mediaItem - Shared media item that owns playback metadata
   *
   * @returns Shared source descriptor suitable for orchestration state
   */
  public static createForMediaItem(
    mediaItem: MediaItem,
  ): MediaSourceDescriptor {
    const playbackSource: MediaSourcePlaybackSource = {
      url: mediaItem.getPlaybackSource().url,
      mimeType: mediaItem.getPlaybackSource().mimeType ?? null,
      posterUrl: mediaItem.getPlaybackSource().posterUrl ?? null,
    };

    return SharedMediaSourceDescriptorFactory.create(
      `media-source:${mediaItem.id}`,
      playbackSource,
    );
  }
}
