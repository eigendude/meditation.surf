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
 * @brief Payload emitted when playback is paused
 */
export type PlaybackPausedEventPayload = {
  source: PlaybackSource | null;
};

/**
 * @brief Playback event describing paused playback
 */
export class PlaybackPausedEvent implements IPlaybackEvent<
  "playback_paused",
  PlaybackPausedEventPayload
> {
  public static readonly EVENT_NAME: "playback_paused" = "playback_paused";

  public readonly source: PlaybackSource | null;

  /**
   * @brief Create a playback paused event
   *
   * @param source - Playback source associated with the pause action
   */
  public constructor(source: PlaybackSource | null) {
    this.source = source;
  }

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_paused" {
    return PlaybackPausedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): PlaybackPausedEventPayload {
    return {
      source: this.source,
    };
  }
}
