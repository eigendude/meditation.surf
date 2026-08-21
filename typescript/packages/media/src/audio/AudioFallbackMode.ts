/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared fallback markers published by audio policy and runtime adapters
 */
export type AudioFallbackMode =
  | "fallback-stereo"
  | "fallback-default"
  | "unsupported";
