/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { BrowserVideoPlayerRuntime } from "../browser/BrowserVideoPlayerRuntime";
import type { IVideoElement, VideoDisplayBounds } from "../dom/IVideoElement";
import type {
  VideoPlayerEvent,
  VideoPlayerEventType,
  VideoPlayerListener,
} from "./VideoPlayerEvent";
import { VideoPlayerLoadRequest } from "./VideoPlayerLoadRequest";
import { VideoPlayerLogger } from "./VideoPlayerLogger";
import type {
  VideoPlayerRuntime,
  VideoPlayerRuntimeEvent,
} from "./VideoPlayerRuntime";
import type { VideoPlayerState, VideoPlayerStatus } from "./VideoPlayerState";
import type { VideoSource } from "./VideoSource";

type VideoPlayerElementOptions = {
  readonly runtime?: never;
  readonly videoElement: IVideoElement;
};

type VideoPlayerRuntimeOptions = {
  readonly runtime: VideoPlayerRuntime;
  readonly videoElement?: never;
};

type VideoPlayerOptions = VideoPlayerElementOptions | VideoPlayerRuntimeOptions;

/**
 * @brief Thin reusable video player for app-managed playback surfaces
 *
 * This player owns one video element, one source at a time, and a
 * deliberately small state machine centered on first-frame readiness.
 */
export class VideoPlayer {
  private static readonly DEFAULT_VOLUME: number = 1;

  private readonly logger: VideoPlayerLogger;
  private readonly listeners: Set<VideoPlayerListener>;
  private readonly runtime: VideoPlayerRuntime;
  private initialized: boolean;
  private currentSource: VideoPlayerLoadRequest | null;
  private state: VideoPlayerState;
  private displayBounds: VideoDisplayBounds | null;
  private hasSeenFirstFrame: boolean;
  private hasSeenPlaying: boolean;

  /**
   * @brief Create the video player in its idle state
   *
   * @param options - Required playback runtime or browser video element adapter
   */
  public constructor(options: VideoPlayerOptions) {
    this.logger = new VideoPlayerLogger();
    this.listeners = new Set<VideoPlayerListener>();
    this.runtime = this.createRuntime(options);
    this.runtime.subscribe((event: VideoPlayerRuntimeEvent): void => {
      this.handleRuntimeEvent(event);
    });
    this.initialized = false;
    this.currentSource = null;
    this.state = {
      status: "idle",
      sourceUrl: null,
      error: null,
    };
    this.displayBounds = null;
    this.hasSeenFirstFrame = false;
    this.hasSeenPlaying = false;
  }

  /**
   * @brief Prepare the shared video element
   */
  public initialize(): void {
    if (!this.initialized) {
      this.setMuted(true);
      this.setVolume(VideoPlayer.DEFAULT_VOLUME);
      this.initialized = true;
    }

    this.runtime.initialize();
    this.runtime.setDisplayBounds(this.displayBounds);
  }

  /**
   * @brief Return the current video-player state snapshot
   *
   * @returns Current state snapshot
   */
  public getState(): VideoPlayerState {
    return this.state;
  }

  /**
   * @brief Subscribe to video-player events
   *
   * @param listener - Callback that receives lifecycle events
   *
   * @returns Cleanup callback that removes the listener
   */
  public subscribe(listener: VideoPlayerListener): () => void {
    this.listeners.add(listener);

    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @brief Update the fitted viewport bounds used by the video surface
   *
   * @param left - Left edge in CSS pixels
   * @param top - Top edge in CSS pixels
   * @param width - Width in CSS pixels
   * @param height - Height in CSS pixels
   */
  public setDisplayBounds(
    left: number,
    top: number,
    width: number,
    height: number,
  ): void {
    this.displayBounds = {
      left,
      top,
      width,
      height,
    };
    this.runtime.setDisplayBounds(this.displayBounds);
  }

  /**
   * @brief Load one video source without starting playback automatically
   *
   * @param source - Player-local video source or direct source URL
   *
   * @returns Promise that resolves after the source has been prepared
   */
  public async load(source: VideoSource | string): Promise<void> {
    const normalizedSource: VideoPlayerLoadRequest =
      VideoPlayerLoadRequest.fromSource(source);

    if (this.currentSource?.url === normalizedSource.url) {
      this.logger.log("Source loaded (reused)", normalizedSource.url);
      return;
    }

    this.logger.log("Source loaded", normalizedSource.url);

    this.currentSource = normalizedSource;
    this.hasSeenFirstFrame = false;
    this.hasSeenPlaying = false;
    this.transitionTo("loading", null, normalizedSource.url);
    this.emit("loading-started");

    try {
      await this.runtime.load(normalizedSource);
    } catch (error: unknown) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * @brief Start or resume video playback
   *
   * @returns Promise that resolves once playback has been requested
   */
  public async play(): Promise<void> {
    this.logger.log("Play requested", this.currentSource?.url ?? "<none>");

    try {
      await this.runtime.play();
    } catch (error: unknown) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * @brief Pause video playback
   */
  public pause(): void {
    this.runtime.pause();
  }

  /**
   * @brief Apply the mute state to the video element
   *
   * @param muted - Whether the player should remain muted
   */
  public setMuted(muted: boolean): void {
    this.runtime.setMuted(muted);
  }

  /**
   * @brief Apply the output volume to the video element
   *
   * @param volume - Target volume in the inclusive range [0, 1]
   */
  public setVolume(volume: number): void {
    const clampedVolume: number = VideoPlayer.clampVolume(volume);

    this.runtime.setVolume(clampedVolume);
  }

  /**
   * @brief Tear down video playback resources
   *
   * @returns Promise that resolves after teardown completes
   */
  public async destroy(): Promise<void> {
    this.currentSource = null;
    await this.runtime.destroy();
    this.transitionTo("idle", null, null);
  }

  /**
   * @brief Build the active playback runtime for one shared player instance
   *
   * @param options - Caller-provided runtime or browser video surface
   *
   * @returns Active playback runtime
   */
  private createRuntime(options: VideoPlayerOptions): VideoPlayerRuntime {
    if ("runtime" in options && options.runtime !== undefined) {
      return options.runtime;
    }

    if ("videoElement" in options && options.videoElement !== undefined) {
      return new BrowserVideoPlayerRuntime(options.videoElement, this.logger);
    }

    throw new Error(
      "A runtime or video element is required to create a VideoPlayer.",
    );
  }

  /**
   * @brief Route one runtime lifecycle event into the shared player state
   *
   * @param event - Runtime event to process
   */
  private handleRuntimeEvent(event: VideoPlayerRuntimeEvent): void {
    switch (event.type) {
      case "first-frame-ready":
        this.handleFirstFrameReady();
        return;
      case "playing":
        this.handlePlaying();
        return;
      case "paused":
        this.handlePaused();
        return;
      case "error":
        this.handleError(event.error);
        return;
    }
  }

  /**
   * @brief Clamp a volume value into the runtime-supported range
   *
   * @param volume - Candidate playback volume
   *
   * @returns Volume clamped to the inclusive range [0, 1]
   */
  private static clampVolume(volume: number): number {
    return Math.min(Math.max(volume, 0), 1);
  }

  /**
   * @brief Transition into the first-frame-ready state exactly once per load
   */
  private handleFirstFrameReady(): void {
    if (this.hasSeenFirstFrame) {
      return;
    }

    this.hasSeenFirstFrame = true;
    this.logger.log("First frame ready", this.currentSource?.url ?? "<none>");
    this.transitionTo(
      "first-frame-ready",
      null,
      this.currentSource?.url ?? null,
    );
    this.emit("first-frame-ready");

    if (this.hasSeenPlaying) {
      this.transitionTo("playing", null, this.currentSource?.url ?? null);
      this.emit("playback-started");
    }
  }

  /**
   * @brief Handle active playback becoming audible and advancing
   */
  private handlePlaying(): void {
    this.hasSeenPlaying = true;
    this.logger.log("Playing", this.currentSource?.url ?? "<none>");

    if (!this.hasSeenFirstFrame) {
      return;
    }

    this.transitionTo("playing", null, this.currentSource?.url ?? null);
    this.emit("playback-started");
  }

  /**
   * @brief Handle the video player entering a paused state
   */
  private handlePaused(): void {
    if (
      this.state.status === "idle" ||
      this.state.status === "loading" ||
      this.state.status === "error"
    ) {
      return;
    }

    this.logger.log("Paused", this.currentSource?.url ?? "<none>");
    this.transitionTo("paused", null, this.currentSource?.url ?? null);
    this.emit("playback-paused");
  }

  /**
   * @brief Convert unknown runtime failures into one stable error path
   *
   * @param error - Runtime failure raised by the active playback path
   */
  private handleError(error: unknown): void {
    const normalizedError: Error =
      error instanceof Error ? error : new Error(String(error));

    this.logger.logError("error", normalizedError);
    this.transitionTo(
      "error",
      normalizedError,
      this.currentSource?.url ?? null,
    );
    this.emit("error", normalizedError);
  }

  /**
   * @brief Apply one state transition when it materially changes the state
   *
   * @param status - Next player status
   * @param error - Optional associated error
   * @param sourceUrl - Source associated with the next state
   */
  private transitionTo(
    status: VideoPlayerStatus,
    error: Error | null,
    sourceUrl: string | null,
  ): void {
    if (
      this.state.status === status &&
      this.state.error === error &&
      this.state.sourceUrl === sourceUrl
    ) {
      return;
    }

    this.state = {
      status,
      sourceUrl,
      error,
    };
  }

  /**
   * @brief Emit one typed lifecycle event to all subscribers
   *
   * @param type - Event name to publish
   * @param error - Optional associated error
   */
  private emit(type: VideoPlayerEventType, error: Error | null = null): void {
    const event: VideoPlayerEvent = {
      type,
      state: this.state,
      error,
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
