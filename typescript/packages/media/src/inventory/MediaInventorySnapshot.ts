/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaInventory } from "./MediaInventory";
import type { MediaInventorySelectionReason } from "./MediaInventorySelectionReason";
import type { MediaInventorySource } from "./MediaInventorySource";
import type { MediaInventorySupportLevel } from "./MediaInventorySupportLevel";

/**
 * @brief Read-only shared snapshot describing inventory availability and source
 */
export type MediaInventorySnapshot = {
  sourceId: string | null;
  supportLevel: MediaInventorySupportLevel;
  inventorySource: MediaInventorySource;
  selectionReason: MediaInventorySelectionReason;
  inventory: MediaInventory | null;
  notes: string[];
};
