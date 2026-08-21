/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

export {
  type VideoPlayerEvent,
  type VideoPlayerEventType,
  type VideoPlayerListener,
} from "./core/VideoPlayerEvent";
export {
  type VideoPlayerState,
  type VideoPlayerStatus,
} from "./core/VideoPlayerState";
export type {
  VideoPlayerRuntime,
  VideoPlayerRuntimeEvent,
  VideoPlayerRuntimeListener,
} from "./core/VideoPlayerRuntime";
export type { IVideoElement, VideoDisplayBounds } from "./dom/IVideoElement";
export { BackgroundVideoElement } from "./dom/BackgroundVideoElement";
export { VideoPlayer } from "./core/VideoPlayer";
export type { VideoSource } from "./core/VideoSource";
