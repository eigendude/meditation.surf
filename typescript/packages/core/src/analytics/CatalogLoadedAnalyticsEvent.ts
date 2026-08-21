/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { IAnalyticsEvent } from "./IAnalyticsEvent";

/**
 * @brief Payload emitted when catalog content finishes loading
 */
export type CatalogLoadedAnalyticsEventPayload = {
  categoryCount: number;
  itemCount: number;
};

/**
 * @brief Analytics event describing a loaded content catalog
 *
 * This event preserves the shared `catalog_loaded` vocabulary and keeps the
 * two summary counts close to the class that owns the event semantics.
 */
export class CatalogLoadedAnalyticsEvent implements IAnalyticsEvent<
  "catalog_loaded",
  CatalogLoadedAnalyticsEventPayload
> {
  public static readonly EVENT_NAME: "catalog_loaded" = "catalog_loaded";

  public readonly categoryCount: number;
  public readonly itemCount: number;

  /**
   * @brief Create a catalog loaded analytics event
   *
   * @param categoryCount - Number of catalog categories made available
   *
   * @param itemCount - Number of playable items made available
   */
  public constructor(categoryCount: number, itemCount: number) {
    this.categoryCount = categoryCount;
    this.itemCount = itemCount;
  }

  /**
   * @brief Return the stable analytics event name
   */
  public get eventName(): "catalog_loaded" {
    return CatalogLoadedAnalyticsEvent.EVENT_NAME;
  }

  /**
   * @brief Return the immutable analytics payload
   */
  public get payload(): CatalogLoadedAnalyticsEventPayload {
    return {
      categoryCount: this.categoryCount,
      itemCount: this.itemCount,
    };
  }
}
