/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

export type FittedStageBounds = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type StageLayoutEventDetail = {
  viewportWidth: number;
  viewportHeight: number;
};

export type StageBoundsListener = (
  fittedStageBounds: FittedStageBounds,
  viewportSize: ViewportSize,
) => void;

export type ViewportSizeListener = (viewportSize: ViewportSize) => void;

// Fixed design resolution for a TV-only Lightning experience
export const LIGHTNING_APP_WIDTH: number = 1920;
export const LIGHTNING_APP_HEIGHT: number = 1080;
const TV_STAGE_LAYOUT_EVENT: string = "meditation-surf:tv-stage-layout";

/**
 * @brief Own fitting the fixed Lightning stage into the live browser viewport
 *
 * This class keeps viewport measurement, fitted stage calculation, DOM canvas
 * updates, and lifecycle wiring together under one TV-specific owner.
 */
export class StageLayout {
  private stopLayoutSync: (() => void) | null;

  /**
   * @brief Create an idle stage-layout owner
   */
  public constructor() {
    this.stopLayoutSync = null;
  }

  /**
   * @brief Capture the current browser viewport size
   *
   * @returns Live browser viewport dimensions
   */
  public getViewportSize(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * @brief Start fitting the Lightning canvas into the live viewport
   *
   * @param mountElement - App mount containing the Lightning canvas
   * @param onStageBoundsChanged - Optional TV-specific side effects for fitted bounds
   */
  public start(
    mountElement: HTMLElement,
    onStageBoundsChanged?: StageBoundsListener,
  ): void {
    const handleResize: () => void = (): void => {
      this.applyStageLayout(mountElement, onStageBoundsChanged);
    };

    this.stop();
    window.setTimeout(handleResize, 0);
    window.addEventListener("resize", handleResize);
    this.stopLayoutSync = (): void => {
      window.removeEventListener("resize", handleResize);
    };
  }

  /**
   * @brief Stop any active viewport fitting owned by this layout instance
   */
  public stop(): void {
    this.stopLayoutSync?.();
    this.stopLayoutSync = null;
  }

  /**
   * @brief Fit the fixed Lightning stage into the live browser viewport
   *
   * Keep the original TV aspect ratio intact while centering the fitted stage.
   *
   * @param viewportWidth - Live browser viewport width
   * @param viewportHeight - Live browser viewport height
   *
   * @returns Stage bounds fitted into the viewport
   */
  private getFittedStageBounds(
    viewportWidth: number,
    viewportHeight: number,
  ): FittedStageBounds {
    const widthScale: number = viewportWidth / LIGHTNING_APP_WIDTH;
    const heightScale: number = viewportHeight / LIGHTNING_APP_HEIGHT;
    const scale: number = Math.min(widthScale, heightScale);
    const width: number = LIGHTNING_APP_WIDTH * scale;
    const height: number = LIGHTNING_APP_HEIGHT * scale;
    const left: number = (viewportWidth - width) / 2;
    const top: number = (viewportHeight - height) / 2;

    return {
      width,
      height,
      left,
      top,
    };
  }

  /**
   * @brief Convert the current viewport into the event payload expected by TV UI
   *
   * @returns Stage-layout detail describing the live browser viewport
   */
  private createStageLayoutEventDetail(): StageLayoutEventDetail {
    const viewportSize: ViewportSize = this.getViewportSize();

    return {
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
    };
  }

  /**
   * @brief Notify the Lightning root that the fitted stage layout changed
   */
  private dispatchStageLayoutEvent(): void {
    const stageLayoutEvent: CustomEvent<StageLayoutEventDetail> =
      new CustomEvent<StageLayoutEventDetail>(TV_STAGE_LAYOUT_EVENT, {
        detail: this.createStageLayoutEventDetail(),
      });

    window.dispatchEvent(stageLayoutEvent);
  }

  /**
   * @brief Apply fitted bounds to the Lightning canvas element
   *
   * @param canvasElement - Lightning canvas rendered into the mount element
   * @param fittedStageBounds - Fixed stage fitted into the current viewport
   */
  private applyCanvasStageLayout(
    canvasElement: HTMLCanvasElement,
    fittedStageBounds: FittedStageBounds,
  ): void {
    canvasElement.style.position = "absolute";
    canvasElement.style.top = `${fittedStageBounds.top}px`;
    canvasElement.style.left = `${fittedStageBounds.left}px`;
    canvasElement.style.width = `${fittedStageBounds.width}px`;
    canvasElement.style.height = `${fittedStageBounds.height}px`;
    canvasElement.style.zIndex = "1";
  }

  /**
   * @brief Fit the Lightning canvas into the browser viewport and notify listeners
   *
   * @param mountElement - App mount containing the Lightning canvas
   * @param onStageBoundsChanged - Optional TV-specific side effects for fitted bounds
   */
  private applyStageLayout(
    mountElement: HTMLElement,
    onStageBoundsChanged?: StageBoundsListener,
  ): void {
    const viewportSize: ViewportSize = this.getViewportSize();
    const fittedStageBounds: FittedStageBounds = this.getFittedStageBounds(
      viewportSize.width,
      viewportSize.height,
    );
    const canvasElement: HTMLCanvasElement | null =
      mountElement.querySelector("canvas");

    if (canvasElement !== null) {
      this.applyCanvasStageLayout(canvasElement, fittedStageBounds);
    }

    if (onStageBoundsChanged !== undefined) {
      onStageBoundsChanged(fittedStageBounds, viewportSize);
    }

    this.dispatchStageLayoutEvent();
  }
}
