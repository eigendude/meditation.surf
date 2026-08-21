/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  AudioPreferences,
  BrowserAudioPreferencesStorage,
  type IAudioPreferencesStorage,
} from "@meditation-surf/core";

/**
 * @brief Persisted audio configuration for the video player
 *
 * The mute preference and volume are stored in local storage so they survive page
 * reloads and Lightning restarts.
 */
export class Audio {
  // Shared storage implementation used by the TV app
  private static readonly storage: IAudioPreferencesStorage =
    new BrowserAudioPreferencesStorage();

  /**
   * @brief Retrieve the persisted mute flag
   *
   * @returns `true` when audio should be muted
   */
  public static isMuted(): boolean {
    const audioPreferences: AudioPreferences = Audio.storage.load();

    return audioPreferences.muted;
  }

  /**
   * @brief Retrieve the persisted volume level
   *
   * @returns Volume level clamped to [0, 1]
   */
  public static getVolume(): number {
    const audioPreferences: AudioPreferences = Audio.storage.load();

    return audioPreferences.volume;
  }

  /**
   * @brief Persist the mute flag
   *
   * @param muted - Whether audio should be muted
   */
  public static setMuted(muted: boolean): void {
    const audioPreferences: AudioPreferences = Audio.storage.load();

    Audio.storage.save(audioPreferences.withMuted(muted));
  }

  /**
   * @brief Persist the volume level
   *
   * @param volume - Volume value in [0, 1]
   */
  public static setVolume(volume: number): void {
    const audioPreferences: AudioPreferences = Audio.storage.load();

    Audio.storage.save(audioPreferences.withVolume(volume));
  }
}

export default Audio;
