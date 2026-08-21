/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  BackgroundVideoPlaybackPolicy,
  MediaItem,
  PlaybackSequenceController,
  PlaybackSequenceState,
} from "@meditation-surf/core";
import type { BackgroundLayerLayout } from "@meditation-surf/layout";
import {
  VideoPlayer,
  type VideoPlayerEvent,
  type VideoSource,
} from "@meditation-surf/player";
import {
  ExpoVideoPlayerRuntime,
  type ExpoVideoPlayerViewProps,
} from "@meditation-surf/player/expo";
import type { PlaybackVisualReadinessController } from "@meditation-surf/player-core";

/**
 * @brief Adapt the shared background video model into Expo runtime behavior
 *
 * Expo keeps its `VideoView` surface local, while the shared player package now
 * owns the playback primitive and lifecycle. This controller keeps the mobile
 * background orchestration intact while swapping the underlying player path.
 */
export class ExpoBackgroundVideoController {
  private readonly backgroundLayer: BackgroundLayerLayout;
  private readonly playbackSequenceController: PlaybackSequenceController;
  private readonly backgroundVideoPlayer: VideoPlayer;
  private readonly backgroundVideoPlayerRuntime: ExpoVideoPlayerRuntime;
  private readonly playbackVisualReadinessController: PlaybackVisualReadinessController;
  private currentSourceUrl: string | null;
  private pendingSourceUrl: string | null;
  private removeBackgroundPlayerSubscription: (() => void) | null;

  /**
   * @brief Capture the shared background video model used by the Expo app
   *
   * @param backgroundLayer - Shared fullscreen background layer
   */
  public constructor(
    backgroundLayer: BackgroundLayerLayout,
    playbackSequenceController: PlaybackSequenceController,
    backgroundVideoPlayer: VideoPlayer,
    backgroundVideoPlayerRuntime: ExpoVideoPlayerRuntime,
    playbackVisualReadinessController: PlaybackVisualReadinessController,
  ) {
    this.backgroundLayer = backgroundLayer;
    this.playbackSequenceController = playbackSequenceController;
    this.backgroundVideoPlayer = backgroundVideoPlayer;
    this.backgroundVideoPlayerRuntime = backgroundVideoPlayerRuntime;
    this.playbackVisualReadinessController = playbackVisualReadinessController;
    this.currentSourceUrl = null;
    this.pendingSourceUrl = null;
    this.removeBackgroundPlayerSubscription = null;
  }

  /**
   * @brief Prepare the shared background player for Expo playback
   */
  public initialize(): void {
    this.backgroundVideoPlayer.initialize();

    if (this.removeBackgroundPlayerSubscription !== null) {
      return;
    }

    this.removeBackgroundPlayerSubscription =
      this.backgroundVideoPlayer.subscribe(
        (backgroundPlayerEvent: VideoPlayerEvent): void => {
          this.handleBackgroundPlayerEvent(backgroundPlayerEvent);
        },
      );
  }

  /**
   * @brief Subscribe the shared player to active-item changes
   *
   * @returns Cleanup callback that removes the active-item subscription
   */
  public connect(): () => void {
    return this.playbackSequenceController.subscribe(
      (playbackSequenceState: PlaybackSequenceState): void => {
        void this.handlePlaybackSequenceState(playbackSequenceState);
      },
    );
  }

  /**
   * @brief Tear down the shared background player
   *
   * @returns Promise that resolves after the player is released
   */
  public async destroy(): Promise<void> {
    this.removeBackgroundPlayerSubscription?.();
    this.removeBackgroundPlayerSubscription = null;
    this.currentSourceUrl = null;
    this.pendingSourceUrl = null;
    await this.backgroundVideoPlayer.destroy();
  }

  /**
   * @brief Return the VideoView props owned by the shared playback policy
   *
   * @returns Expo VideoView configuration derived from the shared model
   */
  public getVideoViewProps(): ExpoVideoPlayerViewProps & {
    readonly contentFit: "cover";
    readonly player: NonNullable<ExpoVideoPlayerViewProps["player"]>;
    readonly playsInline: boolean;
  } {
    const playbackPolicy: BackgroundVideoPlaybackPolicy = this.backgroundLayer
      .getBackgroundVideo()
      .getPlaybackPolicy();
    const videoViewProps: ExpoVideoPlayerViewProps & {
      readonly player: NonNullable<ExpoVideoPlayerViewProps["player"]>;
    } = this.backgroundVideoPlayerRuntime.getVideoViewProps();

    return {
      ...videoViewProps,
      contentFit: playbackPolicy.objectFit,
      playsInline: playbackPolicy.playsInline,
    };
  }

  /**
   * @brief Resolve the current shared background playback source
   *
   * @param activeItem - Active playback item, when one exists
   *
   * @returns Player source chosen for the background lane
   */
  private getPlaybackSource(activeItem: MediaItem | null): VideoSource {
    return (
      activeItem?.getPlaybackSource() ??
      this.backgroundLayer.getBackgroundVideo().getPlaybackSource()
    );
  }

  /**
   * @brief Apply active-item changes to the shared player instance
   *
   * @param playbackSequenceState - Shared playback sequence snapshot
   */
  private async handlePlaybackSequenceState(
    playbackSequenceState: PlaybackSequenceState,
  ): Promise<void> {
    const activeItem: MediaItem | null = playbackSequenceState.activeItem;
    const playbackSource: VideoSource = this.getPlaybackSource(activeItem);
    const nextSourceUrl: string = playbackSource.url;
    const shouldMute: boolean = this.resolveMutedState();

    if (this.pendingSourceUrl === nextSourceUrl) {
      this.backgroundVideoPlayer.setMuted(shouldMute);
      return;
    }

    if (this.currentSourceUrl === nextSourceUrl) {
      this.backgroundVideoPlayer.setMuted(shouldMute);
      await this.backgroundVideoPlayer.play();
      return;
    }

    this.currentSourceUrl = nextSourceUrl;
    this.pendingSourceUrl = nextSourceUrl;
    this.backgroundVideoPlayer.setMuted(true);

    try {
      await this.backgroundVideoPlayer.load(playbackSource);
      this.pendingSourceUrl = null;
      this.backgroundVideoPlayer.setMuted(shouldMute);
      await this.backgroundVideoPlayer.play();
    } catch (error: unknown) {
      if (this.currentSourceUrl === nextSourceUrl) {
        this.currentSourceUrl = null;
      }

      if (this.pendingSourceUrl === nextSourceUrl) {
        this.pendingSourceUrl = null;
      }

      throw error;
    }
  }

  /**
   * @brief Resolve whether committed background playback should be muted
   *
   * @returns `true` when Expo background playback should be muted
   */
  private resolveMutedState(): boolean {
    return true;
  }

  /**
   * @brief React to shared player lifecycle events with readiness updates
   *
   * @param backgroundPlayerEvent - Lifecycle event emitted by the shared player
   */
  private handleBackgroundPlayerEvent(
    backgroundPlayerEvent: VideoPlayerEvent,
  ): void {
    if (backgroundPlayerEvent.type === "loading-started") {
      this.playbackVisualReadinessController.beginLoading();

      return;
    }

    if (backgroundPlayerEvent.type === "first-frame-ready") {
      this.playbackVisualReadinessController.markVisualReady();
    }
  }
}
