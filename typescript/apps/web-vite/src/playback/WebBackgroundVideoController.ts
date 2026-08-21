/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  BackgroundVideoPlaybackPolicy,
  CommittedPlaybackDecision,
  MediaItem,
  MediaSourceDescriptorFactory,
  PlaybackSequenceController,
  PlaybackSequenceState,
} from "@meditation-surf/core";
import { BackgroundLayerLayout } from "@meditation-surf/layout";
import type {
  PlaybackSource,
  PlaybackVisualReadinessController,
} from "@meditation-surf/player-core";
import { VfsController } from "@meditation-surf/vfs";

type ShakaModule =
  (typeof import("shaka-player/dist/shaka-player.compiled.js"))["default"];
type ShakaPlayer = InstanceType<ShakaModule["Player"]>;

/**
 * @brief Own web-specific background video playback behavior
 *
 * This controller keeps DOM video configuration and Shaka fallback logic local
 * to the web app while consuming the shared background video model.
 */
export class WebBackgroundVideoController {
  private readonly backgroundLayer: BackgroundLayerLayout;
  private readonly playbackSequenceController: PlaybackSequenceController;
  private readonly playbackVisualReadinessController: PlaybackVisualReadinessController;
  private readonly vfsController: VfsController;
  private activeShakaPlayer: ShakaPlayer | null;
  private currentAudioActivationMode: string | null;
  private currentCommittedLane: string | null;
  private currentSourceUrl: string | null;
  private removePlaybackSequenceSubscription: (() => void) | null;

  /**
   * @brief Capture the shared experience consumed by the web background player
   *
   * @param backgroundLayer - Shared fullscreen background layer
   * @param vfsController - Shared VFS controller used for startup warming
   */
  public constructor(
    backgroundLayer: BackgroundLayerLayout,
    playbackSequenceController: PlaybackSequenceController,
    playbackVisualReadinessController: PlaybackVisualReadinessController,
    vfsController: VfsController,
  ) {
    this.backgroundLayer = backgroundLayer;
    this.playbackSequenceController = playbackSequenceController;
    this.playbackVisualReadinessController = playbackVisualReadinessController;
    this.vfsController = vfsController;
    this.activeShakaPlayer = null;
    this.currentAudioActivationMode = null;
    this.currentCommittedLane = null;
    this.currentSourceUrl = null;
    this.removePlaybackSequenceSubscription = null;
  }

  /**
   * @brief Apply the shared playback policy to the owned DOM video element
   *
   * @param videoElement - DOM video element used for background playback
   */
  public configureElement(videoElement: HTMLVideoElement): void {
    const playbackPolicy: BackgroundVideoPlaybackPolicy = this.backgroundLayer
      .getBackgroundVideo()
      .getPlaybackPolicy();
    const committedPlaybackDecision: CommittedPlaybackDecision | null =
      this.playbackSequenceController.getCommittedPlaybackDecision();

    videoElement.autoplay = playbackPolicy.autoplay;
    videoElement.controls = false;
    videoElement.crossOrigin = "anonymous";
    videoElement.loop = playbackPolicy.loop;
    videoElement.muted = this.resolveMutedState(
      playbackPolicy,
      committedPlaybackDecision,
    );
    videoElement.preload = "auto";
    videoElement.playsInline = playbackPolicy.playsInline;
    videoElement.style.objectFit = playbackPolicy.objectFit;
    videoElement.setAttribute("autoplay", "");
    videoElement.setAttribute("crossorigin", "anonymous");
    videoElement.setAttribute("loop", "");
    videoElement.setAttribute("muted", "");
    videoElement.setAttribute("playsinline", "");
  }

  /**
   * @brief Start background playback using native HLS or the Shaka fallback
   *
   * @param videoElement - DOM video element used for background playback
   *
   * @returns A promise that resolves after playback has been attempted
   */
  public async start(videoElement: HTMLVideoElement): Promise<void> {
    this.removePlaybackSequenceSubscription =
      this.playbackSequenceController.subscribe(
        (playbackSequenceState: PlaybackSequenceState): void => {
          void this.handlePlaybackSequenceState(
            videoElement,
            playbackSequenceState,
          );
        },
      );
  }

  /**
   * @brief Tear down active playback resources owned by the web app
   *
   * @returns A promise that resolves after the Shaka player has been destroyed
   */
  public async destroy(): Promise<void> {
    this.removePlaybackSequenceSubscription?.();
    this.removePlaybackSequenceSubscription = null;

    if (this.activeShakaPlayer === null) {
      return;
    }

    const shakaPlayer: ShakaPlayer = this.activeShakaPlayer;
    this.activeShakaPlayer = null;
    await shakaPlayer.destroy();
  }

  /**
   * @brief Apply autoplay flags and attempt to start playback
   *
   * @param videoElement - DOM video element used for background playback
   * @param playbackPolicy - Shared background playback policy
   *
   * @returns A promise that resolves after playback has been attempted
   */
  private async attemptAutoplay(
    videoElement: HTMLVideoElement,
    playbackPolicy: BackgroundVideoPlaybackPolicy,
    committedPlaybackDecision: CommittedPlaybackDecision | null,
  ): Promise<void> {
    videoElement.muted = this.resolveMutedState(
      playbackPolicy,
      committedPlaybackDecision,
    );
    videoElement.autoplay = playbackPolicy.autoplay;
    videoElement.loop = playbackPolicy.loop;
    videoElement.playsInline = playbackPolicy.playsInline;

    try {
      await videoElement.play();
    } catch (error: unknown) {
      console.warn(
        "Background video autoplay was blocked by the browser.",
        error,
      );
    }
  }

  /**
   * @brief Sync the DOM video element to the shared active item
   *
   * @param videoElement - DOM video element used for background playback
   * @param playbackSequenceState - Shared playback sequence snapshot
   */
  private async handlePlaybackSequenceState(
    videoElement: HTMLVideoElement,
    playbackSequenceState: PlaybackSequenceState,
  ): Promise<void> {
    const activeItem: MediaItem | null = playbackSequenceState.activeItem;
    const committedPlaybackDecision: CommittedPlaybackDecision | null =
      playbackSequenceState.committedPlaybackDecision;

    if (activeItem === null) {
      this.currentAudioActivationMode = null;
      this.currentCommittedLane = null;
      this.currentSourceUrl = null;
      return;
    }

    const nextSourceUrl: string = activeItem.getPlaybackSource().url;
    const nextCommittedLane: string =
      committedPlaybackDecision?.chosenLane ?? "native";
    const nextAudioActivationMode: string =
      committedPlaybackDecision?.audioActivationMode ?? "muted-preview";

    if (
      this.currentSourceUrl === nextSourceUrl &&
      this.currentCommittedLane === nextCommittedLane
    ) {
      if (this.currentAudioActivationMode !== nextAudioActivationMode) {
        const playbackPolicy: BackgroundVideoPlaybackPolicy =
          this.backgroundLayer.getBackgroundVideo().getPlaybackPolicy();

        videoElement.muted = this.resolveMutedState(
          playbackPolicy,
          committedPlaybackDecision,
        );
      }

      this.currentAudioActivationMode = nextAudioActivationMode;
      return;
    }

    this.currentSourceUrl = nextSourceUrl;
    this.currentCommittedLane = nextCommittedLane;
    this.currentAudioActivationMode = nextAudioActivationMode;
    try {
      await this.vfsController.warmStartupArtifacts({
        source: MediaSourceDescriptorFactory.createForMediaItem(activeItem),
        variantKey: null,
        useCase: "committed-playback-startup",
        cachePolicy: this.vfsController.getDefaultCachePolicy(),
        allowServiceWorkerLookup: true,
        startupWindowByteLength: 131072,
        hotRangeByteLength: 262144,
      });
    } catch (error: unknown) {
      console.warn(
        "VFS committed playback warming fell back to the direct runtime path.",
        error,
      );
    }
    this.playbackVisualReadinessController.beginLoading();
    this.installFirstRenderedFrameObserver(videoElement);
    await this.destroyActiveShakaPlayer();
    this.activeShakaPlayer = await this.load(
      videoElement,
      activeItem.getPlaybackSource(),
      committedPlaybackDecision,
    );
  }

  /**
   * @brief Observe the first visually rendered frame for the current video load
   *
   * Browsers that support `requestVideoFrameCallback()` can report when a
   * frame has actually been presented. Older engines fall back to `loadeddata`,
   * which is the closest practical signal that the first frame is displayable.
   *
   * @param videoElement - DOM video element used for background playback
   */
  private installFirstRenderedFrameObserver(
    videoElement: HTMLVideoElement,
  ): void {
    const hasVideoFrameCallbackApi: boolean =
      "requestVideoFrameCallback" in videoElement;

    if (hasVideoFrameCallbackApi) {
      const listenForRenderedFrame = (): void => {
        (
          videoElement as HTMLVideoElement & {
            requestVideoFrameCallback(callback: () => void): number;
          }
        ).requestVideoFrameCallback((): void => {
          this.playbackVisualReadinessController.markVisualReady();
        });
      };

      videoElement.addEventListener("loadeddata", listenForRenderedFrame, {
        once: true,
      });
      return;
    }

    videoElement.addEventListener(
      "loadeddata",
      (): void => {
        this.playbackVisualReadinessController.markVisualReady();
      },
      {
        once: true,
      },
    );
  }

  /**
   * @brief Load the shared HLS stream into the runtime-specific player path
   *
   * @param videoElement - DOM video element used for background playback
   *
   * @returns Active Shaka player when the fallback path is used
   */
  private async load(
    videoElement: HTMLVideoElement,
    playbackSource: PlaybackSource,
    committedPlaybackDecision: CommittedPlaybackDecision | null,
  ): Promise<ShakaPlayer | null> {
    const playbackPolicy: BackgroundVideoPlaybackPolicy = this.backgroundLayer
      .getBackgroundVideo()
      .getPlaybackPolicy();
    const playbackMimeType: string =
      playbackSource.mimeType ?? "application/x-mpegURL";
    const canUseNativeHlsPlayback: boolean =
      videoElement.canPlayType(playbackMimeType) !== "";
    const preferredCommittedLane: string | null =
      committedPlaybackDecision?.chosenLane ?? null;
    const shouldUseShaka: boolean =
      preferredCommittedLane === "shaka" ||
      (preferredCommittedLane !== "native" && !canUseNativeHlsPlayback);

    if (!shouldUseShaka && canUseNativeHlsPlayback) {
      videoElement.src = playbackSource.url;
      videoElement.addEventListener(
        "loadedmetadata",
        (): void => {
          void this.attemptAutoplay(
            videoElement,
            playbackPolicy,
            committedPlaybackDecision,
          );
        },
        { once: true },
      );
      videoElement.load();

      return null;
    }

    // Load Shaka only when native HLS playback is unavailable so the initial
    // browser demo stays as small as possible.
    const shakaModule: { default: ShakaModule } =
      await import("shaka-player/dist/shaka-player.compiled.js");
    const shaka: ShakaModule = shakaModule.default;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      console.error("Shaka Player is not supported in this browser.");
      return null;
    }

    const shakaPlayer: ShakaPlayer = new shaka.Player(videoElement);

    try {
      await shakaPlayer.load(playbackSource.url);
      await this.attemptAutoplay(
        videoElement,
        playbackPolicy,
        committedPlaybackDecision,
      );
    } catch (error: unknown) {
      console.error("Failed to load the shared demo stream.", error);
    }

    return shakaPlayer;
  }

  /**
   * @brief Destroy the active Shaka player before switching background lanes
   */
  private async destroyActiveShakaPlayer(): Promise<void> {
    if (this.activeShakaPlayer === null) {
      return;
    }

    const shakaPlayer: ShakaPlayer = this.activeShakaPlayer;

    this.activeShakaPlayer = null;
    await shakaPlayer.destroy();
  }

  /**
   * @brief Resolve whether committed background playback should be muted
   *
   * @param playbackPolicy - Shared background playback policy
   * @param committedPlaybackDecision - Current committed playback decision
   *
   * @returns `true` when the background player should be muted
   */
  private resolveMutedState(
    playbackPolicy: BackgroundVideoPlaybackPolicy,
    committedPlaybackDecision: CommittedPlaybackDecision | null,
  ): boolean {
    return committedPlaybackDecision?.audioActivationMode === undefined ||
      committedPlaybackDecision.audioActivationMode === "muted-preview"
      ? playbackPolicy.muted
      : false;
  }
}
