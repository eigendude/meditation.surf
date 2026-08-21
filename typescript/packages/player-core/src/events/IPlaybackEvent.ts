/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared contract for one playback event object
 *
 * Each playback event keeps a stable event name and an immutable payload so
 * callers can pass one domain object across playback boundaries.
 *
 * @tparam TEventName - Stable playback event name literal
 *
 * @tparam TPayload - Payload shape emitted for the event
 */
export interface IPlaybackEvent<TEventName extends string, TPayload> {
  /**
   * @brief Stable playback event name
   */
  readonly eventName: TEventName;

  /**
   * @brief Immutable payload emitted for the playback event
   */
  readonly payload: TPayload;
}
