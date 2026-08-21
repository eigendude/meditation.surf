/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

type VideoFrameCallbackVideoElement = HTMLVideoElement & {
  requestVideoFrameCallback(callback: () => void): number;
};

/**
 * @brief Observe first-frame readiness across successive load attempts
 */
export class FirstFrameObserver {
  private activeObservationAbortController: AbortController | null;
  private activeObservationRevision: number;

  /**
   * @brief Initialize the observer without an active load
   */
  public constructor() {
    this.activeObservationAbortController = null;
    this.activeObservationRevision = 0;
  }

  /**
   * @brief Prepare observation state for one new load request
   */
  public prepareForNextLoad(): void {
    this.activeObservationRevision += 1;
    this.activeObservationAbortController?.abort();
    this.activeObservationAbortController = new AbortController();
  }

  /**
   * @brief Cancel any currently armed observation callbacks
   */
  public clear(): void {
    this.activeObservationRevision += 1;
    this.activeObservationAbortController?.abort();
    this.activeObservationAbortController = null;
  }

  /**
   * @brief Observe the first reliably rendered frame for the active load
   *
   * @param videoElement - Video element used for the active load
   * @param onFirstFrameReady - Callback raised when the first frame is ready
   */
  public observe(
    videoElement: HTMLVideoElement,
    onFirstFrameReady: () => void,
  ): void {
    const activeObservationAbortController: AbortController | null =
      this.activeObservationAbortController;
    const activeObservationRevision: number = this.activeObservationRevision;

    if (activeObservationAbortController === null) {
      return;
    }

    videoElement.addEventListener(
      "loadeddata",
      (): void => {
        if (activeObservationRevision !== this.activeObservationRevision) {
          return;
        }

        if ("requestVideoFrameCallback" in videoElement) {
          (
            videoElement as VideoFrameCallbackVideoElement
          ).requestVideoFrameCallback((): void => {
            if (activeObservationRevision !== this.activeObservationRevision) {
              return;
            }

            onFirstFrameReady();
          });

          return;
        }

        onFirstFrameReady();
      },
      {
        once: true,
        signal: activeObservationAbortController.signal,
      },
    );
  }
}
