/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { BackgroundLayerLayout } from "./BackgroundLayerLayout";
import type { ForegroundLayerLayout } from "./ForegroundLayerLayout";

/**
 * @brief Shared layout model for the full meditation.surf app surface
 *
 * The app surface is intentionally simple and explicit: a fullscreen
 * background layer plus a fullscreen foreground layer that hosts a centered
 * overlay. Apps adapt this model into runtime-specific layout behavior.
 */
export class AppLayout {
  private readonly backgroundLayer: BackgroundLayerLayout;
  private readonly foregroundLayer: ForegroundLayerLayout;

  /**
   * @brief Build the shared app layout from its product-level layers
   *
   * @param backgroundLayer - Fullscreen background layer for video playback
   * @param foregroundLayer - Fullscreen foreground layer for UI overlays
   */
  public constructor(
    backgroundLayer: BackgroundLayerLayout,
    foregroundLayer: ForegroundLayerLayout,
  ) {
    this.backgroundLayer = backgroundLayer;
    this.foregroundLayer = foregroundLayer;
  }

  /**
   * @brief Return the shared background layer for the app surface
   *
   * @returns Fullscreen background layer
   */
  public getBackgroundLayer(): BackgroundLayerLayout {
    return this.backgroundLayer;
  }

  /**
   * @brief Return the shared foreground layer for the app surface
   *
   * @returns Fullscreen foreground layer
   */
  public getForegroundLayer(): ForegroundLayerLayout {
    return this.foregroundLayer;
  }
}
