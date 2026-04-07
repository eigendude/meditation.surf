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
// Fixed design resolution for the TV-only Lightning experience.
export const LIGHTNING_APP_WIDTH: number = 1920;
export const LIGHTNING_APP_HEIGHT: number = 1080;

// Minimal LightningJS app displaying a full-screen icon
const LightningApp: LightningAppFactory = Blits.Application({
  // Keep the stage dimensions fixed for the TV-only experience.
  state(): { stageW: number; stageH: number } {
    return {
      stageW: LIGHTNING_APP_WIDTH,
      stageH: LIGHTNING_APP_HEIGHT,
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
     * The application is fully rendered and ready. Configure the video
     * player only after the stage is available so the plugin can find
     * the VideoTexture element correctly.
     */
    ready(): void {
      const self: any = this;
      videoPlayerState.setAppInstance(self);
      videoPlayerState.initialize(LIGHTNING_APP_WIDTH, LIGHTNING_APP_HEIGHT);
      videoPlayerState.playUrl(VideoPlayerState.DEMO_URL);
    },

    /** Clear the app instance reference when the component is destroyed. */
    destroy(): void {
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
