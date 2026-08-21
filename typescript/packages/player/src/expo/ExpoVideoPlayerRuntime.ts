/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { createVideoPlayer } from "expo-video";

import type { VideoPlayerLoadRequest } from "../core/VideoPlayerLoadRequest";
import type {
  VideoPlayerRuntime,
  VideoPlayerRuntimeEvent,
  VideoPlayerRuntimeListener,
} from "../core/VideoPlayerRuntime";
import type { VideoDisplayBounds } from "../dom/IVideoElement";
import type { ExpoVideoPlayerViewProps } from "./ExpoVideoPlayerViewProps";
import type {
  ExpoVideoPlayerPrimitive,
  ExpoVideoPlayerWithEvents,
} from "./ExpoVideoPrimitives";
import { ExpoVideoSourceFactory } from "./ExpoVideoSourceFactory";

type ExpoVideoPlayerRuntimeOptions = {
  readonly loop: boolean;
};

/**
 * @brief Expo runtime backed by the `expo-video` player primitive
 *
 * The shared `VideoPlayer` still owns the lifecycle and event model. This
 * runtime owns the native Expo primitive and the `VideoView` bridge props that
 * will be consumed when the mobile app is wired over.
 */
export class ExpoVideoPlayerRuntime implements VideoPlayerRuntime {
  private readonly listeners: Set<VideoPlayerRuntimeListener>;
  private readonly player: ExpoVideoPlayerPrimitive;
  private readonly sourceFactory: ExpoVideoSourceFactory;
  private readonly videoViewProps: ExpoVideoPlayerViewProps & {
    readonly player: ExpoVideoPlayerPrimitive;
  };
  private currentSourceKey: string | null;
  private hasReportedFirstFrameForCurrentLoad: boolean;
  private pendingSourceKey: string | null;

  /**
   * @brief Build one Expo runtime around its native playback primitive
   */
  public constructor(options: ExpoVideoPlayerRuntimeOptions) {
    this.listeners = new Set<VideoPlayerRuntimeListener>();
    this.player = createVideoPlayer(null);
    this.player.loop = options.loop;
    this.sourceFactory = new ExpoVideoSourceFactory();
    this.videoViewProps = {
      onFirstFrameRender: (): void => {
        this.handleFirstFrameRender();
      },
      player: this.player,
    };
    this.currentSourceKey = null;
    this.hasReportedFirstFrameForCurrentLoad = false;
    this.pendingSourceKey = null;
    this.attachPlayerListeners();
  }

  /**
   * @brief Prepare the Expo runtime for presentation
   */
  public initialize(): void {
    return;
  }

  /**
   * @brief Ignore display bounds because Expo layout is view-driven
   *
   * @param displayBounds - Optional fitted stage bounds
   */
  public setDisplayBounds(displayBounds: VideoDisplayBounds | null): void {
    void displayBounds;
  }

  /**
   * @brief Load one normalized source into the Expo primitive
   *
   * @param source - Shared player load request
   *
   * @returns Promise that resolves after the source has been prepared
   */
  public async load(source: VideoPlayerLoadRequest): Promise<void> {
    const nextSourceKey: string = this.getSourceKey(source);

    if (
      this.currentSourceKey === nextSourceKey ||
      this.pendingSourceKey === nextSourceKey
    ) {
      return;
    }

    this.hasReportedFirstFrameForCurrentLoad = false;
    this.pendingSourceKey = nextSourceKey;

    try {
      await this.player.replaceAsync(this.sourceFactory.createSource(source));
      this.currentSourceKey = nextSourceKey;
    } catch (error: unknown) {
      if (this.shouldIgnoreSupersededLoadAbort(error, nextSourceKey)) {
        return;
      }

      throw error;
    } finally {
      if (this.pendingSourceKey === nextSourceKey) {
        this.pendingSourceKey = null;
      }
    }
  }

  /**
   * @brief Request playback from the Expo primitive
   *
   * @returns Promise that resolves after playback has been requested
   */
  public play(): Promise<void> {
    return Promise.resolve(this.player.play());
  }

  /**
   * @brief Pause Expo playback
   */
  public pause(): void {
    this.player.pause();
  }

  /**
   * @brief Apply one mute state to the Expo primitive
   *
   * @param muted - Whether playback should remain muted
   */
  public setMuted(muted: boolean): void {
    this.player.muted = muted;
  }

  /**
   * @brief Apply one output volume to the Expo primitive
   *
   * @param volume - Target volume in the inclusive range [0, 1]
   */
  public setVolume(volume: number): void {
    this.player.volume = volume;
  }

  /**
   * @brief Tear down the Expo primitive without touching app wiring
   *
   * @returns Promise that resolves after teardown completes
   */
  public destroy(): Promise<void> {
    this.currentSourceKey = null;
    this.hasReportedFirstFrameForCurrentLoad = false;
    this.pendingSourceKey = null;
    this.player.pause();
    this.player.replace(null);

    return Promise.resolve();
  }

  /**
   * @brief Subscribe to Expo runtime lifecycle events
   *
   * @param listener - Callback that receives runtime events
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: VideoPlayerRuntimeListener): () => void {
    this.listeners.add(listener);

    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @brief Return the shared `VideoView` props owned by this runtime
   *
   * @returns Expo `VideoView` props that bind the shared player
   */
  public getVideoViewProps(): ExpoVideoPlayerViewProps & {
    readonly player: ExpoVideoPlayerPrimitive;
  } {
    return this.videoViewProps;
  }

  /**
   * @brief Build one stable identity for Expo source reuse checks
   *
   * @param source - Shared player load request
   *
   * @returns Stable source identity for Expo runtime reload guards
   */
  private getSourceKey(source: VideoPlayerLoadRequest): string {
    return `${source.url}::${source.mimeType ?? "auto"}`;
  }

  /**
   * @brief Ignore aborts that only indicate a newer load superseded this one
   *
   * @param error - Runtime load failure raised by Expo
   * @param sourceKey - Source key associated with the rejected load
   *
   * @returns `true` when the abort was caused by a newer Expo load request
   */
  private shouldIgnoreSupersededLoadAbort(
    error: unknown,
    sourceKey: string,
  ): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorName: string = error.name;
    const errorMessage: string = error.message;
    const wasSupersededByNewerLoad: boolean =
      this.pendingSourceKey !== null && this.pendingSourceKey !== sourceKey;

    return (
      wasSupersededByNewerLoad &&
      errorName === "AbortError" &&
      errorMessage.includes("interrupted by a new load request")
    );
  }

  /**
   * @brief Bind runtime events from the Expo player primitive
   */
  private attachPlayerListeners(): void {
    const eventfulPlayer: ExpoVideoPlayerWithEvents = this
      .player as ExpoVideoPlayerWithEvents;

    eventfulPlayer.addListener(
      "playingChange",
      ({ isPlaying }: { readonly isPlaying: boolean }): void => {
        this.emit({
          type: isPlaying ? "playing" : "paused",
        });
      },
    );
    eventfulPlayer.addListener(
      "statusChange",
      ({
        error,
        status,
      }: {
        readonly error?: {
          readonly message?: string;
        };
        readonly status: string;
      }): void => {
        if (status !== "error") {
          return;
        }

        this.emit({
          type: "error",
          error: new Error(
            error?.message ?? "Expo video reported an unknown error.",
          ),
        });
      },
    );
  }

  /**
   * @brief Forward the first rendered Expo frame exactly once per load
   */
  private handleFirstFrameRender(): void {
    if (this.hasReportedFirstFrameForCurrentLoad) {
      return;
    }

    this.hasReportedFirstFrameForCurrentLoad = true;
    this.emit({
      type: "first-frame-ready",
    });
  }

  /**
   * @brief Forward one runtime event to all subscribers
   *
   * @param event - Runtime event to forward
   */
  private emit(event: VideoPlayerRuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
