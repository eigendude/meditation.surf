/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaInventorySnapshot } from "./MediaInventorySnapshot";
import type { MediaInventorySupportLevel } from "./MediaInventorySupportLevel";

/**
 * @brief Result returned by one runtime inventory provider lookup
 */
export type MediaInventoryResult = {
  supportLevel: MediaInventorySupportLevel;
  snapshot: MediaInventorySnapshot;
  failureReason: string | null;
};
