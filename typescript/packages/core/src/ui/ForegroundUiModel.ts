/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  CenteredOverlayLayout,
  type ForegroundLayerLayout,
} from "@meditation-surf/layout";

import { ForegroundUiElement } from "./ForegroundUiElement";

type ForegroundUiModelElement = ForegroundUiElement | CenteredOverlayLayout;

/**
 * @brief Runtime-agnostic collection of foreground UI elements
 */
export class ForegroundUiModel {
  private readonly elements: ForegroundUiModelElement[];

  /**
   * @brief Create a foreground UI model from a list of shared elements
   *
   * @param elements - Ordered foreground elements rendered above video
   */
  public constructor(elements: ForegroundUiModelElement[]) {
    this.elements = elements;
  }

  /**
   * @brief Return all foreground elements in render order
   *
   * @returns A shallow copy of the shared foreground element list
   */
  public getElements(): ForegroundUiModelElement[] {
    return [...this.elements];
  }

  /**
   * @brief Return the centered overlay when present
   *
   * @returns The first centered overlay, or `null` if one is absent
   */
  public getCenteredOverlay(): CenteredOverlayLayout | null {
    const centeredOverlay: ForegroundUiModelElement | undefined =
      this.elements.find(
        (element: ForegroundUiModelElement): boolean =>
          element instanceof CenteredOverlayLayout,
      );

    if (centeredOverlay instanceof CenteredOverlayLayout) {
      return centeredOverlay;
    }

    return null;
  }

  /**
   * @brief Build a foreground UI model from the shared foreground layer
   *
   * @param foregroundLayer - Shared foreground layer layout
   *
   * @returns Foreground UI wrapper for shared consumers
   */
  public static fromForegroundLayer(
    foregroundLayer: ForegroundLayerLayout,
  ): ForegroundUiModel {
    const centeredOverlay: CenteredOverlayLayout | null =
      foregroundLayer.getCenteredOverlay();

    return new ForegroundUiModel(
      centeredOverlay === null ? [] : [centeredOverlay],
    );
  }
}
