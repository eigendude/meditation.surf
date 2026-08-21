/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRoleCapabilitySnapshot } from "../capability-oracle/MediaRoleCapabilitySnapshot";
import type { MediaInventoryResult } from "../inventory/MediaInventoryResult";
import type { VariantRolePolicy } from "./VariantRolePolicy";

/**
 * @brief Immutable request consumed by the shared role-based variant policy
 */
export type VariantSelectionRequest = {
  role: VariantRolePolicy;
  capabilitySnapshot: MediaRoleCapabilitySnapshot | null;
  inventoryResult: MediaInventoryResult | null;
  maxWidth: number | null;
  maxHeight: number | null;
  maxBandwidth: number | null;
};
