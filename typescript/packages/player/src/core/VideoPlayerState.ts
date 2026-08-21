/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief State names exposed by the thin video player
 */
export type VideoPlayerStatus =
  | "idle"
  | "loading"
  | "first-frame-ready"
  | "playing"
  | "paused"
  | "error";

/**
 * @brief Read-only state snapshot exposed by the thin video player
 */
export type VideoPlayerState = {
  readonly status: VideoPlayerStatus;
  readonly sourceUrl: string | null;
  readonly error: Error | null;
};
