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
  type BackgroundVideoPlaybackPolicy,
  type MediaCapabilityProfile,
  type MediaExecutionController,
  type MediaKernelController,
  type MediaThumbnailController,
  type MeditationExperience,
  type PlaybackSequenceController,
} from "@meditation-surf/core";
import type { OverlayController } from "@meditation-surf/overlay";
import { VideoPlayer } from "@meditation-surf/player";
import { ExpoVideoPlayerRuntime } from "@meditation-surf/player/expo";
import type { PlaybackVisualReadinessController } from "@meditation-surf/player-core";

import { ExpoBrowseInputAdapter } from "../input/ExpoBrowseInputAdapter";
import { ExpoAppLayoutController } from "../layout/ExpoAppLayoutController";
import { ExpoMediaRuntimeAdapter } from "../media/ExpoMediaRuntimeAdapter";
import { ExpoMediaThumbnailRuntimeAdapter } from "../media/ExpoMediaThumbnailRuntimeAdapter";
import { ExpoBackgroundVideoController } from "../playback/ExpoBackgroundVideoController";

/**
 * @brief Group Expo runtime adapters around a shared meditation experience
 *
 * The shared scene model stays in `packages/core`, while Expo-specific
 * adaptation lives here beside the Expo app.
 */
export class ExpoExperienceAdapter {
  private static readonly MEDIA_CAPABILITY_PROFILE: MediaCapabilityProfile = {
    supportsNativePlayback: true,
    supportsShakaPlayback: false,
    supportsPreviewVideo: true,
    supportsThumbnailExtraction: false,
    supportsWebCodecs: false,
    supportsCustomDecodeThumbnailExtraction: false,
    supportsCustomDecodePreviewWarm: false,
    supportsCustomDecodePreviewActive: false,
    supportsWorkerOffload: false,
    supportsWebGPUPreferred: false,
    supportsWebGLFallback: false,
    supportsCustomPipeline: false,
    supportsPremiumPlayback: true,
    previewSchedulerBudget: {
      maxWarmSessions: 0,
      maxActivePreviewSessions: 0,
      maxRendererBoundSessions: 0,
      maxHiddenSessions: 0,
      maxPreviewReuseMs: 2000,
      maxPreviewOverlapMs: 0,
      keepWarmAfterBlurMs: 0,
    },
  };

  public readonly appLayoutController: ExpoAppLayoutController;
  public readonly backgroundVideoController: ExpoBackgroundVideoController;
  public readonly browseContentAdapter: BrowseContentAdapter;
  public readonly browseFocusController: BrowseFocusController;
  public readonly browseInputAdapter: ExpoBrowseInputAdapter;
  public readonly browseInteractionController: BrowseInteractionController;
  public readonly browseSelectionController: BrowseSelectionController;
  public readonly mediaKernelController: MediaKernelController;
  public readonly mediaExecutionController: MediaExecutionController;
  public readonly mediaThumbnailController: MediaThumbnailController;
  public readonly overlayController: OverlayController;
  public readonly playbackSequenceController: PlaybackSequenceController;
  public readonly playbackVisualReadinessController: PlaybackVisualReadinessController;

  /**
   * @brief Build Expo runtime adapters for the shared experience
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    const playbackVisualReadinessController: PlaybackVisualReadinessController =
      experience.getPlaybackVisualReadinessController();
    const backgroundPlaybackPolicy: BackgroundVideoPlaybackPolicy =
      experience.appLayout
        .getBackgroundLayer()
        .getBackgroundVideo()
        .getPlaybackPolicy();
    const backgroundVideoPlayerRuntime: ExpoVideoPlayerRuntime =
      new ExpoVideoPlayerRuntime({
        loop: backgroundPlaybackPolicy.loop,
      });
    const backgroundVideoPlayer: VideoPlayer = new VideoPlayer({
      runtime: backgroundVideoPlayerRuntime,
    });

    this.mediaKernelController = experience.getMediaKernelController();
    this.mediaExecutionController = experience.getMediaExecutionController();
    this.mediaThumbnailController = experience.getMediaThumbnailController();
    this.mediaThumbnailController.setRuntimeAdapter(
      new ExpoMediaThumbnailRuntimeAdapter(),
    );
    this.mediaKernelController.reportAppCapabilities(
      "mobile-expo",
      ExpoExperienceAdapter.MEDIA_CAPABILITY_PROFILE,
    );
    this.mediaExecutionController.setRuntimeAdapter(
      new ExpoMediaRuntimeAdapter(
        experience.catalog,
        experience.getPlaybackSequenceController(),
      ),
    );
    this.appLayoutController = new ExpoAppLayoutController(
      experience.appLayout,
    );
    this.backgroundVideoController = new ExpoBackgroundVideoController(
      experience.appLayout.getBackgroundLayer(),
      experience.getPlaybackSequenceController(),
      backgroundVideoPlayer,
      backgroundVideoPlayerRuntime,
      playbackVisualReadinessController,
    );
    this.browseContentAdapter = new BrowseContentAdapter(experience.catalog);
    this.browseFocusController = experience.getBrowseFocusController();
    this.browseSelectionController = experience.getBrowseSelectionController();
    this.browseInteractionController = new BrowseInteractionController(
      this.browseFocusController,
      this.browseSelectionController,
    );
    this.browseInputAdapter = new ExpoBrowseInputAdapter(
      this.browseInteractionController,
    );
    this.overlayController = experience.getOverlayController();
    this.playbackSequenceController =
      experience.getPlaybackSequenceController();
    this.playbackVisualReadinessController = playbackVisualReadinessController;
  }
}
