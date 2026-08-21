/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Inspectable reasons recorded by the preview scheduler
 */
export type PreviewSchedulerDecisionReason =
  | "focused-item"
  | "focus-neighbor"
  | "likely-next-item"
  | "visible-item"
  | "recent-focus"
  | "over-budget"
  | "lower-priority"
  | "runtime-unsupported"
  | "background-priority";
