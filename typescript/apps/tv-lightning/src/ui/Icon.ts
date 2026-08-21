/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";
import { BRAND_ICON_URL } from "@meditation-surf/assets";

import { TvAppLayoutController } from "../layout/TvAppLayoutController";

/**
 * @brief Type alias for the factory returned by Blits.Component
 */
type IconFactory = ReturnType<typeof Blits.Component>;

/**
 * @brief Reusable component that displays the app icon centered on the stage
 *
 * The TV app layout controller owns how the shared overlay model is adapted
 * into fixed-stage Lightning sizing.
 *
 * @property {TvAppLayoutController} appLayoutController TV layout adapter
 * @property {number} alpha The current icon alpha owned by the parent state
 * @property {number} stageW The Lightning stage width in pixels
 * @property {number} stageH The Lightning stage height in pixels
 * @property {number} viewportW The browser viewport width in pixels
 * @property {number} viewportH The browser viewport height in pixels
 */
const Icon: IconFactory = Blits.Component("Icon", {
  // Stage coordinates stay fixed for centering, while viewport dimensions
  // drive the shared icon sizing policy to match web and mobile behavior.
  props: [
    "appLayoutController",
    "alpha",
    "fadeDurationMs",
    "stageW",
    "stageH",
    "viewportW",
    "viewportH",
  ],

  computed: {
    /**
     * @brief Resolve the rendered icon size in stage coordinates
     *
     * @returns {{ width: number; height: number }} The size to render within the stage
     */
    iconSize(): { width: number; height: number } {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const appLayoutController: TvAppLayoutController = this
        .appLayoutController as TvAppLayoutController;

      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageW: number = this.stageW as number;

      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageH: number = this.stageH as number;

      // @ts-ignore `this` contains the reactive props provided at runtime
      const viewportW: number = this.viewportW as number;

      // @ts-ignore `this` contains the reactive props provided at runtime
      const viewportH: number = this.viewportH as number;

      return appLayoutController.getStageCenteredOverlaySize(
        stageW,
        stageH,
        viewportW,
        viewportH,
      );
    },

    /**
     * @brief Computes the rendered icon width in stage coordinates
     *
     * @returns {number} The icon width to render within the Lightning stage
     */
    iconWidth(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      return (this.iconSize as { width: number; height: number }).width;
    },

    /**
     * @brief Computes the rendered icon height in stage coordinates
     *
     * @returns {number} The icon height to render within the Lightning stage
     */
    iconHeight(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      return (this.iconSize as { width: number; height: number }).height;
    },

    /**
     * @brief Resolves the shared icon asset URL for the TV app
     *
     * Ensures the TV app renders the same source image as the web surface.
     *
     * @returns {string} The resolved icon asset URL
     */
    iconSource(): string {
      return BRAND_ICON_URL;
    },
  },

  // Render the icon centered at half mount
  template: `<Element
      :src="$iconSource"
      :alpha.transition="{ value: $alpha, duration: $fadeDurationMs, easing: 'ease' }"
      :w="$iconWidth"
      :h="$iconHeight"
      :x="$stageW / 2"
      :y="$stageH / 2"
      fit="contain"
      :mount="0.5"
    />`,
});

export default Icon;
