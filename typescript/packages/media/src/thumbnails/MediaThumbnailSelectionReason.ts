/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared reasons used when one thumbnail frame is ultimately selected
 */
export type MediaThumbnailSelectionReason =
  | "first-frame-accepted"
  | "representative-frame-selected"
  | "fallback-first-decodable"
  | "fallback-low-quality"
  | "cached-artifact-reused";
