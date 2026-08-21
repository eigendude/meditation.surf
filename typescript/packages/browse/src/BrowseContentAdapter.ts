/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  Catalog,
  CatalogSection,
  MediaItem,
  MediaItemMetadataTag,
} from "@meditation-surf/core";

import type { BrowseFocusState } from "./BrowseFocusController";

/**
 * @brief Artwork slot data prepared for browse-style presentation
 */
export interface BrowseArtworkContent {
  readonly imageUrl: string | null;
  readonly placeholderKey: string;
  readonly placeholderMonogram: string;
  readonly title: string;
}

/**
 * @brief Ordered metadata entry rendered in the hero metadata row
 */
export interface BrowseMetadataEntry {
  readonly id:
    | "created"
    | "duration"
    | "resolution"
    | "aspectRatio"
    | "videoCodec"
    | "audioCodec"
    | "channelLayout";
  readonly kind: "calendar" | "tag";
  readonly value: string;
  readonly iconName: "calendar" | null;
}

/**
 * @brief Browse hero content derived from a shared media item
 */
export interface BrowseHeroContent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly viewCount: string;
  readonly metadataEntries: readonly BrowseMetadataEntry[];
  readonly artwork: BrowseArtworkContent;
}

/**
 * @brief Thumbnail card content derived from a shared media item
 */
export interface BrowseThumbnailContent {
  readonly id: string;
  readonly title: string;
  readonly secondaryText: string;
  readonly artwork: BrowseArtworkContent;
}

/**
 * @brief One horizontal browse rail rendered below the hero area
 */
export interface BrowseRowContent {
  readonly id: string;
  readonly title: string;
  readonly items: readonly BrowseThumbnailContent[];
}

/**
 * @brief Full browse overlay payload shared by every runtime
 */
export interface BrowseScreenContent {
  readonly hero: BrowseHeroContent | null;
  readonly rows: readonly BrowseRowContent[];
}

/**
 * @brief Internal browse row model that preserves source media items
 */
interface BrowseRowModel {
  readonly content: BrowseRowContent;
  readonly sourceItems: readonly MediaItem[];
}

/**
 * @brief Adapt shared catalog items into a browse-screen presentation model
 *
 * The adapter keeps browse-specific ordering and fallback rules out of each
 * app, while still leaving rendering decisions to the platform layers.
 */
export class BrowseContentAdapter {
  private static readonly MINIMUM_ROW_COUNT: number = 2;
  private readonly catalog: Catalog;

  /**
   * @brief Create the browse adapter from a shared catalog
   *
   * @param catalog - Shared content catalog consumed by every app surface
   */
  public constructor(catalog: Catalog) {
    this.catalog = catalog;
  }

  /**
   * @brief Build the browse overlay content for the current playback and focus state
   *
   * @param activeItem - Current playback item used as the fallback hero when set
   * @param browseFocusState - Shared browse focus state that can override the hero
   *
   * @returns Browse hero and rows derived from the shared catalog
   */
  public getBrowseScreenContent(
    activeItem: MediaItem | null,
    browseFocusState: BrowseFocusState | null = null,
  ): BrowseScreenContent {
    const browseRowModels: readonly BrowseRowModel[] = this.createRowModels();
    const heroItem: MediaItem | null = this.resolveHeroItem(
      activeItem,
      browseFocusState,
      browseRowModels,
    );

    return {
      hero: heroItem === null ? null : this.createHeroContent(heroItem),
      rows: browseRowModels.map(
        (browseRowModel: BrowseRowModel): BrowseRowContent =>
          browseRowModel.content,
      ),
    };
  }

  /**
   * @brief Resolve one browse row and item position back to its media item
   *
   * @param rowIndex - Browse row position rendered by the shared adapter
   * @param itemIndex - Browse item position inside that row
   *
   * @returns Shared media item for that browse position, or `null`
   */
  public getMediaItemAt(rowIndex: number, itemIndex: number): MediaItem | null {
    const browseRowModel: BrowseRowModel | undefined =
      this.createRowModels()[rowIndex];

    return browseRowModel?.sourceItems[itemIndex] ?? null;
  }

  /**
   * @brief Return how many browse rows currently contain content
   *
   * @returns Number of rows available for browse-driven thumbnail planning
   */
  public getRowCount(): number {
    return this.createRowModels().length;
  }

  /**
   * @brief Return how many thumbnail cards belong to one browse row
   *
   * @param rowIndex - Browse row position rendered by the adapter
   *
   * @returns Number of cards in that row, or `0` when the row is absent
   */
  public getItemCountAtRow(rowIndex: number): number {
    const browseRowModel: BrowseRowModel | undefined =
      this.createRowModels()[rowIndex];

    return browseRowModel?.sourceItems.length ?? 0;
  }

  /**
   * @brief Resolve the item that should currently occupy the hero slot
   *
   * @param activeItem - Current playback item when available
   * @param browseFocusState - Shared browse focus state when one exists
   * @param browseRowModels - Browse rows paired with their source media items
   *
   * @returns Focused item first, then playback, then the catalog featured item
   */
  private resolveHeroItem(
    activeItem: MediaItem | null,
    browseFocusState: BrowseFocusState | null,
    browseRowModels: readonly BrowseRowModel[],
  ): MediaItem | null {
    const focusedItem: MediaItem | null = this.resolveFocusedHeroItem(
      browseFocusState,
      browseRowModels,
    );

    if (focusedItem !== null) {
      return focusedItem;
    }

    if (activeItem !== null) {
      return activeItem;
    }

    return this.catalog.getFeaturedItem();
  }

  /**
   * @brief Resolve the focused browse item that should drive the hero when present
   *
   * @param browseFocusState - Shared browse focus state when available
   * @param browseRowModels - Browse rows paired with their source media items
   *
   * @returns Focused media item or `null` when the focus state has no target yet
   */
  private resolveFocusedHeroItem(
    browseFocusState: BrowseFocusState | null,
    browseRowModels: readonly BrowseRowModel[],
  ): MediaItem | null {
    if (browseFocusState === null) {
      return null;
    }

    if (!browseFocusState.hasFocusedItem) {
      return null;
    }

    const focusedRow: BrowseRowModel | undefined =
      browseRowModels[browseFocusState.activeRowIndex];

    if (focusedRow === undefined) {
      return null;
    }

    const focusedItemIndex: number =
      browseFocusState.activeItemIndexByRow[browseFocusState.activeRowIndex] ??
      0;

    return focusedRow.sourceItems[focusedItemIndex] ?? null;
  }

  /**
   * @brief Convert a shared media item into hero presentation content
   *
   * @param mediaItem - Shared media item adapted for the hero area
   *
   * @returns Browse hero content with ordered metadata entries
   */
  private createHeroContent(mediaItem: MediaItem): BrowseHeroContent {
    return {
      id: mediaItem.id,
      title: mediaItem.title,
      description: mediaItem.description,
      viewCount: mediaItem.getMetadata().viewCount,
      metadataEntries: this.createMetadataEntries(mediaItem),
      artwork: this.createArtworkContent(mediaItem),
    };
  }

  /**
   * @brief Convert a shared media item into thumbnail card content
   *
   * @param mediaItem - Shared media item adapted for a browse rail card
   *
   * @returns Thumbnail card content shown inside a browse row
   */
  private createThumbnailContent(mediaItem: MediaItem): BrowseThumbnailContent {
    return {
      id: mediaItem.id,
      title: mediaItem.title,
      secondaryText: mediaItem.getMetadata().duration,
      artwork: this.createArtworkContent(mediaItem),
    };
  }

  /**
   * @brief Create the hero metadata entries in the required UI order
   *
   * The created label is always first and always rendered as the standalone
   * calendar item. Every tag after that preserves the catalog metadata order
   * so runtimes cannot accidentally reorder the row.
   *
   * @param mediaItem - Shared media item that owns the metadata
   *
   * @returns Ordered metadata entries for hero rendering
   */
  private createMetadataEntries(
    mediaItem: MediaItem,
  ): readonly BrowseMetadataEntry[] {
    const streamDetailRow: {
      created: string;
      tags: readonly MediaItemMetadataTag[];
    } = mediaItem.getMetadata().getOrderedStreamDetailRow();
    const metadataEntries: BrowseMetadataEntry[] = [
      {
        id: "created",
        kind: "calendar",
        value: streamDetailRow.created,
        iconName: "calendar",
      },
    ];

    for (const metadataTag of streamDetailRow.tags) {
      metadataEntries.push({
        id: metadataTag.id,
        kind: "tag",
        value: metadataTag.value,
        iconName: null,
      });
    }

    return metadataEntries;
  }

  /**
   * @brief Create the browse rails shown below the hero area
   *
   * Catalog sections become rails directly. When the fixture catalog exposes
   * fewer than two rails, this method derives additional rails from the same
   * shared items so every surface still renders a browse-style layout.
   *
   * @returns Ordered browse rows paired with their source media items
   */
  private createRowModels(): readonly BrowseRowModel[] {
    const catalogSections: CatalogSection[] = this.catalog
      .getSections()
      .filter((catalogSection: CatalogSection): boolean =>
        catalogSection.hasItems(),
      );
    const browseRows: BrowseRowModel[] = catalogSections.map(
      (catalogSection: CatalogSection): BrowseRowModel =>
        this.createRowFromItems(
          catalogSection.id,
          catalogSection.title,
          catalogSection.getItems(),
        ),
    );
    const allItems: MediaItem[] = this.collectAllItems(catalogSections);

    if (allItems.length === 0) {
      return browseRows;
    }

    if (browseRows.length < BrowseContentAdapter.MINIMUM_ROW_COUNT) {
      browseRows.push(
        this.createRowFromItems(
          "recently-added",
          "Recently Added",
          this.rotateItems(allItems, 1),
        ),
      );
    }

    if (browseRows.length < BrowseContentAdapter.MINIMUM_ROW_COUNT) {
      browseRows.push(
        this.createRowFromItems(
          "continue-browsing",
          "Continue Browsing",
          this.rotateItems(allItems, 2),
        ),
      );
    }

    return browseRows;
  }

  /**
   * @brief Convert shared items into a browse row payload
   *
   * @param rowId - Stable row identifier
   * @param rowTitle - Human-readable row title
   * @param items - Shared media items rendered inside the row
   *
   * @returns Browse row content with thumbnail cards
   */
  private createRowFromItems(
    rowId: string,
    rowTitle: string,
    items: MediaItem[],
  ): BrowseRowModel {
    return {
      content: {
        id: rowId,
        title: rowTitle,
        items: items.map(
          (mediaItem: MediaItem): BrowseThumbnailContent =>
            this.createThumbnailContent(mediaItem),
        ),
      },
      sourceItems: [...items],
    };
  }

  /**
   * @brief Flatten every section item into one browseable list
   *
   * @param catalogSections - Catalog sections that currently contain content
   *
   * @returns Flat list of section items preserving catalog order
   */
  private collectAllItems(catalogSections: CatalogSection[]): MediaItem[] {
    const allItems: MediaItem[] = [];

    for (const catalogSection of catalogSections) {
      allItems.push(...catalogSection.getItems());
    }

    return allItems;
  }

  /**
   * @brief Rotate items to create a distinct-looking fallback row ordering
   *
   * @param items - Shared media items sourced from the catalog
   * @param offset - Circular offset applied to the item order
   *
   * @returns Rotated item order used for fallback rows
   */
  private rotateItems(items: MediaItem[], offset: number): MediaItem[] {
    if (items.length === 0) {
      return [];
    }

    const normalizedOffset: number = offset % items.length;

    return items
      .slice(normalizedOffset)
      .concat(items.slice(0, normalizedOffset));
  }

  /**
   * @brief Create artwork slot data, leaving room for future real artwork URLs
   *
   * @param mediaItem - Shared media item that owns the artwork slot
   *
   * @returns Artwork content with placeholder-ready fallback fields
   */
  private createArtworkContent(mediaItem: MediaItem): BrowseArtworkContent {
    const titleWords: string[] = mediaItem.title.split(/\s+/).filter(Boolean);
    const placeholderMonogram: string = titleWords
      .slice(0, 2)
      .map((titleWord: string): string => titleWord.charAt(0).toUpperCase())
      .join("");

    return {
      imageUrl: null,
      placeholderKey: mediaItem.id,
      placeholderMonogram,
      title: mediaItem.title,
    };
  }
}
