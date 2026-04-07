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
import { LIGHTNING_APP_HEIGHT, LIGHTNING_APP_WIDTH } from "../ui/LightningApp";

type FittedStageBounds = {
  scale: number;
  width: number;
  height: number;
  left: number;
  top: number;
};

const getInitialFittedStageBounds = (): FittedStageBounds => {
  const viewportWidth: number = window.innerWidth;
  const viewportHeight: number = window.innerHeight;
  const widthScale: number = viewportWidth / LIGHTNING_APP_WIDTH;
  const heightScale: number = viewportHeight / LIGHTNING_APP_HEIGHT;
  const scale: number = Math.min(widthScale, heightScale);
  const width: number = LIGHTNING_APP_WIDTH * scale;
  const height: number = LIGHTNING_APP_HEIGHT * scale;
  const left: number = (viewportWidth - width) / 2;
  const top: number = (viewportHeight - height) / 2;

  return {
    scale,
    width,
    height,
    left,
    top,
  };
};

/**
 * Launch the app once at a fixed TV resolution and position its canvas.
 */
function startApp(): void {
  const mount: HTMLElement = document.getElementById("app") as HTMLElement;
  const fittedStageBounds: FittedStageBounds = getInitialFittedStageBounds();

  mount.style.position = "relative";
  Blits.Launch(LightningApp, mount, {
    w: LIGHTNING_APP_WIDTH,
    h: LIGHTNING_APP_HEIGHT,
  });

  const positionCanvas = (): void => {
    const canvas: HTMLCanvasElement | null = mount.querySelector("canvas");
    if (canvas !== null) {
      canvas.style.position = "absolute";
      canvas.style.top = `${fittedStageBounds.top}px`;
      canvas.style.left = `${fittedStageBounds.left}px`;
      canvas.style.width = `${fittedStageBounds.width}px`;
      canvas.style.height = `${fittedStageBounds.height}px`;
      canvas.style.zIndex = "1";
    }

    videoPlayerState.setDisplayBounds(
      fittedStageBounds.left,
      fittedStageBounds.top,
      fittedStageBounds.width,
      fittedStageBounds.height,
    );
  };
  window.setTimeout(positionCanvas, 0);
}

/**
 * Start the app once using the fixed TV layout.
 */
export function launchApp(): void {
  startApp();
}
