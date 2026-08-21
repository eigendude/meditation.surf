/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  PlayingChangeEventPayload,
  StatusChangeEventPayload,
  VideoPlayer as ExpoVideoPlayerPrimitive,
  VideoSource as ExpoVideoSourcePrimitive,
} from "expo-video";

/**
 * @brief Minimal event subscription returned by Expo video listeners
 */
export type ExpoVideoEventSubscription = {
  readonly remove: () => void;
};

/**
 * @brief Minimal Expo video event map used by the shared player package
 */
export type ExpoVideoPlayerEventMap = {
  readonly playingChange: (payload: PlayingChangeEventPayload) => void;
  readonly statusChange: (payload: StatusChangeEventPayload) => void;
};

/**
 * @brief Structural listener surface exposed by Expo's shared video player
 */
export type ExpoVideoPlayerWithEvents = ExpoVideoPlayerPrimitive & {
  addListener<EventName extends keyof ExpoVideoPlayerEventMap>(
    eventName: EventName,
    listener: ExpoVideoPlayerEventMap[EventName],
  ): ExpoVideoEventSubscription;
};

export type { ExpoVideoPlayerPrimitive, ExpoVideoSourcePrimitive };
