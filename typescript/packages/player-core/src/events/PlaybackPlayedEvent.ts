/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { PlaybackSource } from "../domain/PlaybackSource";
import type { IPlaybackEvent } from "./IPlaybackEvent";

/**
 * @brief Payload emitted when playback starts or resumes
 */
export type PlaybackPlayedEventPayload = {
  source: PlaybackSource | null;
};

/**
 * @brief Playback event describing active playback
 */
export class PlaybackPlayedEvent implements IPlaybackEvent<
  "playback_played",
  PlaybackPlayedEventPayload
> {
  public static readonly EVENT_NAME: "playback_played" = "playback_played";

  public readonly source: PlaybackSource | null;

  /**
   * @brief Create a playback played event
   *
   * @param source - Active playback source when one is available
   */
  public constructor(source: PlaybackSource | null) {
    this.source = source;
  }

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_played" {
    return PlaybackPlayedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): PlaybackPlayedEventPayload {
    return {
      source: this.source,
    };
  }
}
