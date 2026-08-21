/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared semantic visibility for the centered overlay
 */
export type OverlayVisibility = "visible" | "hidden";

/**
 * @brief Shared overlay event names routed from app-specific input handling
 */
export type OverlayEventType = "INTERACT" | "SHOW" | "HIDE" | "RESET";

/**
 * @brief Shared overlay configuration consumed by each app surface
 */
export type OverlayConfig = {
  fadeDurationMs: number;
};

/**
 * @brief Snapshot of the shared overlay interaction state
 */
export type OverlayState = {
  visibility: OverlayVisibility;
};

/**
 * @brief Shared subscriber signature for overlay state updates
 */
export type OverlayStateListener = (state: OverlayState) => void;

/**
 * @brief Own the shared centered-overlay interaction model
 *
 * Apps dispatch semantic interaction events into this controller, then render
 * and animate the resulting state in a runtime-specific way. That keeps the
 * shared UI activation intent consistent without mixing it into playback
 * loading semantics.
 */
export class OverlayController {
  private static readonly DEFAULT_CONFIG: OverlayConfig = {
    fadeDurationMs: 350,
  };

  private readonly config: OverlayConfig;
  private readonly stateListeners: Set<OverlayStateListener>;

  private state: OverlayState;

  /**
   * @brief Build the shared overlay controller
   *
   * @param config - Optional runtime-independent timing overrides
   */
  public constructor(config?: Partial<OverlayConfig>) {
    this.config = {
      ...OverlayController.DEFAULT_CONFIG,
      ...config,
    };
    this.stateListeners = new Set<OverlayStateListener>();
    this.state = {
      visibility: "hidden",
    };
  }

  /**
   * @brief Return the shared overlay timing configuration
   *
   * @returns Shared overlay timing configuration
   */
  public getConfig(): OverlayConfig {
    return this.config;
  }

  /**
   * @brief Return the current shared overlay interaction state
   *
   * @returns Current semantic overlay state snapshot
   */
  public getState(): OverlayState {
    return this.state;
  }

  /**
   * @brief Subscribe to shared overlay state updates
   *
   * The listener is called immediately so each app surface can align its local
   * renderer with the shared semantic state on startup.
   *
   * @param listener - Callback notified whenever the state changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: OverlayStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);

    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * @brief Dispatch a semantic overlay event
   *
   * @param eventType - Shared interaction event type
   */
  public dispatch(eventType: OverlayEventType): void {
    if (eventType === "INTERACT" || eventType === "SHOW") {
      this.transitionTo({
        visibility: "visible",
      });
      return;
    }

    if (eventType === "HIDE") {
      this.transitionTo({
        visibility: "hidden",
      });
      return;
    }

    this.transitionTo({
      visibility: "hidden",
    });
  }

  /**
   * @brief Cancel any pending timeout work owned by the controller
   */
  public destroy(): void {
    this.stateListeners.clear();
  }

  /**
   * @brief Commit a new state and notify subscribers only when it changes
   *
   * @param nextState - New shared overlay state
   */
  private transitionTo(nextState: OverlayState): void {
    if (this.state.visibility === nextState.visibility) {
      return;
    }

    this.state = nextState;
    this.notifyStateListeners();
  }

  /**
   * @brief Notify every registered listener about the current state
   */
  private notifyStateListeners(): void {
    for (const stateListener of this.stateListeners) {
      stateListener(this.state);
    }
  }
}
