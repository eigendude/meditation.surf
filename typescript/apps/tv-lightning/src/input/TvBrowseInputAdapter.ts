/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { BrowseInteractionController } from "@meditation-surf/browse";

import {
  LIGHTNING_APP_HEIGHT,
  LIGHTNING_APP_WIDTH,
} from "../layout/StageLayout";
import type {
  LightningRowState,
  LightningThumbnailState,
} from "../ui/BrowsePresentation";

type StagePointerCoordinates = {
  x: number;
  y: number;
};

/**
 * @brief Prepared directional handlers consumed by the Lightning app input map
 */
export interface TvDirectionalInputHandlers {
  readonly enter: () => void;
  readonly down: () => void;
  readonly left: () => void;
  readonly right: () => void;
  readonly up: () => void;
}

/**
 * @brief Own TV directional, pointer, and touch browse input
 *
 * Keyboard or remote navigation still flows through Lightning's directional
 * input callbacks, while browser-hosted pointer and touch events are hit-tested
 * against the rendered browse rows from outside the view component.
 */
export class TvBrowseInputAdapter {
  private readonly browseInteractionController: BrowseInteractionController;
  private readonly handleClick: (event: MouseEvent) => void;
  private readonly handlePointerDown: (event: PointerEvent) => void;
  private readonly handlePointerMove: (event: PointerEvent) => void;
  private readonly mountElement: HTMLElement;

  private browseRows: readonly LightningRowState[];
  private isAttached: boolean;

  /**
   * @brief Create the TV browse input adapter
   *
   * @param mountElement - DOM root hosting the browser Lightning surface
   * @param browseInteractionController - Shared browse interaction semantics
   */
  public constructor(
    mountElement: HTMLElement,
    browseInteractionController: BrowseInteractionController,
  ) {
    this.mountElement = mountElement;
    this.browseInteractionController = browseInteractionController;
    this.browseRows = [];
    this.isAttached = false;
    this.handlePointerMove = (event: PointerEvent): void => {
      this.handlePointerFocusEvent(event);
    };
    this.handlePointerDown = (event: PointerEvent): void => {
      this.handlePointerFocusEvent(event);
    };
    this.handleClick = (event: MouseEvent): void => {
      this.handleClickFocusEvent(event);
    };
  }

  /**
   * @brief Attach browser-hosted pointer listeners for the TV app
   */
  public attach(): void {
    if (this.isAttached) {
      return;
    }

    this.isAttached = true;
    this.mountElement.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    this.mountElement.addEventListener("pointerdown", this.handlePointerDown, {
      passive: true,
    });
    this.mountElement.addEventListener("click", this.handleClick, {
      passive: true,
    });
  }

  /**
   * @brief Update the latest rendered browse rows used for hit testing
   *
   * @param browseRows - Fixed-stage browse rows currently visible on the TV app
   */
  public syncBrowseRows(browseRows: readonly LightningRowState[]): void {
    this.browseRows = browseRows;
  }

  /**
   * @brief Build directional input callbacks consumed by the Lightning app
   *
   * @returns Prepared directional handlers that emit shared browse intents
   */
  public createDirectionalInputHandlers(): TvDirectionalInputHandlers {
    return {
      enter: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterDirectionalMode" },
          { type: "activateFocusedItem" },
        ]);
      },
      down: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterDirectionalMode" },
          { type: "moveDown" },
        ]);
      },
      left: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterDirectionalMode" },
          { type: "moveLeft" },
        ]);
      },
      right: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterDirectionalMode" },
          { type: "moveRight" },
        ]);
      },
      up: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterDirectionalMode" },
          { type: "moveUp" },
        ]);
      },
    };
  }

  /**
   * @brief Release listeners owned by the browser-hosted TV adapter
   */
  public destroy(): void {
    if (!this.isAttached) {
      return;
    }

    this.isAttached = false;
    this.mountElement.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );
    this.mountElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );
    this.mountElement.removeEventListener("click", this.handleClick);
  }

  /**
   * @brief Handle hover and touch input sourced from browser pointer events
   *
   * @param event - Browser pointer event routed through the DOM host
   */
  private handlePointerFocusEvent(event: PointerEvent): void {
    const stagePointerCoordinates: StagePointerCoordinates | null =
      this.getStagePointerCoordinates(event.clientX, event.clientY);

    this.browseInteractionController.dispatchIntent({
      type: "enterPointerMode",
    });

    if (stagePointerCoordinates === null) {
      return;
    }

    this.focusHitThumbnail(stagePointerCoordinates);
  }

  /**
   * @brief Handle mouse click activation for browser-hosted TV sessions
   *
   * @param event - Browser mouse event routed through the DOM host
   */
  private handleClickFocusEvent(event: MouseEvent): void {
    const stagePointerCoordinates: StagePointerCoordinates | null =
      this.getStagePointerCoordinates(event.clientX, event.clientY);

    this.browseInteractionController.dispatchIntent({
      type: "enterPointerMode",
    });

    if (stagePointerCoordinates === null) {
      return;
    }

    this.activateHitThumbnail(stagePointerCoordinates);
  }

  /**
   * @brief Convert live client coordinates into fixed Lightning stage space
   *
   * @param clientX - Browser client x coordinate
   * @param clientY - Browser client y coordinate
   *
   * @returns Fixed-stage coordinates or `null` when the host has no size
   */
  private getStagePointerCoordinates(
    clientX: number,
    clientY: number,
  ): StagePointerCoordinates | null {
    const mountBounds: DOMRect = this.mountElement.getBoundingClientRect();

    if (mountBounds.width <= 0 || mountBounds.height <= 0) {
      return null;
    }

    return {
      x:
        ((clientX - mountBounds.left) / mountBounds.width) *
        LIGHTNING_APP_WIDTH,
      y:
        ((clientY - mountBounds.top) / mountBounds.height) *
        LIGHTNING_APP_HEIGHT,
    };
  }

  /**
   * @brief Focus the thumbnail intersected by one fixed-stage pointer position
   *
   * @param stagePointerCoordinates - Pointer position in Lightning stage space
   */
  private focusHitThumbnail(
    stagePointerCoordinates: StagePointerCoordinates,
  ): void {
    for (const browseRow of this.browseRows) {
      const rowIndex: number = browseRow.rowPosition;

      for (const [itemIndex, browseItem] of browseRow.items.entries()) {
        if (
          this.isPointerInsideThumbnail(
            stagePointerCoordinates,
            browseRow,
            browseItem,
          )
        ) {
          this.browseInteractionController.dispatchIntent({
            itemIndex,
            rowIndex,
            type: "focusItem",
          });
          return;
        }
      }
    }
  }

  /**
   * @brief Activate the thumbnail intersected by one fixed-stage pointer position
   *
   * @param stagePointerCoordinates - Pointer position in Lightning stage space
   */
  private activateHitThumbnail(
    stagePointerCoordinates: StagePointerCoordinates,
  ): void {
    for (const browseRow of this.browseRows) {
      const rowIndex: number = browseRow.rowPosition;

      for (const [itemIndex, browseItem] of browseRow.items.entries()) {
        if (
          this.isPointerInsideThumbnail(
            stagePointerCoordinates,
            browseRow,
            browseItem,
          )
        ) {
          this.browseInteractionController.dispatchIntents([
            { itemIndex, rowIndex, type: "activateItem" },
          ]);
          return;
        }
      }
    }
  }

  /**
   * @brief Determine whether one pointer position intersects one thumbnail
   *
   * @param stagePointerCoordinates - Pointer position in Lightning stage space
   * @param browseRow - Row containing the thumbnail
   * @param browseItem - Thumbnail rectangle rendered inside that row
   *
   * @returns `true` when the pointer intersects the thumbnail card
   */
  private isPointerInsideThumbnail(
    stagePointerCoordinates: StagePointerCoordinates,
    browseRow: LightningRowState,
    browseItem: LightningThumbnailState,
  ): boolean {
    const left: number = 92 + browseItem.x;
    const top: number = browseRow.titleY + browseItem.y;
    const right: number = left + browseItem.width;
    const bottom: number = top + browseItem.height;

    return (
      stagePointerCoordinates.x >= left &&
      stagePointerCoordinates.x <= right &&
      stagePointerCoordinates.y >= top &&
      stagePointerCoordinates.y <= bottom
    );
  }
}
