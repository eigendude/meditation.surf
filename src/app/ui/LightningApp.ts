/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import AudioToggle from "../../components/audio/AudioToggle";
import Icon from "../../components/common/Icon";
import videoPlayerState, { VideoPlayerState } from "../state/VideoPlayerState";

// Type alias for the factory returned by Blits.Application
type LightningAppFactory = ReturnType<typeof Blits.Application>;

// Minimal LightningJS app displaying a full-screen icon
const LightningApp: LightningAppFactory = Blits.Application({
  // Track viewport dimensions for the root stage
  state(): { stageW: number; stageH: number } {
    return {
      stageW: window.innerWidth as number, // viewport width
      stageH: window.innerHeight as number, // viewport height
    };
  },

  // No custom methods for the stage itself

  // Register child components available in the template
  components: {
    Icon,
    AudioToggle,
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
    },

    /**
     * The application is fully rendered and ready. Configure the video
     * player only after the stage is available so the plugin can find
     * the VideoTexture element correctly.
     */
    ready(): void {
      const self: any = this;
      videoPlayerState.setAppInstance(self);
      videoPlayerState.initialize(self.stageW as number, self.stageH as number);
      videoPlayerState.playUrl(VideoPlayerState.DEMO_URL);
    },

    /**
     * Clean up the resize listener when the component is destroyed.
     */
    destroy(): void {
      const self: any = this;
      if (self.resizeListener) {
        window.removeEventListener("resize", self.resizeListener as () => void);
      }
      videoPlayerState.clearAppInstance();
    },
  },

  // Render the icon component centered on a black canvas
  template: `<Element :w="$stageW" :h="$stageH">
    <Icon :stageW="$stageW" :stageH="$stageH" />
    <AudioToggle :stageW="$stageW" :stageH="$stageH" />
  </Element>`,
});

export default LightningApp;
