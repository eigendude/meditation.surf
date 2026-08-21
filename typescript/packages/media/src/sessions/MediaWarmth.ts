/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared preload depth for a media source or session
 */
export type MediaWarmth =
  | "cold"
  | "metadata"
  | "first-frame"
  | "preloaded"
  | "active";
