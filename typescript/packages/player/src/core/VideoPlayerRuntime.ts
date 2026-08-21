/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoDisplayBounds } from "../dom/IVideoElement";
import type { VideoPlayerLoadRequest } from "./VideoPlayerLoadRequest";

/**
 * @brief Runtime event raised by one underlying playback engine
 */
export type VideoPlayerRuntimeEvent =
  | {
      readonly type: "first-frame-ready";
    }
  | {
      readonly type: "playing";
    }
  | {
      readonly type: "paused";
    }
  | {
      readonly type: "error";
      readonly error: Error;
    };

/**
 * @brief Callback that receives underlying runtime lifecycle events
 */
export type VideoPlayerRuntimeListener = (
  event: VideoPlayerRuntimeEvent,
) => void;

/**
 * @brief Internal playback runtime contract beneath the shared VideoPlayer
 *
 * The shared player owns state transitions and public events. Each runtime
 * implementation owns the actual playback primitive and platform-specific
 * integration details.
 */
export interface VideoPlayerRuntime {
  /**
   * @brief Prepare the playback runtime for presentation
   */
  initialize(): void;

  /**
   * @brief Apply optional display bounds for the active surface
   *
   * @param displayBounds - Optional fitted stage bounds
   */
  setDisplayBounds(displayBounds: VideoDisplayBounds | null): void;

  /**
   * @brief Load one normalized source into the runtime
   *
   * @param source - Shared player load request
   *
   * @returns Promise that resolves after the source is prepared
   */
  load(source: VideoPlayerLoadRequest): Promise<void>;

  /**
   * @brief Start or resume playback
   *
   * @returns Promise that resolves after playback has been requested
   */
  play(): Promise<void>;

  /**
   * @brief Pause playback
   */
  pause(): void;

  /**
   * @brief Apply one mute state to the runtime primitive
   *
   * @param muted - Whether playback should remain muted
   */
  setMuted(muted: boolean): void;

  /**
   * @brief Apply one output volume to the runtime primitive
   *
   * @param volume - Target volume in the inclusive range [0, 1]
   */
  setVolume(volume: number): void;

  /**
   * @brief Tear down active runtime resources
   *
   * @returns Promise that resolves after teardown completes
   */
  destroy(): Promise<void>;

  /**
   * @brief Subscribe to runtime lifecycle events
   *
   * @param listener - Callback that receives runtime events
   *
   * @returns Cleanup callback that removes the listener
   */
  subscribe(listener: VideoPlayerRuntimeListener): () => void;
}
