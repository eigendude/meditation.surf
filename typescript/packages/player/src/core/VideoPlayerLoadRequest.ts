/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoSource } from "./VideoSource";

/**
 * @brief Normalized source description consumed by the internal player paths
 */
export class VideoPlayerLoadRequest {
  public readonly url: string;
  public readonly mimeType: string | undefined;

  /**
   * @brief Build one normalized load request
   *
   * @param url - Source URL to play
   * @param mimeType - Optional source MIME type
   */
  public constructor(url: string, mimeType: string | undefined) {
    this.url = url;
    this.mimeType = mimeType;
  }

  /**
   * @brief Normalize caller input into one internal load request
   *
   * @param source - Player-local video source or direct string URL
   *
   * @returns Normalized load request
   */
  public static fromSource(
    source: VideoSource | string,
  ): VideoPlayerLoadRequest {
    if (typeof source === "string") {
      return new VideoPlayerLoadRequest(source, undefined);
    }

    return new VideoPlayerLoadRequest(source.url, source.mimeType);
  }
}
