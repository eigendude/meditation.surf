/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CenteredOverlayLayout } from "./CenteredOverlayLayout";

/**
 * @brief Shared layout model for the fullscreen foreground layer
 *
 * The foreground layer currently fills the whole app surface and hosts the
 * centered icon overlay rendered above the background video.
 */
export class ForegroundLayerLayout {
  private readonly centeredOverlay: CenteredOverlayLayout | null;

  /**
   * @brief Build the shared fullscreen foreground layer
   *
   * @param centeredOverlay - Centered overlay rendered inside the foreground
   */
  public constructor(centeredOverlay: CenteredOverlayLayout | null) {
    this.centeredOverlay = centeredOverlay;
  }

  /**
   * @brief Report whether the layer fills the full app surface
   *
   * @returns `true` because the foreground layer is fullscreen
   */
  public fillsSurface(): true {
    return true;
  }

  /**
   * @brief Return the centered overlay rendered inside the foreground layer
   *
   * @returns Shared centered overlay layout, or `null` when absent
   */
  public getCenteredOverlay(): CenteredOverlayLayout | null {
    return this.centeredOverlay;
  }
}
