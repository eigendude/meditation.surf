/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";
import type {
  BrowseContentAdapter,
  BrowseFocusController,
  BrowseFocusState,
  BrowseRowContent,
  BrowseScreenContent,
  BrowseSelectionController,
  BrowseThumbnailContent,
} from "@meditation-surf/browse";
import type {
  MediaItem,
  PlaybackSequenceController,
  PlaybackSequenceState,
} from "@meditation-surf/core";
import type { OverlayController, OverlayState } from "@meditation-surf/overlay";
import type {
  PlaybackVisualReadinessController,
  PlaybackVisualReadinessState,
} from "@meditation-surf/player-core";

import type {
  TvBrowseInputAdapter,
  TvDirectionalInputHandlers,
} from "../input/TvBrowseInputAdapter";
import {
  LIGHTNING_APP_HEIGHT,
  LIGHTNING_APP_WIDTH,
} from "../layout/StageLayout";
import { TvAppLayoutController } from "../layout/TvAppLayoutController";
import { TvViewportSync } from "../layout/TvViewportSync";
import type {
  LightningRowState,
  LightningThumbnailState,
} from "./BrowsePresentation";
import BrowseRow from "./BrowseRow";
import Icon from "./Icon";

// Type alias for the factory returned by Blits.Application
type LightningAppFactory = ReturnType<typeof Blits.Application>;

type LightningMetadataEntryState = {
  id: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
  textMaxWidth: number;
  calendarAlpha: number;
  tagAlpha: number;
};

export type LightningAppOptions = {
  appLayoutController: TvAppLayoutController;
  browseInputAdapter: TvBrowseInputAdapter;
  browseContentAdapter: BrowseContentAdapter;
  browseFocusController: BrowseFocusController;
  browseSelectionController: BrowseSelectionController;
  directionalInputHandlers: TvDirectionalInputHandlers;
  overlayController: OverlayController;
  playbackSequenceController: PlaybackSequenceController;
  playbackVisualReadinessController: PlaybackVisualReadinessController;
  viewportSync: TvViewportSync;
  onReady: () => void;
  onDestroy: () => void;
};

type LightningAppState = {
  appLayoutController: TvAppLayoutController;
  activePlaybackItem: MediaItem | null;
  browseContent: BrowseScreenContent;
  fadeDurationMs: number;
  loadingAlpha: number;
  overlayAlpha: number;
  heroTitle: string;
  heroViewCount: string;
  heroDescription: string;
  metadataEntries: LightningMetadataEntryState[];
  browseRows: LightningRowState[];
  hasFocusedItem: boolean;
  activeRowIndex: number;
  activeItemIndexByRow: number[];
  stageW: number;
  stageH: number;
  viewportW: number;
  viewportH: number;
  removeLoadingSubscription: (() => void) | null;
  removeOverlaySubscription: (() => void) | null;
  removePlaybackSequenceSubscription: (() => void) | null;
  removeBrowseFocusSubscription: (() => void) | null;
  stopViewportSync: (() => void) | null;
};

type LightningAppMethods = {
  initializeBrowseContent(): void;
  initializeLoadingSubscription(): void;
  initializeOverlaySubscription(): void;
  initializePlaybackSequenceSubscription(): void;
  initializeBrowseFocusSubscription(): void;
  initializeViewportSync(): void;
  handleBrowseFocusState(browseFocusState: BrowseFocusState): void;
  handlePlaybackSequenceState(
    playbackSequenceState: PlaybackSequenceState,
  ): void;
  handlePlaybackVisualReadinessState(
    playbackVisualReadinessState: PlaybackVisualReadinessState,
  ): void;
  handleOverlayState(overlayState: OverlayState): void;
  syncBrowseControllers(): void;
  rebuildBrowsePresentation(): void;
  tearDownViewportSync(): void;
};

/**
 * @brief Build the Lightning root component used by the TV app
 *
 * Rendering remains local to the Lightning app, while startup and shared model
 * adaptation are injected from the TV app layer.
 *
 * @param options - Runtime-specific collaborators owned by the TV app
 *
 * @returns Lightning application factory
 */
export function createLightningApp(
  options: LightningAppOptions,
): LightningAppFactory {
  return Blits.Application<
    Record<string, never>,
    LightningAppState,
    LightningAppMethods,
    Record<string, never>,
    Record<string, never>
  >({
    // Keep the stage dimensions fixed for the TV-only experience.
    state(): LightningAppState {
      const browseContent: BrowseScreenContent =
        options.browseContentAdapter.getBrowseScreenContent(
          options.playbackSequenceController.getActiveItem(),
          options.browseFocusController.getState(),
        );

      return {
        appLayoutController: options.appLayoutController,
        activePlaybackItem: options.playbackSequenceController.getActiveItem(),
        browseContent,
        fadeDurationMs: options.overlayController.getConfig().fadeDurationMs,
        loadingAlpha: 1,
        overlayAlpha: 0,
        heroTitle: "",
        heroViewCount: "",
        heroDescription: "",
        metadataEntries: [],
        browseRows: [],
        hasFocusedItem: false,
        activeRowIndex: 0,
        activeItemIndexByRow: [],
        stageW: LIGHTNING_APP_WIDTH,
        stageH: LIGHTNING_APP_HEIGHT,
        viewportW: 0,
        viewportH: 0,
        removeLoadingSubscription: null,
        removeOverlaySubscription: null,
        removePlaybackSequenceSubscription: null,
        removeBrowseFocusSubscription: null,
        stopViewportSync: null,
      };
    },

    methods: {
      /**
       * @brief Prime the browse presentation before the first overlay reveal
       */
      initializeBrowseContent(): void {
        this.syncBrowseControllers();
        this.rebuildBrowsePresentation();
      },

      /**
       * @brief Subscribe the Lightning root to playback visual readiness
       */
      initializeLoadingSubscription(): void {
        this.removeLoadingSubscription =
          options.playbackVisualReadinessController.subscribe(
            (
              playbackVisualReadinessState: PlaybackVisualReadinessState,
            ): void => {
              this.handlePlaybackVisualReadinessState(
                playbackVisualReadinessState,
              );
            },
          );
      },

      /**
       * @brief Subscribe the Lightning root to the shared overlay state
       */
      initializeOverlaySubscription(): void {
        this.removeOverlaySubscription = options.overlayController.subscribe(
          (overlayState: OverlayState): void => {
            this.handleOverlayState(overlayState);
          },
        );
      },

      /**
       * @brief Subscribe the Lightning root to shared active-item changes
       */
      initializePlaybackSequenceSubscription(): void {
        this.removePlaybackSequenceSubscription =
          options.playbackSequenceController.subscribe(
            (playbackSequenceState: PlaybackSequenceState): void => {
              this.handlePlaybackSequenceState(playbackSequenceState);
            },
          );
      },

      /**
       * @brief Subscribe the Lightning root to the shared browse focus model
       */
      initializeBrowseFocusSubscription(): void {
        this.removeBrowseFocusSubscription =
          options.browseFocusController.subscribe(
            (browseFocusState: BrowseFocusState): void => {
              this.handleBrowseFocusState(browseFocusState);
            },
          );
      },

      /**
       * @brief Subscribe to viewport updates emitted by the TV bootstrap layout helper
       */
      initializeViewportSync(): void {
        this.stopViewportSync = options.viewportSync.subscribe(
          (viewportSize: { width: number; height: number }): void => {
            this.viewportW = viewportSize.width;
            this.viewportH = viewportSize.height;
          },
        );
      },

      /**
       * @brief Map shared browse focus onto the local Lightning presentation state
       *
       * @param browseFocusState - Shared browse focus snapshot
       */
      handleBrowseFocusState(browseFocusState: BrowseFocusState): void {
        this.hasFocusedItem = browseFocusState.hasFocusedItem;
        this.activeRowIndex = browseFocusState.activeRowIndex;
        this.activeItemIndexByRow = [...browseFocusState.activeItemIndexByRow];
        this.browseContent =
          options.browseContentAdapter.getBrowseScreenContent(
            this.activePlaybackItem,
            browseFocusState,
          );
        this.rebuildBrowsePresentation();
      },

      /**
       * @brief Map the shared active item onto the rendered browse overlay
       *
       * @param playbackSequenceState - Shared playback sequence snapshot
       */
      handlePlaybackSequenceState(
        playbackSequenceState: PlaybackSequenceState,
      ): void {
        this.activePlaybackItem = playbackSequenceState.activeItem;
        this.browseContent =
          options.browseContentAdapter.getBrowseScreenContent(
            this.activePlaybackItem,
            options.browseFocusController.getState(),
          );
        this.syncBrowseControllers();
        this.rebuildBrowsePresentation();
      },

      /**
       * @brief Map playback visual readiness onto the loading icon alpha
       *
       * @param playbackVisualReadinessState - Shared playback readiness snapshot
       */
      handlePlaybackVisualReadinessState(
        playbackVisualReadinessState: PlaybackVisualReadinessState,
      ): void {
        this.loadingAlpha =
          playbackVisualReadinessState.readiness === "loading" ? 1 : 0;
      },

      /**
       * @brief Map shared overlay visibility onto Lightning alpha
       *
       * @param overlayState - Shared overlay visibility snapshot
       */
      handleOverlayState(overlayState: OverlayState): void {
        this.overlayAlpha = overlayState.visibility === "visible" ? 1 : 0;
      },

      /**
       * @brief Sync the shared browse focus controller against the latest rows
       */
      syncBrowseControllers(): void {
        const rowItemCounts: number[] = this.browseContent.rows.map(
          (browseRow: BrowseRowContent): number => browseRow.items.length,
        );

        options.browseFocusController.syncRows(rowItemCounts);
        options.browseSelectionController.syncRows(rowItemCounts);
      },

      /**
       * @brief Rebuild all positioned browse presentation state for Lightning
       *
       * The shared browse content model stays runtime-agnostic, while this
       * method translates it into fixed-stage coordinates and focus styling.
       */
      rebuildBrowsePresentation(): void {
        const heroContent: BrowseScreenContent["hero"] =
          this.browseContent.hero;
        const metadataEntries: LightningMetadataEntryState[] = [];
        const browseRows: LightningRowState[] = [];
        const metadataStartX: number = 92;
        const metadataStartY: number = 254;
        const metadataGap: number = 14;
        let metadataCursorX: number = metadataStartX;
        let metadataCursorY: number = metadataStartY;

        if (heroContent !== null) {
          for (const metadataEntry of heroContent.metadataEntries) {
            const entryWidth: number =
              metadataEntry.kind === "calendar"
                ? 178
                : Math.max(116, metadataEntry.value.length * 15 + 34);

            if (metadataCursorX + entryWidth > 1300) {
              metadataCursorX = metadataStartX;
              metadataCursorY += 44;
            }

            metadataEntries.push({
              id: metadataEntry.id,
              value: metadataEntry.value,
              x: metadataCursorX,
              y: metadataCursorY,
              width: entryWidth,
              height: 34,
              textX: metadataEntry.kind === "calendar" ? 36 : 14,
              textY: 8,
              textMaxWidth:
                entryWidth - (metadataEntry.kind === "calendar" ? 46 : 28),
              calendarAlpha: metadataEntry.kind === "calendar" ? 1 : 0,
              tagAlpha: metadataEntry.kind === "tag" ? 1 : 0,
            });
            metadataCursorX += entryWidth + metadataGap;
          }
        }

        for (const [rowIndex, browseRow] of this.browseContent.rows.entries()) {
          const titleY: number = 446 + rowIndex * 188;
          const activeItemIndex: number =
            this.activeItemIndexByRow[rowIndex] ?? 0;
          const items: LightningThumbnailState[] = browseRow.items.map(
            (
              browseItem: BrowseThumbnailContent,
              itemIndex: number,
            ): LightningThumbnailState => ({
              id: browseItem.id,
              title: browseItem.title,
              secondaryText: browseItem.secondaryText,
              monogram: browseItem.artwork.placeholderMonogram,
              x: 0 + itemIndex * 246,
              y: 42,
              width: 224,
              height: 126,
            }),
          );

          browseRows.push({
            id: browseRow.id,
            title: browseRow.title,
            titleX: 92,
            titleY,
            items,
            rowPosition: rowIndex,
            activeItemIndex,
            hasFocusedItem: this.hasFocusedItem,
            isActiveRow: rowIndex === this.activeRowIndex,
          });
        }

        this.heroTitle = heroContent?.title ?? "";
        this.heroViewCount = heroContent?.viewCount ?? "";
        this.heroDescription = heroContent?.description ?? "";
        this.metadataEntries = metadataEntries;
        this.browseRows = browseRows;
        options.browseInputAdapter.syncBrowseRows(browseRows);
      },

      /**
       * @brief Release the viewport subscription when the Lightning root is destroyed
       */
      tearDownViewportSync(): void {
        if (this.removeLoadingSubscription !== null) {
          this.removeLoadingSubscription();
          this.removeLoadingSubscription = null;
        }

        if (this.stopViewportSync !== null) {
          this.stopViewportSync();
          this.stopViewportSync = null;
        }

        if (this.removePlaybackSequenceSubscription !== null) {
          this.removePlaybackSequenceSubscription();
          this.removePlaybackSequenceSubscription = null;
        }

        if (this.removeBrowseFocusSubscription !== null) {
          this.removeBrowseFocusSubscription();
          this.removeBrowseFocusSubscription = null;
        }

        if (this.removeOverlaySubscription !== null) {
          this.removeOverlaySubscription();
          this.removeOverlaySubscription = null;
        }
      },
    },

    input: {
      /**
       * @brief Explicitly select the currently focused thumbnail
       */
      enter(): void {
        options.directionalInputHandlers.enter();
      },

      /**
       * @brief Move focus to the previous thumbnail inside the active row
       */
      left(): void {
        options.directionalInputHandlers.left();
      },

      /**
       * @brief Move focus to the next thumbnail inside the active row
       */
      right(): void {
        options.directionalInputHandlers.right();
      },

      /**
       * @brief Reserve upward row navigation for the next browse step
       */
      up(): void {
        options.directionalInputHandlers.up();
      },

      /**
       * @brief Reserve downward row navigation for the next browse step
       */
      down(): void {
        options.directionalInputHandlers.down();
      },
    },

    // Register child components available in the template
    components: {
      BrowseRow,
      Icon,
    },

    hooks: {
      /**
       * @brief The application is fully rendered and ready
       *
       * UI lifecycle stays separate from media playback internals.
       */
      ready(): void {
        this.initializeBrowseContent();
        this.initializeLoadingSubscription();
        this.initializeOverlaySubscription();
        this.initializePlaybackSequenceSubscription();
        this.initializeBrowseFocusSubscription();
        this.initializeViewportSync();
        this.$focus();
        options.onReady();
      },

      /**
       * @brief Remove app-level listeners when Lightning tears down the root view
       */
      destroy(): void {
        this.tearDownViewportSync();
        options.onDestroy();
      },
    },

    // Render separate loading and browse UI planes on the fixed TV stage.
    template: `<Element :w="$stageW" :h="$stageH">
      <Icon
        :appLayoutController="$appLayoutController"
        :alpha="$loadingAlpha"
        :fadeDurationMs="$fadeDurationMs"
        :stageW="$stageW"
        :stageH="$stageH"
        :viewportW="$viewportW"
        :viewportH="$viewportH"
      />
      <Element
        :alpha.transition="{ value: $overlayAlpha, duration: $fadeDurationMs, easing: 'ease' }"
        :w="$stageW"
        :h="$stageH"
      >
        <Text
          color="#FFFFFF"
          :content="$heroTitle"
          maxwidth="760"
          size="62"
          x="92"
          y="88"
        />
        <Text
          color="#F2F2F2"
          :content="$heroViewCount"
          maxwidth="520"
          size="24"
          x="94"
          y="176"
        />
        <Text
          color="#FFFFFF"
          :content="$heroDescription"
          lineheight="34"
          maxwidth="980"
          size="24"
          x="94"
          y="208"
        />
        <Element
          :for="(metadataEntry, metadataIndex) in $metadataEntries"
          :h="$metadataEntry.height"
          key="$metadataEntry.id"
          :w="$metadataEntry.width"
          :x="$metadataEntry.x"
          :y="$metadataEntry.y"
        >
          <Element
            :alpha="$metadataEntry.tagAlpha"
            color="#FFFFFF"
            :h="$metadataEntry.height"
            :w="$metadataEntry.width"
          />
          <Element
            :alpha="$metadataEntry.tagAlpha"
            color="#11151A"
            h="30"
            :w="$metadataEntry.width - 4"
            x="2"
            y="2"
          />
          <Element
            :alpha="$metadataEntry.calendarAlpha"
            h="18"
            w="18"
            x="8"
            y="8"
          >
            <Element color="#FFFFFF" h="18" w="18" />
            <Element color="#11151A" h="14" w="14" x="2" y="2" />
            <Element color="#FFFFFF" h="4" w="18" x="0" y="0" />
          </Element>
          <Text
            color="#FFFFFF"
            :content="$metadataEntry.value"
            :maxwidth="$metadataEntry.textMaxWidth"
            size="18"
            :x="$metadataEntry.textX"
            :y="$metadataEntry.textY"
          />
        </Element>
        <BrowseRow
          :for="(browseRow, rowIndex) in $browseRows"
          key="$browseRow.id"
          :rowTitle="$browseRow.title"
          :rowTitleX="$browseRow.titleX"
          :rowTitleY="$browseRow.titleY"
          :rowItems="$browseRow.items"
          :rowPosition="$browseRow.rowPosition"
          :activeItemIndex="$browseRow.activeItemIndex"
          :hasFocusedItem="$browseRow.hasFocusedItem"
          :isActiveRow="$browseRow.isActiveRow"
        />
      </Element>
    </Element>`,
  });
}
