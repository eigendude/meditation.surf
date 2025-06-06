/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { Ads, Lightning, Log, Settings, VideoPlayer } from "@lightningjs/sdk";
import { initSettings } from "@lightningjs/sdk/src/Settings";
import { initLightningSdkPlugin } from "@metrological/sdk";
import Hls from "hls.js";

/**
 * Wrapper holding a reference to the Lightning SDK VideoPlayer.
 * This module initializes the VideoPlayer once and exposes it
 * so that app instances can access the same underlying resources
 * even when the application is recreated.
 */
class VideoPlayerState {
  /** Global VideoPlayer instance from the Lightning SDK. */
  public readonly videoPlayer: typeof VideoPlayer;

  /** Active hls.js instance or `null` when not using hls.js. */
  private hls: Hls | null;

  /** URL of the demo video used for testing playback. */
  private static readonly DEMO_URL: string =
    "https://stream.mux.com/7YtWnCpXIt014uMcBK65ZjGfnScdcAneU9TjM9nGAJhk.m3u8";

  /** True after the video player has been configured. */
  private initialized: boolean;

  /** True after the demo video has been opened. */
  private opened: boolean;

  /** Lightning application instance provided after launch. */
  private appInstance: unknown | null;

  constructor() {
    // The VideoPlayer plugin sets up its video tag only once.
    this.videoPlayer = VideoPlayer;
    this.hls = null as Hls | null;
    this.initialized = false as boolean;
    this.appInstance = null as unknown | null;
    this.opened = false as boolean;
  }

  /**
   * Register a Lightning component to receive VideoPlayer events.
   *
   * @param app - Root Lightning application instance.
   */
  public setAppInstance(app: unknown | null): void {
    this.appInstance = app;
    if (app === null) {
      initLightningSdkPlugin.appInstance = undefined as unknown as undefined;
      return;
    }
    initLightningSdkPlugin.appInstance = app as unknown;
    const component: any = app as any;
    if (component.fire === undefined && component.$emit !== undefined) {
      component.fire = (eventName: string, ...args: unknown[]): void => {
        component.$emit(eventName, ...args);
      };
    }
    if (this.initialized) {
      this.videoPlayer.consumer(component);
    }
  }

  /**
   * Retrieve the Lightning application instance currently registered with the
   * video player.
   *
   * @returns The active Lightning application or `null` if none is set.
   */
  public getAppInstance(): unknown | null {
    return this.appInstance;
  }

  /**
   * Clear the reference to the current Lightning application instance.
   * This prevents stale objects from being reused after the app quits.
   */
  public clearAppInstance(): void {
    this.appInstance = null as unknown | null;
    initLightningSdkPlugin.appInstance = undefined as unknown as undefined;
  }

  /**
   * Log whether the video element is present in the DOM. This aids debugging
   * scenarios where the Lightning SDK fails to create its `<video>` element.
   */
  private logVideoElement(): void {
    const element: HTMLVideoElement | null = document.querySelector("video");
    if (element === null) {
      console.debug("Video element not found in DOM");
    } else {
      console.debug("Video element present in DOM");
    }
  }

  /**
   * Configure the shared VideoPlayer instance if it has not been initialized.
   *
   * @param width - Width of the viewport in pixels.
   * @param height - Height of the viewport in pixels.
   */
  public initialize(width: number, height: number): void {
    console.debug(
      `VideoPlayerState.initialize: width=${width} height=${height}`,
    );

    if (this.appInstance === null) {
      console.warn(
        "VideoPlayerState.initialize skipped: no app instance provided",
      );
      return;
    }

    // Lazily initialize the plugin by configuring the SDK on first use.
    if (!this.initialized) {
      // The plugin needs Settings, Logging, and the Lightning instance.
      // Disable texture mode because Blits does not expose the old Lightning
      // Application APIs required by the VideoTexture integration.
      initSettings({}, { width, height, textureMode: false });
      initLightningSdkPlugin.log = Log;
      initLightningSdkPlugin.settings = Settings;
      initLightningSdkPlugin.ads = Ads;
      initLightningSdkPlugin.lightning = Lightning;
      if (this.appInstance !== null) {
        initLightningSdkPlugin.appInstance = this.appInstance as unknown;
        this.videoPlayer.consumer(this.appInstance as any);
      } else {
        console.warn(
          "VideoPlayerState.initialize called without an app instance",
        );
      }

      // Trigger the plugin's setup routine so the `<video>` element is created.
      this.videoPlayer.hide();
      // Always use hls.js for HLS playback rather than relying on native
      // browser support. If hls.js is not supported, playback will not start.
      this.videoPlayer.loader(
        (url: string, videoEl: HTMLVideoElement): Promise<void> => {
          return new Promise((resolve: () => void): void => {
            if (!Hls.isSupported()) {
              console.error("hls.js is not supported in this browser");
              resolve();
              return;
            }

            this.hls = new Hls();
            this.hls.on(Hls.Events.MEDIA_ATTACHED, (): void => {
              this.hls?.loadSource(url);
              resolve();
            });
            this.hls.attachMedia(videoEl);
          });
        },
      );

      // Tear down hls.js instances to keep resources clean.
      this.videoPlayer.unloader((videoEl: HTMLVideoElement): Promise<void> => {
        return new Promise((resolve: () => void): void => {
          if (this.hls !== null) {
            this.hls.destroy();
            this.hls = null as Hls | null;
          }
          videoEl.removeAttribute("src");
          videoEl.load();
          resolve();
        });
      });
      this.logVideoElement();
      console.debug("VideoPlayer plugin initialized");
      this.initialized = true as boolean;
    }

    // Ensure the SDK's `<video>` tag is attached to the DOM
    const videoElement: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (videoElement !== undefined) {
      // Ensure the tag is attached before configuring playback.
      if (!videoElement.isConnected) {
        document.body.appendChild(videoElement);
      }

      // Allow cross-origin playback and configure autoplay settings.
      videoElement.setAttribute("crossorigin", "anonymous");
      videoElement.setAttribute("muted", "");
      videoElement.setAttribute("autoplay", "");
      videoElement.setAttribute("playsinline", "");
      videoElement.muted = true;

      // Fill the viewport while maintaining aspect ratio
      videoElement.style.objectFit = "cover";
    }

    // Ensure the video covers the viewport
    this.videoPlayer.position(0, 0);
    this.videoPlayer.size(width, height);

    this.videoPlayer.show();
    console.debug("VideoPlayer shown on stage");

    // Load and play the demo video the first time initialization runs.
    if (!this.opened) {
      const url: string = VideoPlayerState.DEMO_URL;
      this.videoPlayer.mute(true);
      this.videoPlayer.open(url);

      // Attempt to start playback immediately so the demo video begins
      // without requiring user interaction. Falling back to the SDK's
      // play() helper increases compatibility with older browsers.
      const playerEl: HTMLVideoElement | undefined = (this.videoPlayer as any)
        ._videoEl;
      if (playerEl !== undefined) {
        playerEl.play().catch((err: unknown): void => {
          console.warn("Autoplay failed", err);
          this.videoPlayer.play();
        });
      } else {
        this.videoPlayer.play();
      }

      this.videoPlayer.loop(true);
      this.opened = true as boolean;
    }

    // In texture mode the plugin provides a Lightning component that must be
    // inserted into the scene graph. Because texture mode is disabled, this
    // block is kept for reference but does not run.
    if (this.appInstance !== null && Settings.get("platform", "textureMode")) {
      const texture: any = (this.appInstance as any).tag("VideoTexture");
      const container: any = (this.appInstance as any).tag("VideoBackground");
      if (texture !== undefined && container !== undefined) {
        container.childList.add(texture);
        texture.patch({ x: 0, y: 0, w: width, h: height, zIndex: 2 });
        console.debug("Video texture added to stage");
      }
    }

    this.logVideoElement();
    console.debug("VideoPlayer initialization complete");
  }
}

/** Singleton instance of the video player state. */
const videoPlayerState: VideoPlayerState = new VideoPlayerState();

export default videoPlayerState;
