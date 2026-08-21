/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared semantic readiness states for background video presentation
 */
export type PlaybackVisualReadiness = "loading" | "visualReady";

/**
 * @brief Snapshot describing whether the background video is visually ready
 */
export type PlaybackVisualReadinessState = {
  readiness: PlaybackVisualReadiness;
};

/**
 * @brief Shared subscriber signature for visual readiness updates
 */
export type PlaybackVisualReadinessListener = (
  state: PlaybackVisualReadinessState,
) => void;

/**
 * @brief Own the shared loading-versus-visual-ready playback semantics
 *
 * The product needs loading presentation to follow real media readiness, not
 * generic UI timing. This controller keeps that intent close to playback while
 * remaining small enough for each app surface to adapt locally.
 */
export class PlaybackVisualReadinessController {
  private readonly stateListeners: Set<PlaybackVisualReadinessListener>;
  private state: PlaybackVisualReadinessState;

  /**
   * @brief Create the readiness controller in its startup loading state
   */
  public constructor() {
    this.stateListeners = new Set<PlaybackVisualReadinessListener>();
    this.state = {
      readiness: "loading",
    };
  }

  /**
   * @brief Return the current readiness snapshot
   *
   * @returns Current visual readiness state
   */
  public getState(): PlaybackVisualReadinessState {
    return this.state;
  }

  /**
   * @brief Return whether loading presentation should still be visible
   *
   * @returns `true` while the first video frame has not been rendered yet
   */
  public shouldShowLoadingIndicator(): boolean {
    return this.state.readiness === "loading";
  }

  /**
   * @brief Subscribe to visual readiness updates
   *
   * @param listener - Callback notified whenever the readiness changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: PlaybackVisualReadinessListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);

    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * @brief Mark the playback experience as actively loading visual content
   */
  public beginLoading(): void {
    this.transitionTo({
      readiness: "loading",
    });
  }

  /**
   * @brief Mark the playback experience as visually ready after first render
   */
  public markVisualReady(): void {
    this.transitionTo({
      readiness: "visualReady",
    });
  }

  /**
   * @brief Remove all active subscribers owned by the controller
   */
  public destroy(): void {
    this.stateListeners.clear();
  }

  /**
   * @brief Commit a new readiness state only when it actually changes
   *
   * @param nextState - Candidate readiness snapshot
   */
  private transitionTo(nextState: PlaybackVisualReadinessState): void {
    if (this.state.readiness === nextState.readiness) {
      return;
    }

    this.state = nextState;
    this.notifyStateListeners();
  }

  /**
   * @brief Notify every registered listener about the current readiness state
   */
  private notifyStateListeners(): void {
    for (const stateListener of this.stateListeners) {
      stateListener(this.state);
    }
  }
}
