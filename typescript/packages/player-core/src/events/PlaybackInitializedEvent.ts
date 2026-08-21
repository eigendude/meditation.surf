/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IPlaybackEvent } from "./IPlaybackEvent";

/**
 * @brief Playback event emitted when a controller is initialized
 */
export class PlaybackInitializedEvent implements IPlaybackEvent<
  "playback_initialized",
  undefined
> {
  public static readonly EVENT_NAME: "playback_initialized" =
    "playback_initialized";

  /**
   * @brief Return the stable playback event name
   */
  public get eventName(): "playback_initialized" {
    return PlaybackInitializedEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable playback payload
   */
  public get payload(): undefined {
    return undefined;
  }
}
