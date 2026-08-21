/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Stable reasons describing how one inventory snapshot was resolved
 */
export type MediaInventorySelectionReason =
  | "inventory-full"
  | "inventory-partial"
  | "inventory-unsupported"
  | "inventory-probe-failed"
  | "policy-fallback-only";
