/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Generic source used to gather playback inventory for one runtime path
 */
export type MediaInventorySource =
  | "adaptive-runtime"
  | "native-runtime"
  | "shell-runtime"
  | "unavailable";
