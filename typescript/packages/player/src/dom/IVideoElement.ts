/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Display bounds forwarded by app-managed video surfaces
 */
export type VideoDisplayBounds = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/**
 * @brief Browser runtime video-surface adapter for the shared player
 *
 * The shared `VideoPlayer` now abstracts over multiple underlying runtimes.
 * This adapter remains the browser and TV surface contract beneath the
 * browser-specific runtime implementation.
 */
export interface IVideoElement {
  /**
   * @brief Create the raw video element used by the thin player
   *
   * @returns Newly created video element
   */
  createVideoElement(): HTMLVideoElement;

  /**
   * @brief Apply one-time presentation configuration to the video element
   *
   * @param videoElement - Video element owned by the thin player
   */
  configureVideoElement(videoElement: HTMLVideoElement): void;

  /**
   * @brief Apply the active presentation bounds for the current runtime
   *
   * @param videoElement - Video element owned by the thin player
   * @param displayBounds - Optional fitted stage bounds from the app surface
   */
  applyDisplayBounds(
    videoElement: HTMLVideoElement,
    displayBounds: VideoDisplayBounds | null,
  ): void;
}
