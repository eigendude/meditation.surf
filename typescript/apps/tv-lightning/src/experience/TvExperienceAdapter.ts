/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  BrowseContentAdapter,
  type BrowseFocusController,
  BrowseInteractionController,
  type BrowseSelectionController,
} from "@meditation-surf/browse";
import {
  type MediaCapabilityProfile,
  type MediaExecutionController,
  type MediaKernelController,
  type MediaThumbnailController,
  type MeditationExperience,
  type PlaybackSequenceController,
} from "@meditation-surf/core";
import type { OverlayController } from "@meditation-surf/overlay";
import { BackgroundVideoElement, VideoPlayer } from "@meditation-surf/player";
import type { PlaybackVisualReadinessController } from "@meditation-surf/player-core";

import { TvAppLayoutController } from "../layout/TvAppLayoutController";
import { TvMediaRuntimeAdapter } from "../media/TvMediaRuntimeAdapter";
import { TvMediaThumbnailRuntimeAdapter } from "../media/TvMediaThumbnailRuntimeAdapter";
import { TvBackgroundVideoController } from "../playback/TvBackgroundVideoController";

/**
 * @brief Group TV runtime adapters around a shared meditation experience
 *
 * The shared scene model stays in `packages/core`, while Lightning-specific
 * adaptation lives here beside the TV app.
 */
export class TvExperienceAdapter {
  private static readonly MEDIA_CAPABILITY_PROFILE: MediaCapabilityProfile = {
    supportsNativePlayback: true,
    supportsShakaPlayback: false,
    supportsPreviewVideo: false,
    supportsThumbnailExtraction: false,
    supportsWebCodecs: false,
    supportsCustomDecodeThumbnailExtraction: false,
    supportsCustomDecodePreviewWarm: false,
    supportsCustomDecodePreviewActive: false,
    supportsWorkerOffload: false,
    supportsWebGPUPreferred: false,
    supportsWebGLFallback: false,
    supportsCustomPipeline: true,
    supportsPremiumPlayback: true,
    previewSchedulerBudget: {
      maxWarmSessions: 0,
      maxActivePreviewSessions: 0,
      maxRendererBoundSessions: 0,
      maxHiddenSessions: 0,
      maxPreviewReuseMs: 1500,
      maxPreviewOverlapMs: 0,
      keepWarmAfterBlurMs: 0,
    },
  };

  public readonly appLayoutController: TvAppLayoutController;
  public readonly backgroundVideoController: TvBackgroundVideoController;
  public readonly browseContentAdapter: BrowseContentAdapter;
  public readonly browseFocusController: BrowseFocusController;
  public readonly browseInteractionController: BrowseInteractionController;
  public readonly browseSelectionController: BrowseSelectionController;
  public readonly mediaKernelController: MediaKernelController;
  public readonly mediaExecutionController: MediaExecutionController;
  public readonly mediaThumbnailController: MediaThumbnailController;
  public readonly overlayController: OverlayController;
  public readonly playbackSequenceController: PlaybackSequenceController;
  public readonly playbackVisualReadinessController: PlaybackVisualReadinessController;

  /**
   * @brief Build TV runtime adapters for the shared experience
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    const playbackVisualReadinessController: PlaybackVisualReadinessController =
      experience.getPlaybackVisualReadinessController();

    this.mediaKernelController = experience.getMediaKernelController();
    this.mediaExecutionController = experience.getMediaExecutionController();
    this.mediaThumbnailController = experience.getMediaThumbnailController();
    this.mediaThumbnailController.setRuntimeAdapter(
      new TvMediaThumbnailRuntimeAdapter(),
    );
    this.mediaKernelController.reportAppCapabilities(
      "tv-lightning",
      TvExperienceAdapter.MEDIA_CAPABILITY_PROFILE,
    );
    this.mediaExecutionController.setRuntimeAdapter(
      new TvMediaRuntimeAdapter(
        experience.catalog,
        experience.getPlaybackSequenceController(),
      ),
    );
    const backgroundVideoPlayer: VideoPlayer = new VideoPlayer({
      videoElement: new BackgroundVideoElement(),
    });
    this.appLayoutController = new TvAppLayoutController(experience.appLayout);
    this.backgroundVideoController = new TvBackgroundVideoController(
      experience,
      experience.appLayout.getBackgroundLayer(),
      experience.getPlaybackSequenceController(),
      backgroundVideoPlayer,
      playbackVisualReadinessController,
    );
    this.browseContentAdapter = new BrowseContentAdapter(experience.catalog);
    this.browseFocusController = experience.getBrowseFocusController();
    this.browseSelectionController = experience.getBrowseSelectionController();
    this.browseInteractionController = new BrowseInteractionController(
      this.browseFocusController,
      this.browseSelectionController,
    );
    this.overlayController = experience.getOverlayController();
    this.playbackSequenceController =
      experience.getPlaybackSequenceController();
    this.playbackVisualReadinessController = playbackVisualReadinessController;
  }
}
