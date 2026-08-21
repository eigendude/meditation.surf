/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared placement modes supported by the foreground UI model
 */
export type ForegroundUiElementPlacement = "center";

/**
 * @brief Shared layout size returned for foreground UI elements
 */
export type ForegroundUiElementSize = {
  width: number;
  height: number;
};

/**
 * @brief Runtime-agnostic base class for foreground UI elements
 *
 * Apps render these elements differently, but they can all consume a shared
 * object model that describes placement and sizing intent.
 */
export abstract class ForegroundUiElement {
  public readonly id: string;
  public readonly placement: ForegroundUiElementPlacement;

  /**
   * @brief Create a foreground UI element with a stable identity and placement
   *
   * @param id - Stable element identifier
   * @param placement - Shared placement mode
   */
  protected constructor(id: string, placement: ForegroundUiElementPlacement) {
    this.id = id;
    this.placement = placement;
  }

  /**
   * @brief Return the semantic element type used by runtime adapters
   *
   * @returns String key describing the element kind
   */
  public abstract getElementType(): string;

  /**
   * @brief Compute the element size for a viewport
   *
   * @param availableWidth - Viewport width available to the element
   * @param availableHeight - Viewport height available to the element
   *
   * @returns Shared width and height guidance for renderers
   */
  public abstract getLayoutSize(
    availableWidth: number,
    availableHeight: number,
  ): ForegroundUiElementSize;
}
