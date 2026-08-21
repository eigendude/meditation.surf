/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  AppLayout,
  CenteredOverlayLayout,
  CenteredOverlaySize,
} from "@meditation-surf/layout";

import { TvStageIconLayout } from "../layout/TvStageIconLayout";

/**
 * @brief Adapt the shared app layout into TV-specific foreground layout state
 */
export class TvAppLayoutController {
  private readonly centeredOverlay: CenteredOverlayLayout;
  private readonly stageIconLayout: TvStageIconLayout;

  /**
   * @brief Build the TV layout adapter from the shared app surface
   *
   * @param appLayout - Shared app surface layout
   */
  public constructor(appLayout: AppLayout) {
    const centeredOverlay: CenteredOverlayLayout | null = appLayout
      .getForegroundLayer()
      .getCenteredOverlay();

    if (centeredOverlay === null) {
      throw new Error(
        "Expected the demo app layout to expose a centered overlay.",
      );
    }

    this.centeredOverlay = centeredOverlay;
    this.stageIconLayout = new TvStageIconLayout();
  }

  /**
   * @brief Compute the centered overlay size to render within the fixed stage
   *
   * @param stageWidth - Fixed Lightning stage width
   * @param stageHeight - Fixed Lightning stage height
   * @param viewportWidth - Live browser viewport width
   * @param viewportHeight - Live browser viewport height
   *
   * @returns Stage-compensated centered-overlay size for Lightning rendering
   */
  public getStageCenteredOverlaySize(
    stageWidth: number,
    stageHeight: number,
    viewportWidth: number,
    viewportHeight: number,
  ): CenteredOverlaySize {
    const layoutSize: CenteredOverlaySize = this.centeredOverlay.getLayoutSize(
      viewportWidth,
      viewportHeight,
    );

    return {
      width: this.stageIconLayout.getStageCompensatedElementSize(
        layoutSize.width,
        {
          stageWidth,
          stageHeight,
          viewportWidth,
          viewportHeight,
        },
      ),
      height: this.stageIconLayout.getStageCompensatedElementSize(
        layoutSize.height,
        {
          stageWidth,
          stageHeight,
          viewportWidth,
          viewportHeight,
        },
      ),
    };
  }
}
