/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { ReadableFileDescriptorFactory } from "@meditation-surf/vfs";

import type { MediaSourceDescriptor } from "./MediaSourceDescriptor";
import type { MediaSourcePlaybackSource } from "./MediaSourcePlaybackSource";

/**
 * @brief Media-facing wrapper around the shared VFS source descriptor factory
 */
export class MediaSourceDescriptorFactory {
  /**
   * @brief Create a stable source descriptor from shared playback metadata
   *
   * @param sourceId - Stable identifier assigned by the caller
   * @param playbackSource - Shared playback metadata for one source
   *
   * @returns Shared source descriptor suitable for orchestration state
   */
  public static create(
    sourceId: string,
    playbackSource: MediaSourcePlaybackSource,
  ): MediaSourceDescriptor {
    return ReadableFileDescriptorFactory.create(sourceId, playbackSource);
  }
}
