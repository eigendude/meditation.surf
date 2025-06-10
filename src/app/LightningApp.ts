/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import Icon from "../components/Icon";
import videoPlayerState, { VideoPlayerState } from "./VideoPlayerState";

// Type alias for the factory returned by Blits.Application
type LightningAppFactory = ReturnType<typeof Blits.Application>;

// Minimal LightningJS app displaying a full-screen icon
const LightningApp: LightningAppFactory = Blits.Application({
  // Track viewport dimensions for the root stage
  state() {
    return {
      stageW: window.innerWidth as number, // viewport width
      stageH: window.innerHeight as number, // viewport height
    };
  },

  // Log VideoPlayer events for debugging
  methods: {
    $videoPlayerEvent(
      eventName: string,
      details: { videoElement: HTMLVideoElement; event: Event },
      currentTime: number,
    ): void {
      console.debug(
        `VideoPlayer event: ${eventName} at ${currentTime.toFixed(2)}s`,
        details,
      );
    },
  },

  // Register child components available in the template
  components: {
    Icon,
  },

  // No computed properties for the stage itself

  hooks: {
    /**
     * Setup the window resize handler so the app continues to
     * cover the viewport when the browser size changes.
     */
    init(): void {
      const self: any = this;
      const listener: () => void = (): void => {
        self.stageW = window.innerWidth;
        self.stageH = window.innerHeight;
      };
      self.resizeListener = listener;
      window.addEventListener("resize", listener);
      // Share the app instance with the VideoPlayer plugin
      videoPlayerState.setAppInstance(self);
      // Initialize the video player once the application instance is ready
      videoPlayerState.initialize(self.stageW as number, self.stageH as number);
      // Play the demo video on page load using the new public API
      videoPlayerState.playUrl(VideoPlayerState.DEMO_URL);

      // Unmute the video player after the first user interaction
      const unmute: () => void = (): void => {
        videoPlayerState.unmute();
      };
      window.addEventListener("click", unmute, { once: true });
    },

    /**
     * Clean up the resize listener when the component is destroyed.
     */
    destroy(): void {
      const self: any = this;
      if (self.resizeListener) {
        window.removeEventListener("resize", self.resizeListener as () => void);
      }
    },
  },

  // Render the icon component centered on a black canvas
  template: `<Element :w="$stageW" :h="$stageH">
    <Icon :stageW="$stageW" :stageH="$stageH" />
  </Element>`,
});

export default LightningApp;
