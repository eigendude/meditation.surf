/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { Catalog } from "../catalog/Catalog";

/**
 * @brief Shared content client contract
 *
 * Frontend apps can compose this with their own loading and caching strategy.
 */
export interface ICatalogClient {
  /**
   * @brief Get the application catalog
   *
   * This returns the catalog content used to render shared browsing experiences.
   *
   * @returns The application catalog payload
   */
  getCatalog(): Promise<Catalog>;
}
