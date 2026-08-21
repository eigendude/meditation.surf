/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  BrowseInputIntent,
  BrowseInputMode,
} from "@meditation-surf/browse";
import { BrowseInteractionController } from "@meditation-surf/browse";

import type { WebAppShell } from "../ui/WebAppShell";

/**
 * @brief Own browser event wiring for web browse input
 *
 * The adapter keeps keyboard, pointer, and touch handling out of the DOM view
 * builder so the shell can stay focused on presentation.
 */
export class WebBrowseInputAdapter {
  private readonly browseInteractionController: BrowseInteractionController;
  private readonly handleDocumentClick: () => void;
  private readonly handleDocumentPointerDown: () => void;
  private readonly handleDocumentPointerMove: () => void;
  private readonly handleWindowKeyDown: (event: KeyboardEvent) => void;
  private readonly shell: WebAppShell;

  private isAttached: boolean;
  private removeInputModeSubscription: (() => void) | null;
  private thumbnailCleanupCallbacks: Array<() => void>;

  /**
   * @brief Create the web browse input adapter
   *
   * @param shell - Runtime DOM shell that renders the browse overlay
   * @param browseInteractionController - Shared browse interaction semantics
   */
  public constructor(
    shell: WebAppShell,
    browseInteractionController: BrowseInteractionController,
  ) {
    this.shell = shell;
    this.browseInteractionController = browseInteractionController;
    this.isAttached = false;
    this.removeInputModeSubscription = null;
    this.thumbnailCleanupCallbacks = [];
    this.handleWindowKeyDown = (event: KeyboardEvent): void => {
      this.handleDirectionalKeyboardInput(event);
    };
    this.handleDocumentPointerMove = (): void => {
      this.browseInteractionController.dispatchIntent({
        type: "enterPointerMode",
      });
    };
    this.handleDocumentPointerDown = (): void => {
      this.browseInteractionController.dispatchIntent({
        type: "enterPointerMode",
      });
    };
    this.handleDocumentClick = (): void => {
      this.browseInteractionController.dispatchIntent({
        type: "enterPointerMode",
      });
    };
  }

  /**
   * @brief Attach global and per-item input listeners
   */
  public attach(): void {
    if (this.isAttached) {
      return;
    }

    this.isAttached = true;
    window.addEventListener("keydown", this.handleWindowKeyDown);
    window.addEventListener("pointermove", this.handleDocumentPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", this.handleDocumentPointerDown, {
      passive: true,
    });
    window.addEventListener("click", this.handleDocumentClick, {
      passive: true,
    });
    this.removeInputModeSubscription =
      this.browseInteractionController.subscribeInputMode(
        (inputMode: BrowseInputMode): void => {
          this.shell.renderInputMode(inputMode);
        },
      );
    this.syncBrowseTargets();
  }

  /**
   * @brief Rebind thumbnail listeners after the shell rerenders browse content
   */
  public syncBrowseTargets(): void {
    this.clearThumbnailCleanupCallbacks();

    for (const rowCardElements of this.shell.getThumbnailCardElements()) {
      for (const thumbnailCardElement of rowCardElements) {
        const handlePointerEnter: () => void = (): void => {
          this.focusItemFromPointerTarget(thumbnailCardElement);
        };
        const handlePointerDown: () => void = (): void => {
          this.focusItemFromPointerTarget(thumbnailCardElement);
        };
        const handleClick: () => void = (): void => {
          this.activateItemFromPointerTarget(thumbnailCardElement);
        };

        thumbnailCardElement.addEventListener(
          "pointerenter",
          handlePointerEnter,
        );
        thumbnailCardElement.addEventListener("pointerdown", handlePointerDown);
        thumbnailCardElement.addEventListener("click", handleClick);
        this.thumbnailCleanupCallbacks.push((): void => {
          thumbnailCardElement.removeEventListener(
            "pointerenter",
            handlePointerEnter,
          );
          thumbnailCardElement.removeEventListener(
            "pointerdown",
            handlePointerDown,
          );
          thumbnailCardElement.removeEventListener("click", handleClick);
        });
      }
    }
  }

  /**
   * @brief Release every listener owned by the adapter
   */
  public destroy(): void {
    if (!this.isAttached) {
      return;
    }

    this.isAttached = false;
    this.clearThumbnailCleanupCallbacks();
    this.removeInputModeSubscription?.();
    this.removeInputModeSubscription = null;
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    window.removeEventListener("pointermove", this.handleDocumentPointerMove);
    window.removeEventListener("pointerdown", this.handleDocumentPointerDown);
    window.removeEventListener("click", this.handleDocumentClick);
  }

  /**
   * @brief Map arrow-key presses onto shared directional browse commands
   *
   * @param event - Browser keyboard event sourced from the active window
   */
  private handleDirectionalKeyboardInput(event: KeyboardEvent): void {
    const browseInputIntents: readonly BrowseInputIntent[] | null =
      this.getBrowseInputIntentsFromKeyboardEvent(event);

    if (browseInputIntents === null) {
      return;
    }

    event.preventDefault();
    this.browseInteractionController.dispatchIntents(browseInputIntents);
  }

  /**
   * @brief Convert a keyboard event into shared directional-mode browse intents
   *
   * @param event - Browser keyboard event to inspect
   *
   * @returns Shared browse intents or `null` when the key is unrelated
   */
  private getBrowseInputIntentsFromKeyboardEvent(
    event: KeyboardEvent,
  ): readonly BrowseInputIntent[] | null {
    switch (event.key) {
      case "ArrowLeft":
        return this.createDirectionalInputIntents({ type: "moveLeft" });
      case "ArrowRight":
        return this.createDirectionalInputIntents({ type: "moveRight" });
      case "ArrowUp":
        return this.createDirectionalInputIntents({ type: "moveUp" });
      case "ArrowDown":
        return this.createDirectionalInputIntents({ type: "moveDown" });
      case "Enter":
      case " ":
        return this.browseInteractionController.getInputMode() === "directional"
          ? this.createDirectionalInputIntents({
              type: "activateFocusedItem",
            })
          : null;
      default:
        return null;
    }
  }

  /**
   * @brief Prefix one directional movement with directional-mode activation
   *
   * @param movementIntent - Directional browse movement emitted by the keyboard
   *
   * @returns Ordered abstract browse intents for one directional event
   */
  private createDirectionalInputIntents(
    movementIntent: BrowseInputIntent,
  ): readonly BrowseInputIntent[] {
    return [{ type: "enterDirectionalMode" }, movementIntent];
  }

  /**
   * @brief Enter pointer mode and focus the item described by one card element
   *
   * @param thumbnailCardElement - Rendered card element with row and item data
   */
  private focusItemFromPointerTarget(thumbnailCardElement: HTMLElement): void {
    const rowIndexText: string | undefined =
      thumbnailCardElement.dataset.rowIndex;
    const itemIndexText: string | undefined =
      thumbnailCardElement.dataset.itemIndex;

    if (rowIndexText === undefined || itemIndexText === undefined) {
      return;
    }

    const rowIndex: number = Number.parseInt(rowIndexText, 10);
    const itemIndex: number = Number.parseInt(itemIndexText, 10);

    this.browseInteractionController.dispatchIntents([
      { type: "enterPointerMode" },
      {
        itemIndex,
        rowIndex,
        type: "focusItem",
      },
    ]);
  }

  /**
   * @brief Enter pointer mode and activate the item described by one card
   *
   * @param thumbnailCardElement - Rendered card element with row and item data
   */
  private activateItemFromPointerTarget(
    thumbnailCardElement: HTMLElement,
  ): void {
    const rowIndexText: string | undefined =
      thumbnailCardElement.dataset.rowIndex;
    const itemIndexText: string | undefined =
      thumbnailCardElement.dataset.itemIndex;

    if (rowIndexText === undefined || itemIndexText === undefined) {
      return;
    }

    const rowIndex: number = Number.parseInt(rowIndexText, 10);
    const itemIndex: number = Number.parseInt(itemIndexText, 10);

    this.browseInteractionController.dispatchIntents([
      { type: "enterPointerMode" },
      { itemIndex, rowIndex, type: "activateItem" },
    ]);
  }

  /**
   * @brief Remove the current batch of thumbnail-specific listeners
   */
  private clearThumbnailCleanupCallbacks(): void {
    for (const cleanupCallback of this.thumbnailCleanupCallbacks) {
      cleanupCallback();
    }

    this.thumbnailCleanupCallbacks = [];
  }
}
