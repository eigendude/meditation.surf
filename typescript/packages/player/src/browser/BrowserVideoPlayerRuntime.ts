/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoPlayerLoadRequest } from "../core/VideoPlayerLoadRequest";
import { VideoPlayerLogger } from "../core/VideoPlayerLogger";
import type {
  VideoPlayerRuntime,
  VideoPlayerRuntimeEvent,
  VideoPlayerRuntimeListener,
} from "../core/VideoPlayerRuntime";
import type { IVideoElement, VideoDisplayBounds } from "../dom/IVideoElement";
import { VideoElementController } from "../dom/VideoElementController";
import { ShakaPlayerLoader } from "../shaka/ShakaPlayerLoader";
import { FirstFrameObserver } from "../utils/FirstFrameObserver";

/**
 * @brief Browser and TV runtime backed by an HTML video element and Shaka
 */
export class BrowserVideoPlayerRuntime implements VideoPlayerRuntime {
  private readonly listeners: Set<VideoPlayerRuntimeListener>;
  private readonly videoElementController: VideoElementController;
  private readonly shakaPlayerLoader: ShakaPlayerLoader;
  private readonly firstFrameObserver: FirstFrameObserver;

  /**
   * @brief Build one browser runtime around the shared video surface adapter
   *
   * @param videoElement - Browser-specific video surface adapter
   * @param logger - Shared player logger
   */
  public constructor(videoElement: IVideoElement, logger: VideoPlayerLogger) {
    this.listeners = new Set<VideoPlayerRuntimeListener>();
    this.videoElementController = new VideoElementController(videoElement, {
      onPlaying: (): void => {
        this.emit({
          type: "playing",
        });
      },
      onPaused: (): void => {
        this.emit({
          type: "paused",
        });
      },
      onError: (error: Error): void => {
        this.emit({
          type: "error",
          error,
        });
      },
    });
    this.shakaPlayerLoader = new ShakaPlayerLoader(logger, {
      onError: (error: Error): void => {
        this.emit({
          type: "error",
          error,
        });
      },
    });
    this.firstFrameObserver = new FirstFrameObserver();
  }

  /**
   * @brief Prepare the shared browser video surface
   */
  public initialize(): void {
    this.videoElementController.show();
  }

  /**
   * @brief Apply fitted display bounds to the browser video element
   *
   * @param displayBounds - Optional fitted stage bounds
   */
  public setDisplayBounds(displayBounds: VideoDisplayBounds | null): void {
    this.videoElementController.applyDisplayBounds(displayBounds);
  }

  /**
   * @brief Load one source through the browser runtime
   *
   * @param source - Shared player load request
   *
   * @returns Promise that resolves after the source has been prepared
   */
  public async load(source: VideoPlayerLoadRequest): Promise<void> {
    const videoElement: HTMLVideoElement =
      this.videoElementController.getVideoElement();

    this.firstFrameObserver.prepareForNextLoad();
    await this.shakaPlayerLoader.destroy();
    this.videoElementController.reset();
    this.firstFrameObserver.observe(videoElement, (): void => {
      this.emit({
        type: "first-frame-ready",
      });
    });

    await this.shakaPlayerLoader.load(videoElement, source);
  }

  /**
   * @brief Request playback from the browser primitive
   *
   * @returns Promise that resolves after playback has been requested
   */
  public async play(): Promise<void> {
    const videoElement: HTMLVideoElement =
      this.videoElementController.getVideoElement();

    await videoElement.play();
  }

  /**
   * @brief Pause browser playback
   */
  public pause(): void {
    const videoElement: HTMLVideoElement =
      this.videoElementController.getVideoElement();

    videoElement.pause();
  }

  /**
   * @brief Apply one mute state to the browser primitive
   *
   * @param muted - Whether playback should remain muted
   */
  public setMuted(muted: boolean): void {
    this.videoElementController.setMuted(muted);
  }

  /**
   * @brief Apply one output volume to the browser primitive
   *
   * @param volume - Target volume in the inclusive range [0, 1]
   */
  public setVolume(volume: number): void {
    this.videoElementController.setVolume(volume);
  }

  /**
   * @brief Tear down browser playback resources
   *
   * @returns Promise that resolves after teardown completes
   */
  public async destroy(): Promise<void> {
    const videoElement: HTMLVideoElement =
      this.videoElementController.getVideoElement();

    this.firstFrameObserver.clear();
    videoElement.pause();
    this.videoElementController.reset();
    this.videoElementController.hide();
    await this.shakaPlayerLoader.destroy();
  }

  /**
   * @brief Subscribe to browser runtime lifecycle events
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
