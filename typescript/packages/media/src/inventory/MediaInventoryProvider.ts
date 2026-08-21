/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaInventoryRequest } from "./MediaInventoryRequest";
import type { MediaInventoryResult } from "./MediaInventoryResult";

/**
 * @brief Runtime contract used to resolve track and variant inventory for one source
 */
export interface MediaInventoryProvider {
  /**
   * @brief Resolve the available inventory for one shared media source
   *
   * @param request - Shared inventory lookup request
   *
   * @returns Inventory result reported by the runtime adapter
   */
  resolveMediaInventory(
    request: MediaInventoryRequest,
  ): MediaInventoryResult | Promise<MediaInventoryResult>;
}
