/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { Catalog } from "../catalog/Catalog";
import { FixtureCatalog } from "../catalog/FixtureCatalog";
import type { ICatalogClient } from "./ICatalogClient";

/**
 * @brief In-memory client that serves the shared catalog fixture
 *
 * This implementation returns the static fixture catalog without remote
 * fetching.
 */
export class FixtureCatalogClient implements ICatalogClient {
  /**
   * @brief Get the shared fixture catalog
   *
   * This resolves to the shared in-memory catalog fixture.
   *
   * @returns The catalog fixture payload
   */
  public async getCatalog(): Promise<Catalog> {
    return FixtureCatalog.getCatalog();
  }
}
