/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IVideoElement, VideoDisplayBounds } from "./IVideoElement";

type VideoElementControllerHandlers = {
  readonly onPlaying: () => void;
  readonly onPaused: () => void;
  readonly onError: (error: Error) => void;
};

/**
 * @brief Own the shared video element and its DOM-specific lifecycle details
 */
export class VideoElementController {
  private readonly videoElementAdapter: IVideoElement;
  private readonly handlers: VideoElementControllerHandlers;
  private readonly videoElement: HTMLVideoElement;

  /**
   * @brief Build one controller around the runtime video element adapter
   *
   * @param videoElementAdapter - Runtime-specific video element adapter
   * @param handlers - Lifecycle callbacks forwarded to the player
   */
  public constructor(
    videoElementAdapter: IVideoElement,
    handlers: VideoElementControllerHandlers,
  ) {
    const videoElement: HTMLVideoElement =
      videoElementAdapter.createVideoElement();

    this.videoElementAdapter = videoElementAdapter;
    this.handlers = handlers;
    this.configureVideoElement(videoElement);
    document.body.appendChild(videoElement);
    this.videoElement = videoElement;
  }

  /**
   * @brief Return the shared video element
   *
   * @returns Shared video element
   */
  public getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  /**
   * @brief Apply one display-bounds update to the shared element when present
   *
   * @param displayBounds - Optional fitted stage bounds
   */
  public applyDisplayBounds(displayBounds: VideoDisplayBounds | null): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    this.videoElementAdapter.applyDisplayBounds(videoElement, displayBounds);
  }

  /**
   * @brief Make the shared video element visible
   */
  public show(): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    videoElement.style.display = "block";
  }

  /**
   * @brief Hide the shared video element when present
   */
  public hide(): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    videoElement.style.display = "none";
  }

  /**
   * @brief Clear the current source before a new load
   */
  public reset(): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
  }

  /**
   * @brief Apply one mute state directly to the underlying element
   *
   * @param muted - Whether the video element should remain muted
   */
  public setMuted(muted: boolean): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    videoElement.muted = muted;

    if (muted) {
      videoElement.setAttribute("muted", "");

      return;
    }

    videoElement.removeAttribute("muted");
  }

  /**
   * @brief Apply one output volume to the underlying element
   *
   * @param volume - Target volume in the inclusive range [0, 1]
   */
  public setVolume(volume: number): void {
    const videoElement: HTMLVideoElement = this.videoElement;

    videoElement.volume = volume;
  }

  /**
   * @brief Configure the video element once when created
   *
   * @param videoElement - Video element to configure
   */
  private configureVideoElement(videoElement: HTMLVideoElement): void {
    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.preload = "auto";
    videoElement.crossOrigin = "anonymous";
    videoElement.disablePictureInPicture = true;
    videoElement.setAttribute("autoplay", "");
    videoElement.setAttribute("playsinline", "");
    this.videoElementAdapter.configureVideoElement(videoElement);

    videoElement.addEventListener("playing", (): void => {
      this.handlers.onPlaying();
    });
    videoElement.addEventListener("pause", (): void => {
      this.handlers.onPaused();
    });
    videoElement.addEventListener("error", (): void => {
      const mediaError: MediaError | null = videoElement.error;
      const errorMessage: string =
        mediaError === null
          ? "The video element reported an unknown error."
          : `The video element reported code ${mediaError.code}.`;

      this.handlers.onError(new Error(errorMessage));
    });
  }
}
