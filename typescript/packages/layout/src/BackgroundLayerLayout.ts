/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { BackgroundVideoModel } from "@meditation-surf/core";

/**
 * @brief Shared layout model for the fullscreen background layer
 *
 * The current product surface always presents background video edge-to-edge.
 * Runtime-specific apps still decide how to realize that behavior with DOM,
 * React Native, or Lightning primitives.
 */
export class BackgroundLayerLayout {
  private readonly backgroundVideo: BackgroundVideoModel;

  /**
   * @brief Build the shared fullscreen background layer
   *
   * @param backgroundVideo - Shared background video shown by the app surface
   */
  public constructor(backgroundVideo: BackgroundVideoModel) {
    this.backgroundVideo = backgroundVideo;
  }

  /**
   * @brief Return the background video rendered by this layer
   *
   * @returns Shared background video model
   */
  public getBackgroundVideo(): BackgroundVideoModel {
    return this.backgroundVideo;
  }

  /**
   * @brief Report whether the layer fills the full app surface
   *
   * @returns `true` because the background layer is fullscreen
   */
  public fillsSurface(): true {
    return true;
  }
}
