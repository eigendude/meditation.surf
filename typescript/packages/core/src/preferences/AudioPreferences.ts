/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Constructor data accepted by the audio preference value object
 */
export type AudioPreferencesInit = {
  muted?: boolean;
  volume?: number;
};

/**
 * @brief Persisted audio preferences shared by runtime-specific apps
 *
 * This value object keeps normalization logic close to the domain data so
 * apps can update audio state through small intentful methods instead of free
 * helper functions.
 */
export class AudioPreferences {
  private static readonly DEFAULT_MUTED: boolean = false;
  private static readonly DEFAULT_VOLUME: number = 1;

  public readonly muted: boolean;
  public readonly volume: number;

  /**
   * @brief Create a normalized audio preference object
   *
   * @param muted - Whether playback should begin muted
   * @param volume - Desired playback volume
   */
  public constructor(
    muted: boolean = AudioPreferences.DEFAULT_MUTED,
    volume: number = AudioPreferences.DEFAULT_VOLUME,
  ) {
    this.muted = muted;
    this.volume = AudioPreferences.clampVolume(volume);
  }

  /**
   * @brief Return the canonical default audio preferences
   *
   * @returns Shared default preferences used when no persisted value exists
   */
  public static defaults(): AudioPreferences {
    return new AudioPreferences();
  }

  /**
   * @brief Normalize arbitrary preference input into a value object
   *
   * @param preferences - Partial or prebuilt preference data
   *
   * @returns A complete and safe audio preference object
   */
  public static from(
    preferences: AudioPreferences | AudioPreferencesInit = {},
  ): AudioPreferences {
    if (preferences instanceof AudioPreferences) {
      return preferences;
    }

    const muted: boolean = preferences.muted ?? AudioPreferences.DEFAULT_MUTED;
    const volume: number =
      preferences.volume ?? AudioPreferences.DEFAULT_VOLUME;

    return new AudioPreferences(muted, volume);
  }

  /**
   * @brief Clamp a volume value into the valid media-element range
   *
   * @param volume - Candidate volume value
   *
   * @returns Volume clamped to [0, 1]
   */
  public static clampVolume(volume: number): number {
    return Math.min(Math.max(volume, 0), 1);
  }

  /**
   * @brief Return a new preference object with an updated mute flag
   *
   * @param muted - Whether playback should be muted
   *
   * @returns A new preference object with the requested mute flag
   */
  public withMuted(muted: boolean): AudioPreferences {
    return new AudioPreferences(muted, this.volume);
  }

  /**
   * @brief Return a new preference object with an updated volume
   *
   * @param volume - Desired playback volume
   *
   * @returns A new preference object with normalized volume
   */
  public withVolume(volume: number): AudioPreferences {
    return new AudioPreferences(this.muted, volume);
  }
}
