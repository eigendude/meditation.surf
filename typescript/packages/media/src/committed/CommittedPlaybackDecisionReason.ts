/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reason codes emitted by the committed playback chooser
 */
export type CommittedPlaybackDecisionReason =
  | "capability-oracle"
  | "runtime-prefers-native"
  | "runtime-prefers-shaka"
  | "inventory-full"
  | "inventory-partial"
  | "inventory-unavailable"
  | "premium-supported"
  | "premium-unsupported"
  | "premium-candidate-available"
  | "premium-candidate-unavailable"
  | "runtime-limited"
  | "background-only-path"
  | "adapter-unsupported"
  | "fallback-from-preferred-lane"
  | "existing-runtime-path"
  | "no-better-lane-available";
