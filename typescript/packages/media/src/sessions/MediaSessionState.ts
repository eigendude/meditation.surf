/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared lifecycle phases for a logical media session
 */
export type MediaSessionState =
  | "idle"
  | "probing"
  | "loading"
  | "first-frame-ready"
  | "previewing"
  | "playing"
  | "paused"
  | "failed";
