/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Immutable timed-focus snapshot used by the shared media bridge
 */
export type FocusDelayState = {
  focusedItemId: string | null;
  focusStartedAtMs: number | null;
  hasDelayElapsed: boolean;
  delayThresholdMs: number;
};

/**
 * @brief Listener signature used by the timed-focus controller
 */
export type FocusDelayStateListener = (state: FocusDelayState) => void;

/**
 * @brief Track whether browse focus has remained stable long enough to escalate
 *
 * Focus changes become warm candidates immediately, and a stable focus emits a
 * second state transition once the configured threshold has elapsed.
 */
export class FocusDelayController {
  public static readonly DEFAULT_DELAY_THRESHOLD_MS: number = 1000;

  private readonly delayThresholdMs: number;
  private readonly stateListeners: Set<FocusDelayStateListener>;
  private readonly now: () => number;

  private state: FocusDelayState;
  private timerId: ReturnType<typeof globalThis.setTimeout> | null;

  /**
   * @brief Create the timed-focus controller
   *
   * @param delayThresholdMs - Delay required before focus escalation occurs
   * @param now - Clock function used by the controller
   */
  public constructor(
    delayThresholdMs: number = FocusDelayController.DEFAULT_DELAY_THRESHOLD_MS,
    now: (() => number) | null = null,
  ) {
    this.delayThresholdMs = delayThresholdMs;
    this.stateListeners = new Set<FocusDelayStateListener>();
    this.now = now ?? (() => Date.now());
    this.state = {
      focusedItemId: null,
      focusStartedAtMs: null,
      hasDelayElapsed: false,
      delayThresholdMs: this.delayThresholdMs,
    };
    this.timerId = null;
  }

  /**
   * @brief Return the current timed-focus snapshot
   *
   * @returns Current timed-focus state
   */
  public getState(): FocusDelayState {
    return {
      focusedItemId: this.state.focusedItemId,
      focusStartedAtMs: this.state.focusStartedAtMs,
      hasDelayElapsed: this.state.hasDelayElapsed,
      delayThresholdMs: this.state.delayThresholdMs,
    };
  }

  /**
   * @brief Subscribe to timed-focus transitions
   *
   * @param listener - Callback notified whenever timed-focus state changes
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: FocusDelayStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());

    return (): void => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * @brief Replace the currently focused item tracked by the timer
   *
   * @param focusedItemId - Focused item identifier, or `null` when focus cleared
   */
  public setFocusedItemId(focusedItemId: string | null): void {
    if (this.state.focusedItemId === focusedItemId) {
      return;
    }

    this.clearTimer();

    if (focusedItemId === null) {
      this.state = {
        focusedItemId: null,
        focusStartedAtMs: null,
        hasDelayElapsed: false,
        delayThresholdMs: this.delayThresholdMs,
      };
      this.notifyStateListeners();

      return;
    }

    this.state = {
      focusedItemId,
      focusStartedAtMs: this.now(),
      hasDelayElapsed: false,
      delayThresholdMs: this.delayThresholdMs,
    };
    this.timerId = globalThis.setTimeout((): void => {
      this.timerId = null;
      this.markDelayElapsed();
    }, this.delayThresholdMs);
    this.notifyStateListeners();
  }

  /**
   * @brief Release subscriptions and pending timers
   */
  public destroy(): void {
    this.clearTimer();
    this.stateListeners.clear();
  }

  /**
   * @brief Mark the current focus item as having satisfied the delay threshold
   */
  private markDelayElapsed(): void {
    if (this.state.focusedItemId === null || this.state.hasDelayElapsed) {
      return;
    }

    this.state = {
      ...this.state,
      hasDelayElapsed: true,
    };
    this.notifyStateListeners();
  }

  /**
   * @brief Cancel the pending delay timer when focus changes
   */
  private clearTimer(): void {
    if (this.timerId === null) {
      return;
    }

    globalThis.clearTimeout(this.timerId);
    this.timerId = null;
  }

  /**
   * @brief Notify every listener about the latest timed-focus state
   */
  private notifyStateListeners(): void {
    const focusDelayState: FocusDelayState = this.getState();

    for (const stateListener of this.stateListeners) {
      stateListener(focusDelayState);
    }
  }
}
