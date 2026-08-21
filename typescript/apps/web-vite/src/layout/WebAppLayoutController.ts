/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { BRAND_ICON_URL } from "@meditation-surf/assets";
import type {
  AppLayout,
  CenteredOverlayLayout,
  ForegroundLayerLayout,
} from "@meditation-surf/layout";

import { WebBrandOverlay } from "../ui/WebBrandOverlay";

/**
 * @brief Adapt the shared app layout into web-specific DOM layout behavior
 */
export class WebAppLayoutController {
  private readonly foregroundLayer: ForegroundLayerLayout;
  private readonly brandOverlay: WebBrandOverlay;

  /**
   * @brief Capture the shared app layout consumed by the web runtime
   *
   * @param appLayout - Shared app surface layout
   */
  public constructor(appLayout: AppLayout) {
    this.foregroundLayer = appLayout.getForegroundLayer();
    this.brandOverlay = new WebBrandOverlay();
  }

  /**
   * @brief Create the centered overlay element for the current app surface
   *
   * @returns DOM image element representing the centered overlay
   */
  public createCenteredOverlayElement(): HTMLImageElement {
    const centeredOverlay: CenteredOverlayLayout =
      this.getRequiredCenteredOverlay();
    const centeredOverlayElement: HTMLImageElement =
      document.createElement("img");

    centeredOverlayElement.className = "overlay-icon";
    centeredOverlayElement.alt = "";
    centeredOverlayElement.dataset.elementId = centeredOverlay.id;
    centeredOverlayElement.src = BRAND_ICON_URL;

    return centeredOverlayElement;
  }

  /**
   * @brief Apply shared centered-overlay sizing to the DOM image element
   *
   * @param centeredOverlayElement - DOM image element rendered above the video
   */
  public applyCenteredOverlayLayout(
    centeredOverlayElement: HTMLImageElement,
  ): void {
    const centeredOverlay: CenteredOverlayLayout =
      this.getRequiredCenteredOverlay();

    this.brandOverlay.applyLayout(centeredOverlayElement, centeredOverlay);
  }

  /**
   * @brief Resolve the centered overlay required by the current app layout
   *
   * @returns Shared centered overlay layout
   */
  private getRequiredCenteredOverlay(): CenteredOverlayLayout {
    const centeredOverlay: CenteredOverlayLayout | null =
      this.foregroundLayer.getCenteredOverlay();

    if (centeredOverlay === null) {
      throw new Error(
        "Expected the demo app layout to expose a centered overlay.",
      );
    }

    return centeredOverlay;
  }
}
