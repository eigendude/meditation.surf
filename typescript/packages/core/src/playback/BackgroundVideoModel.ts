/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PlaybackSource } from "@meditation-surf/player-core";

/**
 * @brief Playback policy for a runtime-agnostic background video model
 */
export type BackgroundVideoPlaybackPolicy = {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  playsInline: boolean;
  objectFit: "cover";
};

/**
 * @brief Shared background video model for the meditation experience
 *
 * The model owns product-level intent only. Each app still decides how to
 * apply this policy to a concrete player implementation.
 */
export class BackgroundVideoModel {
  private readonly playbackSource: PlaybackSource;
  private readonly playbackPolicy: BackgroundVideoPlaybackPolicy;

  /**
   * @brief Create a background video model from source and policy data
   *
   * @param playbackSource - Shared playback source metadata
   * @param playbackPolicy - Shared product playback policy
   */
  public constructor(
    playbackSource: PlaybackSource,
    playbackPolicy: BackgroundVideoPlaybackPolicy,
  ) {
    this.playbackSource = playbackSource;
    this.playbackPolicy = playbackPolicy;
  }

  /**
   * @brief Return the shared playback source for the background treatment
   *
   * @returns The playback source consumed by runtime-specific player adapters
   */
  public getPlaybackSource(): PlaybackSource {
    return this.playbackSource;
  }

  /**
   * @brief Return the shared playback policy for the background treatment
   *
   * @returns Product-level playback flags for runtime adapters
   */
  public getPlaybackPolicy(): BackgroundVideoPlaybackPolicy {
    return this.playbackPolicy;
  }
}
