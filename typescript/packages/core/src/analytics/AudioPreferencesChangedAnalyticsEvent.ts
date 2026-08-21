/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IAnalyticsEvent } from "./IAnalyticsEvent";

/**
 * @brief Payload emitted when shared audio preferences change
 */
export type AudioPreferencesChangedAnalyticsEventPayload = {
  muted: boolean;
  volume: number;
};

/**
 * @brief Analytics event describing a shared audio-preference update
 *
 * This event preserves the stable `audio_preferences_changed` vocabulary while
 * keeping the preference snapshot as part of a concrete domain object.
 */
export class AudioPreferencesChangedAnalyticsEvent implements IAnalyticsEvent<
  "audio_preferences_changed",
  AudioPreferencesChangedAnalyticsEventPayload
> {
  public static readonly EVENT_NAME: "audio_preferences_changed" =
    "audio_preferences_changed";

  public readonly muted: boolean;
  public readonly volume: number;

  /**
   * @brief Create an audio preferences changed analytics event
   *
   * @param muted - Whether playback is muted after the change
   *
   * @param volume - Normalized playback volume after the change
   */
  public constructor(muted: boolean, volume: number) {
    this.muted = muted;
    this.volume = volume;
  }

  /**
   * @brief Return the stable analytics event name
   */
  public get eventName(): "audio_preferences_changed" {
    return AudioPreferencesChangedAnalyticsEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable analytics payload
   */
  public get payload(): AudioPreferencesChangedAnalyticsEventPayload {
    return {
      muted: this.muted,
      volume: this.volume,
    };
  }
}
