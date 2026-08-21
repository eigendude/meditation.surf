/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { BrowseFocusState } from "./BrowseFocusController";
import { BrowseFocusController } from "./BrowseFocusController";
import type {
  BrowseDirectionalInputIntent,
  BrowseInputCommand,
  BrowseInputIntent,
} from "./BrowseInputIntent";
import { BrowseSelectionController } from "./BrowseSelectionController";

/**
 * @brief Supported browse input modes shared across app surfaces
 */
export type BrowseInputMode = "directional" | "pointer";

/**
 * @brief Listener signature used for browse input-mode updates
 */
export type BrowseInputModeListener = (inputMode: BrowseInputMode) => void;

/**
 * @brief Translate surface input into shared browse focus commands
 *
 * The interaction controller keeps directional-mode state local to the active
 * runtime, while the browse focus state itself stays in the shared
 * `BrowseFocusController`.
 */
export class BrowseInteractionController {
  private readonly browseFocusController: BrowseFocusController;
  private readonly browseSelectionController: BrowseSelectionController;
  private readonly inputModeListeners: Set<BrowseInputModeListener>;

  private inputMode: BrowseInputMode;

  /**
   * @brief Create a browse interaction controller for one app surface
   *
   * @param browseFocusController - Shared browse focus semantics
   * @param browseSelectionController - Shared browse selection semantics
   */
  public constructor(
    browseFocusController: BrowseFocusController,
    browseSelectionController: BrowseSelectionController,
  ) {
    this.browseFocusController = browseFocusController;
    this.browseSelectionController = browseSelectionController;
    this.inputModeListeners = new Set<BrowseInputModeListener>();
    this.inputMode = "pointer";
  }

  /**
   * @brief Return the current browse input mode
   *
   * @returns Active browse input mode
   */
  public getInputMode(): BrowseInputMode {
    return this.inputMode;
  }

  /**
   * @brief Subscribe to browse input-mode updates
   *
   * @param listener - Callback notified when the input mode changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribeInputMode(listener: BrowseInputModeListener): () => void {
    this.inputModeListeners.add(listener);
    listener(this.inputMode);

    return (): void => {
      this.inputModeListeners.delete(listener);
    };
  }

  /**
   * @brief Enter directional browse mode
   */
  public enterDirectionalMode(): void {
    this.transitionInputMode("directional");
  }

  /**
   * @brief Enter pointer-driven browse mode
   */
  public enterPointerMode(): void {
    this.transitionInputMode("pointer");
  }

  /**
   * @brief Interpret one abstract browse input intent
   *
   * @param intent - High-level browse input intent emitted by a platform adapter
   */
  public dispatchIntent(intent: BrowseInputIntent): void {
    switch (intent.type) {
      case "enterPointerMode":
        this.enterPointerMode();
        break;
      case "enterDirectionalMode":
        this.enterDirectionalMode();
        break;
      case "moveLeft":
      case "moveRight":
      case "moveUp":
      case "moveDown":
        this.dispatchDirectionalIntent(intent);
        break;
      case "focusItem":
        this.browseFocusController.focusItem(intent.rowIndex, intent.itemIndex);
        break;
      case "activateFocusedItem":
        this.dispatchActivationIntent();
        break;
      case "activateItem":
        this.dispatchTargetedActivationIntent(
          intent.rowIndex,
          intent.itemIndex,
        );
        break;
      default:
        intent satisfies never;
    }
  }

  /**
   * @brief Interpret a batch of browse intents in the order they were emitted
   *
   * @param intents - Ordered intents derived from one raw platform event
   */
  public dispatchIntents(intents: readonly BrowseInputIntent[]): void {
    for (const intent of intents) {
      this.dispatchIntent(intent);
    }
  }

  /**
   * @brief Backward-compatible alias for shared browse input commands
   *
   * @param command - Abstract browse command emitted by a platform adapter
   */
  public dispatchCommand(command: BrowseInputCommand): void {
    this.dispatchIntent(command);
  }

  /**
   * @brief Backward-compatible alias for direct browse item focus
   *
   * @param rowIndex - Row containing the focused item
   * @param itemIndex - Item to activate within the row
   */
  public focusItem(rowIndex: number, itemIndex: number): void {
    this.dispatchIntent({
      itemIndex,
      rowIndex,
      type: "focusItem",
    });
  }

  /**
   * @brief Select the item currently owned by shared focus
   */
  public activateFocusedItem(): void {
    this.dispatchIntent({
      type: "activateFocusedItem",
    });
  }

  /**
   * @brief Select one explicit browse item without depending on current focus
   *
   * @param rowIndex - Row containing the activated item
   * @param itemIndex - Item position that should become selected
   */
  public activateItem(rowIndex: number, itemIndex: number): void {
    this.dispatchIntent({
      itemIndex,
      rowIndex,
      type: "activateItem",
    });
  }

  /**
   * @brief Interpret one shared directional browse intent
   *
   * @param intent - Directional browse intent to apply to the shared focus state
   */
  private dispatchDirectionalIntent(
    intent: BrowseDirectionalInputIntent,
  ): void {
    this.enterDirectionalMode();

    switch (intent.type) {
      case "moveLeft":
        this.browseFocusController.moveLeft();
        break;
      case "moveRight":
        this.browseFocusController.moveRight();
        break;
      case "moveUp":
        this.browseFocusController.moveUp();
        break;
      case "moveDown":
        this.browseFocusController.moveDown();
        break;
      default:
        intent satisfies never;
    }
  }

  /**
   * @brief Interpret one shared browse activation intent
   */
  private dispatchActivationIntent(): void {
    const browseFocusState: BrowseFocusState =
      this.browseFocusController.getState();

    if (!browseFocusState.hasFocusedItem) {
      return;
    }

    const selectedRowIndex: number = browseFocusState.activeRowIndex;
    const selectedItemIndex: number =
      browseFocusState.activeItemIndexByRow[selectedRowIndex] ?? 0;

    this.dispatchTargetedActivationIntent(selectedRowIndex, selectedItemIndex);
  }

  /**
   * @brief Select one explicit browse item as the current activation target
   *
   * @param rowIndex - Row containing the activated item
   * @param itemIndex - Item position that should become selected
   */
  private dispatchTargetedActivationIntent(
    rowIndex: number,
    itemIndex: number,
  ): void {
    this.browseSelectionController.selectItem(rowIndex, itemIndex);
  }

  /**
   * @brief Release mode listeners owned by this surface-local controller
   */
  public destroy(): void {
    this.inputModeListeners.clear();
  }

  /**
   * @brief Commit a mode transition only when the mode actually changes
   *
   * @param inputMode - Candidate next browse input mode
   */
  private transitionInputMode(inputMode: BrowseInputMode): void {
    if (this.inputMode === inputMode) {
      return;
    }

    this.inputMode = inputMode;

    for (const inputModeListener of this.inputModeListeners) {
      inputModeListener(this.inputMode);
    }
  }
}
