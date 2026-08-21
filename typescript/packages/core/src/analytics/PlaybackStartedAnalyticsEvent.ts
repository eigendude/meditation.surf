/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IAnalyticsEvent } from "./IAnalyticsEvent";

/**
 * @brief Payload emitted when playback begins for one content item
 */
export type PlaybackStartedAnalyticsEventPayload = {
  contentId: string;
};

/**
 * @brief Analytics event describing the start of playback
 *
 * This event keeps the stable `playback_started` name while letting the event
 * object own the content identifier needed by analytics consumers.
 */
export class PlaybackStartedAnalyticsEvent implements IAnalyticsEvent<
  "playback_started",
  PlaybackStartedAnalyticsEventPayload
> {
  public static readonly EVENT_NAME: "playback_started" = "playback_started";

  public readonly contentId: string;

  /**
   * @brief Create a playback started analytics event
   *
   * @param contentId - Identifier for the content whose playback began
   */
  public constructor(contentId: string) {
    this.contentId = contentId;
  }

  /**
   * @brief Return the stable analytics event name
   */
  public get eventName(): "playback_started" {
    return PlaybackStartedAnalyticsEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable analytics payload
   */
  public get payload(): PlaybackStartedAnalyticsEventPayload {
    return {
      contentId: this.contentId,
    };
  }
}
