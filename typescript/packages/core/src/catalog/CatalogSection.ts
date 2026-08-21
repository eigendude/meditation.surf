/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { MediaItem } from "./MediaItem";

/**
 * @brief A catalog grouping shown by frontend-specific navigation and layout layers
 *
 * The section owns a concrete list of media items and exposes small helper
 * methods so apps can ask intentful questions instead of indexing arrays.
 */
export class CatalogSection {
  public readonly id: string;
  public readonly title: string;
  private readonly items: MediaItem[];

  /**
   * @brief Create a catalog section from a title and item collection
   *
   * @param id - Stable section identifier
   * @param title - Human-readable section title
   * @param items - Section-owned media items
   */
  public constructor(id: string, title: string, items: MediaItem[]) {
    this.id = id;
    this.title = title;
    this.items = items;
  }

  /**
   * @brief Return the items contained in this section
   *
   * @returns A shallow copy of the section items to keep ownership local
   */
  public getItems(): MediaItem[] {
    return [...this.items];
  }

  /**
   * @brief Determine whether the section currently contains playable content
   *
   * @returns `true` when at least one item exists
   */
  public hasItems(): boolean {
    return this.items.length > 0;
  }

  /**
   * @brief Return the first item when present
   *
   * @returns The first section item, or `null` when the section is empty
   */
  public getFeaturedItem(): MediaItem | null {
    return this.items[0] ?? null;
  }
}
