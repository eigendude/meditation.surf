/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { CatalogSection } from "./CatalogSection";
import { MediaItem } from "./MediaItem";

/**
 * @brief Shared catalog payload returned by content clients
 *
 * The catalog provides small domain methods for the "featured content" shape
 * used by the current demo surface without baking in any runtime UI rules.
 */
export class Catalog {
  private readonly sections: CatalogSection[];

  /**
   * @brief Create a catalog from pre-built section objects
   *
   * @param sections - Pre-built section objects owned by the catalog
   */
  public constructor(sections: CatalogSection[]) {
    this.sections = sections;
  }

  /**
   * @brief Return all catalog sections
   *
   * @returns A shallow copy of the catalog section list
   */
  public getSections(): CatalogSection[] {
    return [...this.sections];
  }

  /**
   * @brief Determine whether any section currently has content
   *
   * @returns `true` when the catalog contains at least one playable item
   */
  public hasItems(): boolean {
    return this.sections.some((section: CatalogSection): boolean =>
      section.hasItems(),
    );
  }

  /**
   * @brief Return the first non-empty section when present
   *
   * @returns The first section with content, or `null` when the catalog is empty
   */
  public getFeaturedSection(): CatalogSection | null {
    const featuredSection: CatalogSection | undefined = this.sections.find(
      (section: CatalogSection): boolean => section.hasItems(),
    );

    return featuredSection ?? null;
  }

  /**
   * @brief Return the first featured item across all sections
   *
   * @returns The first playable item, or `null` when no content exists
   */
  public getFeaturedItem(): MediaItem | null {
    const featuredSection: CatalogSection | null = this.getFeaturedSection();

    return featuredSection?.getFeaturedItem() ?? null;
  }
}
