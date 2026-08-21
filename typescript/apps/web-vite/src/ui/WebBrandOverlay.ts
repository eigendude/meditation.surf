/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CenteredOverlayLayout } from "@meditation-surf/layout";

/**
 * @brief Own DOM layout adaptation for the web brand overlay
 */
export class WebBrandOverlay {
  /**
   * @brief Keep the overlay icon centered and sized from the shared scene model
   *
   * @param overlayIconElement - DOM image element that renders the brand icon
   * @param overlayLayout - Shared layout model for the centered overlay
   */
  public applyLayout(
    overlayIconElement: HTMLImageElement,
    overlayLayout: CenteredOverlayLayout,
  ): void {
    const layoutSize: { width: number; height: number } =
      overlayLayout.getLayoutSize(window.innerWidth, window.innerHeight);

    overlayIconElement.style.width = `${layoutSize.width}px`;
    overlayIconElement.style.height = `${layoutSize.height}px`;
  }
}
