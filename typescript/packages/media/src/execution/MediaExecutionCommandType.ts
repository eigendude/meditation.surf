/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Runtime-facing command families issued by the shared execution layer
 */
export type MediaExecutionCommandType =
  | "warm-session"
  | "activate-session"
  | "deactivate-session"
  | "dispose-session"
  | "sync-plan";
