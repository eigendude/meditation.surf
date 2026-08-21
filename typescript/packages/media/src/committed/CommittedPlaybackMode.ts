/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief High-level committed playback quality tiers selected by the chooser
 */
export type CommittedPlaybackMode =
  | "premium-attempt"
  | "standard-compatible"
  | "fallback-basic";
