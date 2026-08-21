/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IPlaybackEvent } from "./IPlaybackEvent";

/**
 * @brief Payload emitted when mute or volume changes
 */
export type PlaybackVolumeChangedEventPayload = {
  muted: boolean;
  volume: number;
};

/**
 * @brief Playback event describing a volume-related change
 */
export class PlaybackVolumeChangedEvent implements IPlaybackEvent<
  "playback_volume_changed",
  PlaybackVolumeChangedEventPayload
> {
  public static readonly EVENT_NAME: "playback_volume_changed" =
    "playback_volume_changed";

  public readonly muted: boolean;
  public readonly volume: number;

  /**
   * @brief Create a playback volume changed event
   *
   * @param muted - Whether playback is muted
   * @param volume - Current playback volume
   */
  public constructor(muted: boolean, volume: number) {
    this.muted = muted;
    this.volume = volume;
  }

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_volume_changed" {
    return PlaybackVolumeChangedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): PlaybackVolumeChangedEventPayload {
    return {
      muted: this.muted,
      volume: this.volume,
    };
  }
}
