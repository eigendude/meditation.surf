/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoPlayerState } from "./VideoPlayerState";

/**
 * @brief Event names emitted by the thin video player
 */
export type VideoPlayerEventType =
  | "loading-started"
  | "first-frame-ready"
  | "playback-started"
  | "playback-paused"
  | "error";

/**
 * @brief Event payload delivered to video-player listeners
 */
export type VideoPlayerEvent = {
  readonly type: VideoPlayerEventType;
  readonly state: VideoPlayerState;
  readonly error: Error | null;
};

/**
 * @brief Listener signature used by the thin video player
 */
export type VideoPlayerListener = (event: VideoPlayerEvent) => void;
