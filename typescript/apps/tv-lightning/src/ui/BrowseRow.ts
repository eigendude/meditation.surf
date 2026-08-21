/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

import type { LightningThumbnailState } from "./BrowsePresentation";

/**
 * @brief Type alias for the factory returned by Blits.Component
 */
type BrowseRowFactory = ReturnType<typeof Blits.Component>;

/**
 * @brief Render one browse row and its thumbnails inside a child component
 *
 * This isolates the inner thumbnail `:for` loop from the root template so the
 * browse overlay avoids the Lightning nested-alias binding edge case that was
 * dereferencing `$browseRow.items` while the outer alias was transiently unset.
 *
 * @property {string} rowTitle Row heading displayed above the thumbnail strip
 * @property {number} rowTitleX Fixed-stage x coordinate used by the row heading
 * @property {number} rowTitleY Fixed-stage y coordinate used by the row heading
 * @property {LightningThumbnailState[]} rowItems Thumbnail state to render
 * @property {number} rowPosition Zero-based row index used for stable identity and focus logic
 * @property {number} activeItemIndex Focused item index for the active row
 * @property {boolean} hasFocusedItem Whether browse focus is currently active
 * @property {boolean} isActiveRow Whether this row currently owns horizontal focus
 */
const BrowseRow: BrowseRowFactory = Blits.Component("BrowseRow", {
  props: [
    "rowTitle",
    "rowTitleX",
    "rowTitleY",
    "rowItems",
    "rowPosition",
    "activeItemIndex",
    "hasFocusedItem",
    "isActiveRow",
  ],
  computed: {
    /**
     * @brief Expose the row items with a concrete Lightning-specific type
     *
     * @returns {LightningThumbnailState[]} Thumbnail state for this row
     */
    thumbnailItems(): LightningThumbnailState[] {
      // @ts-ignore `this` contains the reactive props provided at runtime
      return (this.rowItems as LightningThumbnailState[]) ?? [];
    },
  },

  template: `<Element
      :h="174"
      :w="1920"
      x="0"
      :y="$rowTitleY"
    >
      <Text
        color="#FFFFFF"
        :content="$rowTitle"
        size="28"
        :x="$rowTitleX"
        y="0"
      />
      <Element
        :for="(browseItem, itemIndex) in $thumbnailItems"
        :h="174"
        key="$browseItem.id"
        :w="$browseItem.width"
        :x="92 + $browseItem.x"
        :y="$browseItem.y"
      >
        <Element
          :alpha="$hasFocusedItem && $isActiveRow && $itemIndex === $activeItemIndex ? 1 : 0"
          color="#FFFFFF"
          :h="$browseItem.height + 8"
          :w="$browseItem.width + 8"
          x="-4"
          y="-4"
        />
        <Element
          color="#132131"
          :h="$browseItem.height"
          :w="$browseItem.width"
        />
        <Text
          color="#FFFFFF"
          :content="$browseItem.monogram"
          size="32"
          x="88"
          y="34"
        />
        <Text
          color="#FFFFFF"
          :content="$browseItem.title"
          :maxwidth="$browseItem.width"
          size="18"
          x="0"
          y="136"
        />
        <Text
          color="#D8D8D8"
          :content="$browseItem.secondaryText"
          :maxwidth="$browseItem.width"
          size="15"
          x="0"
          y="156"
        />
      </Element>
    </Element>`,
});

export default BrowseRow;
