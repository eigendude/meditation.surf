/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

type StageScaleInput = {
  stageWidth: number;
  stageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * @brief Own stage-compensated sizing for the TV centered icon overlay
 */
export class TvStageIconLayout {
  /**
   * @brief Convert a target on-screen element size into Lightning stage units
   *
   * The TV app renders into a fixed-resolution stage that is then scaled into
   * the viewport. This helper compensates so the final rendered size still
   * matches the shared viewport-driven layout policy.
   *
   * @param requestedElementSize - Shared on-screen size in viewport pixels
   * @param scaleInput - Fixed stage size and live viewport dimensions
   *
   * @returns Element size to render within the Lightning stage
   */
  public getStageCompensatedElementSize(
    requestedElementSize: number,
    scaleInput: StageScaleInput,
  ): number {
    const stageScale: number = this.getFittedStageScale(scaleInput);

    if (stageScale <= 0) {
      return requestedElementSize;
    }

    return requestedElementSize / stageScale;
  }

  /**
   * @brief Compute the fitted Lightning stage scale for the current viewport
   *
   * @param scaleInput - Fixed stage size and live viewport dimensions
   *
   * @returns Render scale applied to the Lightning stage within the browser
   */
  private getFittedStageScale(scaleInput: StageScaleInput): number {
    const stageWidthScale: number =
      scaleInput.viewportWidth / scaleInput.stageWidth;
    const stageHeightScale: number =
      scaleInput.viewportHeight / scaleInput.stageHeight;

    return Math.min(stageWidthScale, stageHeightScale);
  }
}
