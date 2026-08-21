/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Shared preview-farm lifecycle states used for warming and reuse policy
 */
export type PreviewFarmSessionState =
  | "cold"
  | "warming"
  | "ready-first-frame"
  | "preview-active"
  | "cooling"
  | "evicted"
  | "failed";
