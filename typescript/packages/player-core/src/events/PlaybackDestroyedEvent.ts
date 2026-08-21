/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IPlaybackEvent } from "./IPlaybackEvent";

/**
 * @brief Playback event emitted when a controller is destroyed
 */
export class PlaybackDestroyedEvent implements IPlaybackEvent<
  "playback_destroyed",
  undefined
> {
  public static readonly EVENT_NAME: "playback_destroyed" =
    "playback_destroyed";

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_destroyed" {
    return PlaybackDestroyedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): undefined {
    return undefined;
  }
}
