/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  StageBoundsListener,
  ViewportSize,
  ViewportSizeListener,
} from "./StageLayout";
import { StageLayout } from "./StageLayout";

/**
 * @brief Keep TV viewport updates synchronized across bootstrap and Lightning UI
 *
 * The Lightning app reacts to viewport changes through this class instead of
 * owning window listeners or DOM layout work directly.
 */
export class TvViewportSync {
  private readonly stageLayout: StageLayout;
  private readonly viewportListeners: Set<ViewportSizeListener>;

  /**
   * @brief Create an empty viewport sync owner
   */
  public constructor() {
    this.stageLayout = new StageLayout();
    this.viewportListeners = new Set<ViewportSizeListener>();
  }

  /**
   * @brief Start fitting the Lightning stage into the live viewport
   *
   * @param mountElement - App mount containing the Lightning canvas
   * @param onStageBoundsChanged - Optional callback for runtime-specific side effects
   */
  public start(
    mountElement: HTMLElement,
    onStageBoundsChanged?: (
      left: number,
      top: number,
      width: number,
      height: number,
    ) => void,
  ): void {
    const stageBoundsListener: StageBoundsListener = (
      fittedStageBounds,
      viewportSize,
    ): void => {
      if (onStageBoundsChanged !== undefined) {
        onStageBoundsChanged(
          fittedStageBounds.left,
          fittedStageBounds.top,
          fittedStageBounds.width,
          fittedStageBounds.height,
        );
      }

      this.notify(viewportSize);
    };

    this.stageLayout.start(mountElement, stageBoundsListener);
  }

  /**
   * @brief Subscribe a Lightning UI consumer to live viewport-size updates
   *
   * @param listener - Consumer of viewport-size updates
   *
   * @returns Cleanup function removing the listener
   */
  public subscribe(listener: ViewportSizeListener): () => void {
    this.viewportListeners.add(listener);
    listener(this.stageLayout.getViewportSize());

    return (): void => {
      this.viewportListeners.delete(listener);
    };
  }

  /**
   * @brief Stop all active viewport syncing owned by the TV app
   */
  public destroy(): void {
    this.stageLayout.stop();
    this.viewportListeners.clear();
  }

  /**
   * @brief Notify subscribed Lightning UI consumers about the latest viewport size
   *
   * @param viewportSize - Live browser viewport dimensions
   */
  private notify(viewportSize: ViewportSize): void {
    for (const listener of this.viewportListeners) {
      listener(viewportSize);
    }
  }
}
