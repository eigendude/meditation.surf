/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  BrowseContentAdapter,
  BrowseFocusController,
  type BrowseRowContent,
  BrowseSelectionController,
} from "@meditation-surf/browse";
import {
  AppLayout,
  BackgroundLayerLayout,
  CenteredOverlayLayout,
  DEMO_CENTERED_OVERLAY_LAYOUT,
  ForegroundLayerLayout,
} from "@meditation-surf/layout";
import {
  MediaExecutionController,
  MediaKernelController,
  MediaKernelExperienceBridge,
  type MediaKernelItem,
  type MediaSourceDescriptor,
  MediaTelemetryController,
  MediaThumbnailController,
} from "@meditation-surf/media";
import {
  OverlayController,
  OverlayRevealHandoffController,
} from "@meditation-surf/overlay";
import {
  PlaybackVisualReadinessController,
  type PlaybackVisualReadinessState,
} from "@meditation-surf/player-core";

import { Catalog } from "../catalog/Catalog";
import { FixtureCatalog } from "../catalog/FixtureCatalog";
import type { MediaItem } from "../catalog/MediaItem";
import { MediaSourceDescriptorFactory } from "../catalog/MediaSourceDescriptorFactory";
import { MeditationExperience } from "../experience/MeditationExperience";
import { BackgroundVideoModel } from "../playback/BackgroundVideoModel";
import { DemoBackgroundVideo } from "../playback/DemoBackgroundVideo";
import { PlaybackSequenceController } from "../playback/PlaybackSequenceController";

/**
 * @brief Factory that assembles the current demo meditation experience
 *
 * The factory keeps demo assembly logic in one place so apps can consume a
 * single coherent product model instead of rebuilding the same structure.
 */
export class DemoExperienceFactory {
  /**
   * @brief Build the canonical demo experience
   *
   * @returns Shared demo experience with background video and foreground UI
   */
  public static create(): MeditationExperience {
    const backgroundVideo: BackgroundVideoModel = DemoBackgroundVideo.create();
    const centeredOverlayLayout: CenteredOverlayLayout =
      DEMO_CENTERED_OVERLAY_LAYOUT;
    const appLayout: AppLayout = new AppLayout(
      new BackgroundLayerLayout(backgroundVideo),
      new ForegroundLayerLayout(centeredOverlayLayout),
    );
    const catalog: Catalog = FixtureCatalog.getCatalog();
    const browseContentAdapter: BrowseContentAdapter = new BrowseContentAdapter(
      catalog,
    );
    const overlayController: OverlayController = new OverlayController();
    const playbackVisualReadinessController: PlaybackVisualReadinessController =
      new PlaybackVisualReadinessController();
    const overlayRevealHandoffController: OverlayRevealHandoffController =
      new OverlayRevealHandoffController(
        overlayController,
        playbackVisualReadinessController,
      );
    const playbackSequenceController: PlaybackSequenceController =
      new PlaybackSequenceController(catalog);
    const initialRowItemCounts: number[] = browseContentAdapter
      .getBrowseScreenContent(playbackSequenceController.getActiveItem())
      .rows.map(
        (browseRow: BrowseRowContent): number => browseRow.items.length,
      );
    const browseFocusController: BrowseFocusController =
      new BrowseFocusController(initialRowItemCounts);
    const browseSelectionController: BrowseSelectionController =
      new BrowseSelectionController(initialRowItemCounts);
    const mediaKernelController: MediaKernelController =
      new MediaKernelController(
        (mediaKernelItem: MediaKernelItem): MediaSourceDescriptor =>
          MediaSourceDescriptorFactory.createForMediaItem(
            mediaKernelItem as MediaItem,
          ),
      );
    const mediaTelemetryController: MediaTelemetryController =
      new MediaTelemetryController();
    const mediaThumbnailController: MediaThumbnailController =
      new MediaThumbnailController(null, undefined, mediaTelemetryController);
    const mediaKernelExperienceBridge: MediaKernelExperienceBridge<MediaItem> =
      new MediaKernelExperienceBridge(
        browseContentAdapter,
        browseFocusController,
        browseSelectionController,
        mediaKernelController,
        playbackSequenceController,
        mediaThumbnailController,
      );
    const mediaExecutionController: MediaExecutionController =
      new MediaExecutionController(
        mediaKernelController,
        null,
        mediaThumbnailController.getVfsController(),
        mediaTelemetryController,
      );

    playbackVisualReadinessController.subscribe(
      (playbackVisualReadinessState: PlaybackVisualReadinessState): void => {
        if (playbackVisualReadinessState.readiness !== "visualReady") {
          return;
        }

        mediaExecutionController.markCommittedPlaybackVisualReady();
      },
    );

    return new MeditationExperience(
      appLayout,
      browseFocusController,
      browseSelectionController,
      catalog,
      mediaKernelExperienceBridge.getFocusDelayController(),
      mediaExecutionController,
      mediaKernelExperienceBridge,
      mediaKernelController,
      mediaThumbnailController,
      overlayController,
      overlayRevealHandoffController,
      playbackVisualReadinessController,
      playbackSequenceController,
    );
  }
}
