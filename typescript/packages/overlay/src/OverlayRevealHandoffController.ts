/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  PlaybackVisualReadinessController,
  PlaybackVisualReadinessState,
} from "@meditation-surf/player-core";

import type { OverlayController } from "./OverlayController";

/**
 * @brief Coordinate the startup handoff from loading presentation to overlay UI
 *
 * The loading plane still reacts directly to playback visual readiness, while
 * the overlay UI plane keeps its own visibility state in the overlay
 * controller. This helper connects those two concerns with one explicit
 * timeout: once playback is visually ready, wait for the loading fade-out
 * duration to finish before revealing the overlay UI.
 */
export class OverlayRevealHandoffController {
  private readonly overlayController: OverlayController;
  private readonly playbackVisualReadinessController: PlaybackVisualReadinessController;
  private readonly revealDelayMs: number;
  private readonly removePlaybackVisualReadinessSubscription: () => void;

  private revealTimeoutId: ReturnType<typeof globalThis.setTimeout> | null;

  /**
   * @brief Build and start the shared loading-to-overlay handoff controller
   *
   * @param overlayController - Shared overlay visibility owner
   * @param playbackVisualReadinessController - Shared playback readiness owner
   */
  public constructor(
    overlayController: OverlayController,
    playbackVisualReadinessController: PlaybackVisualReadinessController,
  ) {
    this.overlayController = overlayController;
    this.playbackVisualReadinessController = playbackVisualReadinessController;
    this.revealDelayMs = this.overlayController.getConfig().fadeDurationMs;
    this.revealTimeoutId = null;
    this.removePlaybackVisualReadinessSubscription =
      this.playbackVisualReadinessController.subscribe(
        (playbackVisualReadinessState: PlaybackVisualReadinessState): void => {
          this.handlePlaybackVisualReadinessState(playbackVisualReadinessState);
        },
      );
  }

  /**
   * @brief Stop the shared handoff controller and cancel pending reveal work
   */
  public destroy(): void {
    this.clearRevealTimeout();
    this.removePlaybackVisualReadinessSubscription();
  }

  /**
   * @brief React to playback readiness changes with an explicit reveal handoff
   *
   * @param playbackVisualReadinessState - Current playback readiness snapshot
   */
  private handlePlaybackVisualReadinessState(
    playbackVisualReadinessState: PlaybackVisualReadinessState,
  ): void {
    if (playbackVisualReadinessState.readiness === "loading") {
      this.clearRevealTimeout();
      this.overlayController.dispatch("RESET");

      return;
    }

    this.scheduleOverlayReveal();
  }

  /**
   * @brief Wait for the loading fade-out to finish before showing the overlay
   */
  private scheduleOverlayReveal(): void {
    this.clearRevealTimeout();
    this.revealTimeoutId = globalThis.setTimeout((): void => {
      this.revealTimeoutId = null;
      this.overlayController.dispatch("SHOW");
    }, this.revealDelayMs);
  }

  /**
   * @brief Cancel any pending automatic overlay reveal timer
   */
  private clearRevealTimeout(): void {
    if (this.revealTimeoutId === null) {
      return;
    }

    globalThis.clearTimeout(this.revealTimeoutId);
    this.revealTimeoutId = null;
  }
}
