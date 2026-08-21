/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reason codes emitted by the shared variant policy
 */
export type VariantSelectionReason =
  | "role-prefers-startup-latency"
  | "role-prefers-image-quality"
  | "role-prefers-premium-playback"
  | "inventory-full"
  | "inventory-partial"
  | "inventory-unavailable"
  | "premium-tier-viable"
  | "premium-tier-unavailable"
  | "matched-available-variant"
  | "selected-standard-variant"
  | "selected-premium-variant"
  | "no-compatible-variant"
  | "runtime-limited"
  | "dimension-limited"
  | "bandwidth-limited"
  | "conservative-default";
