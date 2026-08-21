/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared placement modes supported by the app surface overlay model
 */
export type CenteredOverlayPlacement = "center";

/**
 * @brief Shared layout size returned for the centered overlay
 */
export type CenteredOverlaySize = {
  width: number;
  height: number;
};

/**
 * @brief Shared centered overlay layout for the foreground layer
 *
 * The current product surface only renders a centered icon overlay. This
 * model keeps that concept explicit in the shared layout package so every
 * runtime can adapt the same layout rules without sharing renderer
 * implementation details.
 */
export class CenteredOverlayLayout {
  public readonly id: string;
  public readonly placement: CenteredOverlayPlacement;
  public readonly aspectRatio: number;
  public readonly maxWidthPx: number;
  public readonly widthViewportRatio: number;

  /**
   * @brief Create the centered overlay layout used by the app surface
   *
   * @param id - Stable overlay identifier
   * @param aspectRatio - Width-to-height ratio for the overlay content
   * @param maxWidthPx - Maximum rendered overlay width in pixels
   * @param widthViewportRatio - Portion of the smaller viewport dimension to use
   */
  public constructor(
    id: string,
    aspectRatio: number,
    maxWidthPx: number,
    widthViewportRatio: number,
  ) {
    this.id = id;
    this.placement = "center";
    this.aspectRatio = aspectRatio;
    this.maxWidthPx = maxWidthPx;
    this.widthViewportRatio = widthViewportRatio;
  }

  /**
   * @brief Compute the centered overlay width for a given surface size
   *
   * @param availableWidth - Viewport width available to the surface
   * @param availableHeight - Viewport height available to the surface
   *
   * @returns Overlay width after shared sizing rules are applied
   */
  public getWidth(availableWidth: number, availableHeight: number): number {
    const smallerDimension: number = Math.min(availableWidth, availableHeight);
    const scaledWidth: number = smallerDimension * this.widthViewportRatio;

    return Math.min(scaledWidth, this.maxWidthPx);
  }

  /**
   * @brief Compute width and height guidance for runtime renderers
   *
   * @param availableWidth - Viewport width available to the surface
   * @param availableHeight - Viewport height available to the surface
   *
   * @returns Shared width and height guidance for the centered overlay
   */
  public getLayoutSize(
    availableWidth: number,
    availableHeight: number,
  ): CenteredOverlaySize {
    const overlayWidth: number = this.getWidth(availableWidth, availableHeight);

    return {
      width: overlayWidth,
      height: overlayWidth / this.aspectRatio,
    };
  }
}

/**
 * @brief Shared centered overlay used by the demo experience
 */
export const DEMO_CENTERED_OVERLAY_LAYOUT: CenteredOverlayLayout =
  new CenteredOverlayLayout("brand-icon-overlay", 1, 240, 0.32);
