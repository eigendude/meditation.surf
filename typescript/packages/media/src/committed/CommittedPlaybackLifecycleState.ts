/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Explicit lifecycle phases for committed background playback
 */
export type CommittedPlaybackLifecycleState =
  | "selected"
  | "activating-background"
  | "waiting-first-frame"
  | "background-active";
