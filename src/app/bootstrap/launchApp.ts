/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import videoPlayerState from "../state/VideoPlayerState";
import LightningApp from "../ui/LightningApp";

/**
 * Minimal renderer contract needed to resize the stage in place.
 */
type ResizableRenderer = {
  setOptions: (...errArgs: [{ appWidth: number; appHeight: number }]) => void;
};

/**
 * Resolve the active Blits renderer from the current app instance.
 */
function getRenderer(): ResizableRenderer | null {
  const appInstance: object | null = videoPlayerState.getAppInstance() as
    | object
    | null;
  if (appInstance === null) {
    return null;
  }

  const symbols: symbol[] = Object.getOwnPropertySymbols(appInstance);
  for (const symbolKey of symbols) {
    const propertyValue: unknown = (
      appInstance as Record<PropertyKey, unknown>
    )[symbolKey];
    if (typeof propertyValue !== "function") {
      continue;
    }

    const candidateRenderer: unknown = propertyValue();
    if (
      candidateRenderer !== null &&
      typeof candidateRenderer === "object" &&
      "setOptions" in candidateRenderer
    ) {
      return candidateRenderer as ResizableRenderer;
    }
  }

  return null;
}

/**
 * Launch the app once and position its canvas.
 */
function startApp(width: number, height: number): void {
  const mount: HTMLElement = document.getElementById("app") as HTMLElement;
  Blits.Launch(LightningApp, "app", { w: width, h: height });

  const positionCanvas = (): void => {
    const canvas: HTMLCanvasElement | null = mount.querySelector("canvas");
    if (canvas !== null) {
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1";
    }
  };
  window.setTimeout(positionCanvas, 0);
}

/**
 * Resize the existing renderer without rebuilding the app.
 */
function resizeApp(width: number, height: number): void {
  const activeRenderer: ResizableRenderer | null = getRenderer();
  activeRenderer?.setOptions({ appWidth: width, appHeight: height });
}

/**
 * Start the app once and keep its renderer sized to the viewport.
 */
export function launchApp(): void {
  window.addEventListener("resize", (): void => {
    resizeApp(window.innerWidth, window.innerHeight);
  });

  startApp(window.innerWidth, window.innerHeight);
}
