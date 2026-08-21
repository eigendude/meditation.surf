/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  BrowseFocusController,
  BrowseSelectionController,
} from "@meditation-surf/browse";
import type { AppLayout, ForegroundLayerLayout } from "@meditation-surf/layout";
import type {
  FocusDelayController,
  MediaExecutionController,
  MediaKernelController,
  MediaKernelExperienceBridge,
  MediaThumbnailController,
} from "@meditation-surf/media";
import type {
  OverlayController,
  OverlayRevealHandoffController,
} from "@meditation-surf/overlay";
import type { PlaybackVisualReadinessController } from "@meditation-surf/player-core";

import type { Catalog } from "../catalog/Catalog";
import type { MediaItem } from "../catalog/MediaItem";
import type { BackgroundVideoModel } from "../playback/BackgroundVideoModel";
import type { PlaybackSequenceController } from "../playback/PlaybackSequenceController";

/**
 * @brief Runtime-agnostic app scene for meditation.surf
 *
 * The current product surface is intentionally simple: a background video plus
 * foreground UI. Keeping that structure explicit in one object gives each app
 * a clear model to adapt without centralizing rendering decisions.
 */
export class MeditationExperience {
  public readonly appLayout: AppLayout;
  public readonly browseFocusController: BrowseFocusController;
  public readonly catalog: Catalog;
  public readonly overlayController: OverlayController;
  public readonly overlayRevealHandoffController: OverlayRevealHandoffController;
  public readonly browseSelectionController: BrowseSelectionController;
  public readonly focusDelayController: FocusDelayController;
  public readonly mediaExecutionController: MediaExecutionController;
  public readonly mediaKernelExperienceBridge: MediaKernelExperienceBridge<MediaItem>;
  public readonly mediaKernelController: MediaKernelController;
  public readonly mediaThumbnailController: MediaThumbnailController;
  public readonly playbackVisualReadinessController: PlaybackVisualReadinessController;
  public readonly playbackSequenceController: PlaybackSequenceController;

  /**
   * @brief Create a meditation experience from its domain submodels
   *
   * @param appLayout - Shared app-surface layout model
   * @param browseFocusController - Shared browse focus controller
   * @param browseSelectionController - Shared browse selection controller
   * @param catalog - Shared content catalog model
   * @param focusDelayController - Shared timed-focus controller used by the media bridge
   * @param mediaExecutionController - Shared runtime execution controller
   * @param mediaKernelExperienceBridge - Shared bridge that reflects browse/playback state into the media kernel
   * @param mediaKernelController - Shared runtime-agnostic media orchestration controller
   * @param overlayController - Shared overlay interaction state controller
   * @param overlayRevealHandoffController - Shared loading-to-overlay handoff controller
   * @param playbackVisualReadinessController - Shared playback visual readiness controller
   * @param playbackSequenceController - Shared active-item playback sequence controller
   */
  public constructor(
    appLayout: AppLayout,
    browseFocusController: BrowseFocusController,
    browseSelectionController: BrowseSelectionController,
    catalog: Catalog,
    focusDelayController: FocusDelayController,
    mediaExecutionController: MediaExecutionController,
    mediaKernelExperienceBridge: MediaKernelExperienceBridge<MediaItem>,
    mediaKernelController: MediaKernelController,
    mediaThumbnailController: MediaThumbnailController,
    overlayController: OverlayController,
    overlayRevealHandoffController: OverlayRevealHandoffController,
    playbackVisualReadinessController: PlaybackVisualReadinessController,
    playbackSequenceController: PlaybackSequenceController,
  ) {
    this.appLayout = appLayout;
    this.browseFocusController = browseFocusController;
    this.browseSelectionController = browseSelectionController;
    this.catalog = catalog;
    this.focusDelayController = focusDelayController;
    this.mediaExecutionController = mediaExecutionController;
    this.mediaKernelExperienceBridge = mediaKernelExperienceBridge;
    this.mediaKernelController = mediaKernelController;
    this.mediaThumbnailController = mediaThumbnailController;
    this.overlayController = overlayController;
    this.overlayRevealHandoffController = overlayRevealHandoffController;
    this.playbackVisualReadinessController = playbackVisualReadinessController;
    this.playbackSequenceController = playbackSequenceController;
  }

  /**
   * @brief Return the shared background video for the current app surface
   *
   * @returns Shared background video model
   */
  public getBackgroundVideo(): BackgroundVideoModel {
    return this.appLayout.getBackgroundLayer().getBackgroundVideo();
  }

  /**
   * @brief Return the shared foreground layer for the current app surface
   *
   * @returns Shared fullscreen foreground layer
   */
  public getForegroundLayer(): ForegroundLayerLayout {
    return this.appLayout.getForegroundLayer();
  }

  /**
   * @brief Return the shared browse focus controller
   *
   * @returns Shared browse focus controller
   */
  public getBrowseFocusController(): BrowseFocusController {
    return this.browseFocusController;
  }

  /**
   * @brief Return the shared browse selection controller
   *
   * @returns Shared browse selection controller
   */
  public getBrowseSelectionController(): BrowseSelectionController {
    return this.browseSelectionController;
  }

  /**
   * @brief Return the shared centered-overlay interaction controller
   *
   * @returns Shared overlay interaction controller
   */
  public getOverlayController(): OverlayController {
    return this.overlayController;
  }

  /**
   * @brief Return the shared media kernel controller
   *
   * @returns Shared runtime-agnostic media orchestration controller
   */
  public getMediaKernelController(): MediaKernelController {
    return this.mediaKernelController;
  }

  /**
   * @brief Return the shared media execution controller
   *
   * @returns Shared execution controller that reconciles plans against runtime adapters
   */
  public getMediaExecutionController(): MediaExecutionController {
    return this.mediaExecutionController;
  }

  /**
   * @brief Return the shared media thumbnail controller
   *
   * @returns Shared thumbnail orchestration controller
   */
  public getMediaThumbnailController(): MediaThumbnailController {
    return this.mediaThumbnailController;
  }

  /**
   * @brief Return the shared timed-focus controller
   *
   * @returns Shared timed-focus controller used to escalate warm intent
   */
  public getFocusDelayController(): FocusDelayController {
    return this.focusDelayController;
  }

  /**
   * @brief Return the shared loading-to-overlay handoff controller
   *
   * @returns Shared handoff controller that reveals the overlay after loading fades out
   */
  public getOverlayRevealHandoffController(): OverlayRevealHandoffController {
    return this.overlayRevealHandoffController;
  }

  /**
   * @brief Return the shared playback visual readiness controller
   *
   * @returns Shared loading-versus-visual-ready playback controller
   */
  public getPlaybackVisualReadinessController(): PlaybackVisualReadinessController {
    return this.playbackVisualReadinessController;
  }

  /**
   * @brief Return the shared playback sequence controller
   *
   * @returns Shared active-item sequence controller
   */
  public getPlaybackSequenceController(): PlaybackSequenceController {
    return this.playbackSequenceController;
  }

  /**
   * @brief Return the featured item chosen by the catalog
   *
   * @returns The featured media item, or `null` when the catalog is empty
   */
  public getFeaturedItem(): MediaItem | null {
    return this.catalog.getFeaturedItem();
  }

  /**
   * @brief Return the item currently chosen for playback
   *
   * @returns Active runtime media item, or `null` when the sequence is empty
   */
  public getActiveItem(): MediaItem | null {
    return this.playbackSequenceController.getActiveItem();
  }

  /**
   * @brief Return the title shown for the currently active item
   *
   * @returns Active item title, or `null` when the sequence is empty
   */
  public getActiveItemTitle(): string | null {
    return this.playbackSequenceController.getActiveItemTitle();
  }

  /**
   * @brief Return the title shown for the currently featured item
   *
   * This keeps the current display-title intent in shared code without
   * introducing a larger playback metadata model before the product needs one.
   *
   * @returns The featured item title, or `null` when the catalog is empty
   */
  public getFeaturedItemTitle(): string | null {
    const featuredItem: MediaItem | null = this.getFeaturedItem();

    return featuredItem?.title ?? null;
  }
}
