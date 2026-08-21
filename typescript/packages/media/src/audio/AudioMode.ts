/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared audio modes used across preview, extraction, and committed playback
 */
export type AudioMode =
  | "silent-extract"
  | "muted-preview"
  | "committed-playback"
  | "premium-attempt"
  | "fallback-stereo"
  | "background-audio-only";
