/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IVideoElement, VideoDisplayBounds } from "./IVideoElement";

/**
 * @brief Fullscreen background video presentation for the thin player
 *
 * Background playback should ignore fitted stage bounds and instead cover the
 * physical viewport exactly.
 */
export class BackgroundVideoElement implements IVideoElement {
  /**
   * @brief Create the shared video element used by the background surface
   *
   * @returns Fresh HTML video element
   */
  public createVideoElement(): HTMLVideoElement {
    return document.createElement("video");
  }

  /**
   * @brief Apply fullscreen background styling to the shared video element
   *
   * @param videoElement - Video element owned by the thin player
   */
  public configureVideoElement(videoElement: HTMLVideoElement): void {
    videoElement.style.position = "absolute";
    videoElement.style.objectFit = "cover";
    videoElement.style.pointerEvents = "none";
    videoElement.style.backgroundColor = "black";
    videoElement.style.zIndex = "0";
  }

  /**
   * @brief Force true fullscreen background coverage
   *
   * The fitted stage bounds are intentionally ignored here so the background
   * always remains full bleed.
   *
   * @param videoElement - Video element owned by the thin player
   * @param displayBounds - Forwarded stage bounds that are intentionally unused
   */
  public applyDisplayBounds(
    videoElement: HTMLVideoElement,
    displayBounds: VideoDisplayBounds | null,
  ): void {
    void displayBounds;

    videoElement.style.left = "0";
    videoElement.style.top = "0";
    videoElement.style.width = "100vw";
    videoElement.style.height = "100vh";
  }
}
