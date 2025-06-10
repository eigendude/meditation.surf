/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import { debounce } from "../utils/debounce";
import LightningApp from "./LightningApp";
import videoPlayerState from "./VideoPlayerState";

/**
 * Milliseconds to wait before applying the final size after a resize
 */
const COOL_DOWN_MS: number = 100;

/**
 * Launch the LightningJS application sized to the current viewport
 */
function launchLightningApp(width: number, height: number): void {
  Blits.Launch(LightningApp, "app", {
    w: width,
    h: height,
  });
}

/**
 * Launch the app, replacing any existing canvas
 */
function startApp(width: number, height: number): void {
  const mount: HTMLElement = document.getElementById("app") as HTMLElement;
  const oldCanvas: HTMLCanvasElement | null = mount.querySelector("canvas");
  const previousApp: unknown | null = videoPlayerState.getAppInstance();

  // Clean up the old Lightning application to free its WebGL context before
  // launching a new one. This avoids accumulating WebGL contexts if the
  // destruction fails due to race conditions in the underlying Blits APIs.
  if (previousApp !== null) {
    const instance: any = previousApp as any;
    try {
      if (typeof instance.quit === "function") {
        // Prefer `quit()` because it handles renderer shutdown internally.
        instance.quit();
      } else if (typeof instance.destroy === "function") {
        // Fall back to the lower level destroy if no quit method exists.
        instance.destroy();
      }
    } catch (error: unknown) {
      console.warn("Failed to destroy previous Lightning app", error);
    } finally {
      // Remove reference so we do not attempt to destroy again.
      videoPlayerState.clearAppInstance();
    }

    if (oldCanvas !== null) {
      oldCanvas.remove();
    }
  }

  // Launch the new LightningJS canvas after the previous instance has been
  // destroyed. This prevents WebGL context leakage and the associated console
  // warnings.
  launchLightningApp(width, height);
}

/**
 * Start the app and watch for window size changes
 */
export function launchApp(): void {
  const debouncedStartApp: (...errArgs: Parameters<typeof startApp>) => void =
    debounce(startApp, COOL_DOWN_MS);

  window.addEventListener("resize", (): void => {
    debouncedStartApp(window.innerWidth, window.innerHeight);
  });

  startApp(window.innerWidth, window.innerHeight);
}
