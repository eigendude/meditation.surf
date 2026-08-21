/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Public playback lifecycle states shared by controllers and observers
 *
 * These values represent the shared playback state machine surface.
 */
export type PlaybackStatus =
  | "idle"
  | "initializing"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

/**
 * @brief Named playback status constants for domain objects and controllers
 *
 * The repo is moving toward class-owned domain concepts, so this class keeps
 * the stable status vocabulary in one focused playback file.
 */
export class PlaybackStatuses {
  public static readonly IDLE: PlaybackStatus = "idle";
  public static readonly INITIALIZING: PlaybackStatus = "initializing";
  public static readonly LOADING: PlaybackStatus = "loading";
  public static readonly READY: PlaybackStatus = "ready";
  public static readonly PLAYING: PlaybackStatus = "playing";
  public static readonly PAUSED: PlaybackStatus = "paused";
  public static readonly ENDED: PlaybackStatus = "ended";
  public static readonly ERROR: PlaybackStatus = "error";
}
