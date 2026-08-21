/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared contract for one analytics event object
 *
 * Each analytics event keeps a stable event name and an immutable payload so
 * callers can pass a single domain object through tracking boundaries.
 *
 * @tparam TEventName - Stable analytics event name literal
 *
 * @tparam TPayload - Payload shape emitted for the event
 */
export interface IAnalyticsEvent<TEventName extends string, TPayload> {
  /**
   * @brief Stable analytics event name
   */
  readonly eventName: TEventName;

  /**
   * @brief Immutable payload emitted for the event
   */
  readonly payload: TPayload;
}
