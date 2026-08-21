/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { BrowseInputIntent } from "@meditation-surf/browse";
import { BrowseInteractionController } from "@meditation-surf/browse";
import { Platform } from "react-native";

/**
 * @brief Pressable handlers used by Expo browse items
 */
export interface ExpoBrowseItemInputHandlers {
  readonly onHoverIn: () => void;
  readonly onPress: () => void;
  readonly onPressIn: () => void;
}

/**
 * @brief Prepared browse input bindings consumed by the Expo screen runtime
 */
export interface ExpoBrowseInputBindings {
  readonly getItemInputHandlers: (
    rowIndex: number,
    itemIndex: number,
  ) => ExpoBrowseItemInputHandlers;
  readonly rootInputProps: ExpoBrowseRootInputProps;
}

/**
 * @brief Focus-capable root props used by the Expo app shell on web
 */
export interface ExpoBrowseRootInputProps {
  readonly focusable?: boolean;
  readonly tabIndex?: -1 | 0;
}

/**
 * @brief Small focus handle implemented by the Expo root view on web
 */
export interface ExpoFocusableElement {
  focus?: () => void;
}

/**
 * @brief Translate Expo press and hover input into shared browse commands
 */
export class ExpoBrowseInputAdapter {
  private readonly browseInteractionController: BrowseInteractionController;
  private readonly handleWindowKeyDown: (event: KeyboardEvent) => void;

  /**
   * @brief Create the Expo browse input adapter
   *
   * @param browseInteractionController - Shared browse interaction semantics
   */
  public constructor(browseInteractionController: BrowseInteractionController) {
    this.browseInteractionController = browseInteractionController;
    this.handleWindowKeyDown = (event: KeyboardEvent): void => {
      this.handleDirectionalKeyboardInput(event);
    };
  }

  /**
   * @brief Attach directional keyboard input when the Expo app runs on web
   *
   * @returns Cleanup callback that removes the registered listener
   */
  public attachDirectionalKeyboardInput(): () => void {
    if (!this.supportsWebKeyboardInput()) {
      return (): void => {};
    }

    window.addEventListener("keydown", this.handleWindowKeyDown);

    return (): void => {
      window.removeEventListener("keydown", this.handleWindowKeyDown);
    };
  }

  /**
   * @brief Build the handlers consumed by one browse thumbnail
   *
   * @param rowIndex - Row containing the interactive thumbnail
   * @param itemIndex - Item position inside that row
   *
   * @returns Stable semantics for hover and touch-driven focus
   */
  public createBrowseItemInputHandlers(
    rowIndex: number,
    itemIndex: number,
  ): ExpoBrowseItemInputHandlers {
    const pointerFocusIntents: readonly BrowseInputIntent[] =
      this.createPointerFocusIntents(rowIndex, itemIndex);

    return {
      onHoverIn: (): void => {
        this.browseInteractionController.dispatchIntents(pointerFocusIntents);
      },
      onPress: (): void => {
        this.browseInteractionController.dispatchIntents([
          { type: "enterPointerMode" },
          { itemIndex, rowIndex, type: "activateItem" },
        ]);
      },
      onPressIn: (): void => {
        this.browseInteractionController.dispatchIntents(pointerFocusIntents);
      },
    };
  }

  /**
   * @brief Build the screen-level browse input bindings consumed by Expo views
   *
   * @returns Prepared root and item bindings for the Expo browse surface
   */
  public createBrowseInputBindings(): ExpoBrowseInputBindings {
    return {
      getItemInputHandlers: (
        rowIndex: number,
        itemIndex: number,
      ): ExpoBrowseItemInputHandlers => {
        return this.createBrowseItemInputHandlers(rowIndex, itemIndex);
      },
      rootInputProps: this.getRootInputProps(),
    };
  }

  /**
   * @brief Return the minimal root props needed for Expo web keyboard capture
   *
   * @returns Focus props for the root Expo view on web
   */
  public getRootInputProps(): ExpoBrowseRootInputProps {
    if (!this.supportsWebKeyboardInput()) {
      return {};
    }

    return {
      focusable: true,
      tabIndex: 0,
    };
  }

  /**
   * @brief Focus the Expo root surface so web development accepts arrow keys
   *
   * @param focusableElement - Root element exposed by the screen component
   */
  public focusKeyboardRoot(
    focusableElement: ExpoFocusableElement | null,
  ): void {
    if (!this.supportsWebKeyboardInput()) {
      return;
    }

    focusableElement?.focus?.();
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
   * @brief Build the shared pointer-mode and focus intents for one browse item
   *
   * @param rowIndex - Row containing the interactive thumbnail
   * @param itemIndex - Item position inside that row
   *
   * @returns Ordered abstract intents for one pointer or touch interaction
   */
  private createPointerFocusIntents(
    rowIndex: number,
    itemIndex: number,
  ): readonly BrowseInputIntent[] {
    return [
      { type: "enterPointerMode" },
      {
        itemIndex,
        rowIndex,
        type: "focusItem",
      },
    ];
  }

  /**
   * @brief Return whether the current Expo runtime can listen for web keys
   *
   * @returns `true` when the runtime exposes browser keyboard events
   */
  private supportsWebKeyboardInput(): boolean {
    return Platform.OS === "web" && typeof window !== "undefined";
  }
}
