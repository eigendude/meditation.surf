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
 * @brief Payload emitted when a playback source has been loaded
 */
export type PlaybackLoadedEventPayload = {
  source: PlaybackSource;
};

/**
 * @brief Playback event describing successful playback source loading
 */
export class PlaybackLoadedEvent implements IPlaybackEvent<
  "playback_loaded",
  PlaybackLoadedEventPayload
> {
  public static readonly EVENT_NAME: "playback_loaded" = "playback_loaded";

  public readonly source: PlaybackSource;

  /**
   * @brief Create a playback loaded event
   *
   * @param source - Playback source that was loaded
   */
  public constructor(source: PlaybackSource) {
    this.source = source;
  }

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_loaded" {
    return PlaybackLoadedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): PlaybackLoadedEventPayload {
    return {
      source: this.source,
    };
  }
}
