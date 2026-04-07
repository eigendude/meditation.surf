/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

// Type alias for the factory returned by Blits.Component
type IconFactory = ReturnType<typeof Blits.Component>;

/**
 * A reusable component that displays the app icon centered on the stage.
 * The icon is rendered at most one third the size of the smaller viewport
 * dimension to keep it unobtrusive while maintaining its aspect ratio.
 */
const Icon: IconFactory = Blits.Component("Icon", {
  // Stage dimensions passed from the parent component
  props: ["stageW", "stageH"],

  computed: {
    /**
     * Size of the square icon in pixels.
     * The smallest stage dimension is divided by two so the icon does not
     * exceed half of the available space while maintaining its aspect ratio.
     */
    iconSize(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageW: number = this.stageW as number;
      const stageH: number = this.stageH as number;
      return Math.min(stageW, stageH) / 2;
    },
  },

  // Render the icon centered at half mount
  template: `<Element
      src="assets/icon-1500x1500.png"
      :w="$iconSize"
      :h="$iconSize"
      :x="$stageW / 2"
      :y="$stageH / 2"
      :mount="0.5"
    />`,
});

export default Icon;
