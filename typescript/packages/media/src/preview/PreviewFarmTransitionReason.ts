/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Inspectable reasons for preview-farm assignment and state transitions
 */
export type PreviewFarmTransitionReason =
  | "focused-item-warmed"
  | "focused-item-activated"
  | "recent-focus-retained"
  | "existing-warm-session-reused"
  | "same-row-neighbor-warmed"
  | "likely-next-warmed"
  | "visible-item-warmed"
  | "legacy-path-required"
  | "renderer-budget-constrained"
  | "hidden-budget-exhausted"
  | "warm-budget-exhausted"
  | "runtime-unsupported"
  | "background-priority"
  | "reuse-window-expired"
  | "lower-priority";
