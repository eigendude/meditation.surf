/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PlaybackSource } from "../domain/PlaybackSource";

/**
 * @brief Shared playback controller contract implemented separately per platform
 *
 * The contract stays intentionally small so each app can keep its own player.
 */
export interface IPlaybackController {
  /**
   * @brief Initialize the playback controller
   *
   * This prepares platform-specific resources before media is loaded.
   *
   * @returns A promise when initialization is asynchronous, or no value when setup completes immediately
   */
  initialize(): Promise<void> | void;

  /**
   * @brief Load a playback source
   *
   * This replaces the currently prepared media with the provided source.
   *
   * @param source - Source metadata to prepare for playback
   * @returns A promise that resolves after the source is ready for playback
   */
  load(source: PlaybackSource): Promise<void>;

  /**
   * @brief Start playback
   *
   * This begins or resumes playback of the currently loaded source.
   *
   * @returns A promise when playback start is asynchronous, or no value when playback starts immediately
   */
  play(): Promise<void> | void;

  /**
   * @brief Pause playback
   *
   * This stops active playback without unloading the current source.
   */
  pause(): void;

  /**
   * @brief Set the muted state
   *
   * This enables or disables audio output without changing the saved volume.
   *
   * @param muted - Whether audio output should be muted
   */
  setMuted(muted: boolean): void;

  /**
   * @brief Set the playback volume
   *
   * This updates the output volume for the currently active player.
   *
   * @param volume - Volume level to apply to the active player
   */
  setVolume(volume: number): void;

  /**
   * @brief Destroy the playback controller
   *
   * This releases platform-specific resources owned by the controller.
   *
   * @returns A promise when teardown is asynchronous, or no value when cleanup completes immediately
   */
  destroy(): Promise<void> | void;
}
