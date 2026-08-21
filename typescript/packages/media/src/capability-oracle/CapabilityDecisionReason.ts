/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reason codes emitted by the shared capability oracle
 */
export type CapabilityDecisionReason =
  | "runtime-capability"
  | "native-supported"
  | "shaka-supported"
  | "premium-supported"
  | "premium-unsupported"
  | "role-prefers-low-cost"
  | "role-prefers-high-quality"
  | "runtime-limited"
  | "explicit-fallback"
  | "adapter-limited";
