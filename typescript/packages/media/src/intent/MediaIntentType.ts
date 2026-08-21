/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief High-level user or app intent states that drive media planning
 */
export type MediaIntentType =
  | "idle"
  | "focused"
  | "focused-delay-elapsed"
  | "selected"
  | "background-active";
