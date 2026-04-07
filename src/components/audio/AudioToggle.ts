/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import AudioState from "../../app/state/AudioState";
import videoPlayerState from "../../app/state/VideoPlayerState";

// Type alias for the factory returned by Blits.Component
type AudioToggleFactory = ReturnType<typeof Blits.Component>;

/**
 * Overlay button that toggles the player's audio mute state.
 * The icon is anchored to the bottom-right corner of the stage.
 */
const AudioToggle: AudioToggleFactory = Blits.Component("AudioToggle", {
  // Stage dimensions passed from the parent component
  props: ["stageW", "stageH"],

  // Maintain local mute state in sync with AudioState
  state(): { muted: boolean } {
    return {
      muted: AudioState.isMuted() as boolean,
    };
  },

  methods: {
    /** Toggle the mute state and apply it to the video player. */
    toggle(): void {
      // @ts-ignore `this` contains the reactive state provided at runtime
      const current: boolean = this.muted as boolean;
      const newMuted: boolean = !current;
      videoPlayerState.setMuted(newMuted);
      AudioState.setMuted(newMuted);
      // @ts-ignore update the reactive state
      this.muted = newMuted;
    },
  },

  computed: {
    /**
     * Path to the icon image based on the mute state.
     * The images are preloaded from the public assets folder.
     */
    iconSrc(): string {
      // @ts-ignore `this` contains the reactive state provided at runtime
      const muted: boolean = this.muted as boolean;
      return muted ? "assets/audio-off.svg" : "assets/audio-on.svg";
    },

    /** Width of the icon occupying a third of the viewport width. */
    iconW(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageW: number = this.stageW as number;
      return stageW / 3;
    },

    /** Height of the icon occupying a third of the viewport height. */
    iconH(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageH: number = this.stageH as number;
      return stageH / 3;
    },

    /** X coordinate of the icon anchored to the bottom-right. */
    iconX(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageW: number = this.stageW as number;
      return stageW;
    },

    /** Y coordinate of the icon anchored to the bottom-right. */
    iconY(): number {
      // @ts-ignore `this` contains the reactive props provided at runtime
      const stageH: number = this.stageH as number;
      return stageH;
    },
  },

  template: `<Element
      :src="$iconSrc"
      :w="$iconW" :h="$iconH"
      :x="$iconX" :y="$iconY"
      :zIndex="2"
      :mount="1"
      @click="toggle"
    />`,
});

export default AudioToggle;
