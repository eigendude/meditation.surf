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
/* global shaka */

/**
 * Wrapper holding a reference to the Lightning SDK VideoPlayer.
 * This module initializes the VideoPlayer once and exposes it
 * so that app instances can access the same underlying resources
 * even when the application is recreated.
 */
export class VideoPlayerState {
  /** Global VideoPlayer instance from the Lightning SDK. */
  public readonly videoPlayer: typeof VideoPlayer;

  /** Active Shaka Player instance or `null` when not using Shaka. */
  private shakaPlayer: shaka.Player | null;

  /** URL of the demo video used for testing playback. */
  public static readonly DEMO_URL: string =
    "https://stream.mux.com/7YtWnCpXIt014uMcBK65ZjGfnScdcAneU9TjM9nGAJhk.m3u8";

  /** True after the video player has been configured. */
  private initialized: boolean;

  /** URL currently loaded by the video player, if any. */
  private currentUrl: string | null;

  /** Lightning application instance provided after launch. */
  private appInstance: unknown | null;

  constructor() {
    // The VideoPlayer plugin sets up its video tag only once.
    this.videoPlayer = VideoPlayer;
    this.shakaPlayer = null as shaka.Player | null;
    this.initialized = false as boolean;
    this.appInstance = null as unknown | null;
    this.currentUrl = null as string | null;
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
      // Always use Shaka Player for HLS playback rather than relying on native
      // browser support. If Shaka is not supported, playback will not start.
      this.videoPlayer.loader(
        (url: string, videoEl: HTMLVideoElement): Promise<void> => {
          return new Promise((resolve: () => void): void => {
            void import("shaka-player/dist/shaka-player.compiled.js").then(
              (module: { default: typeof shaka }): void => {
                const shakaLib: typeof shaka = module.default;
                shakaLib.polyfill.installAll();
                if (!shakaLib.Player.isBrowserSupported()) {
                  console.error(
                    "Shaka Player is not supported in this browser",
                  );
                  resolve();
                  return;
                }

                this.shakaPlayer = new shakaLib.Player(videoEl);
                this.shakaPlayer
                  .load(url)
                  .then((): void => {
                    resolve();
                  })
                  .catch((error: unknown): void => {
                    console.error("Failed to load stream with Shaka", error);
                    resolve();
                  });
              },
            );
          });
        },
      );

      // Tear down Shaka Player instances to keep resources clean.
      this.videoPlayer.unloader((videoEl: HTMLVideoElement): Promise<void> => {
        return new Promise((resolve: () => void): void => {
          if (this.shakaPlayer !== null) {
            this.shakaPlayer.destroy().catch((err: unknown): void => {
              console.error("Failed to destroy Shaka Player", err);
            });
            this.shakaPlayer = null as shaka.Player | null;
          }
          videoEl.removeAttribute("src");
          videoEl.load();
          resolve();
        });
      });
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
      videoElement.setAttribute("controls", "");
      videoElement.muted = true;
      videoElement.controls = true;

      // Fill the viewport while maintaining aspect ratio
      videoElement.style.objectFit = "cover";
    }

    // Ensure the video covers the viewport
    this.videoPlayer.position(0, 0);
    this.videoPlayer.size(width, height);

    this.videoPlayer.show();
    console.debug("VideoPlayer shown on stage");

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

    console.debug("VideoPlayer initialization complete");
  }

  /**
   * Open a video URL using Shaka Player and begin playback.
   *
   * This helper attempts to start playback immediately to satisfy browsers
   * that require direct user interaction.
   *
   * @param url - Media URL to play.
   */
  public playUrl(url: string): void {
    // Avoid reloading the same URL to prevent Shaka errors on app reload.
    if (this.currentUrl === url) {
      this.videoPlayer.play();
      return;
    }

    this.videoPlayer.mute(true);
    this.videoPlayer.open(url);
    this.currentUrl = url;

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
  }

  /**
   * Unmute the video player so audio can be heard.
   */
  public unmute(): void {
    this.videoPlayer.mute(false);

    const videoElement: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (videoElement !== undefined) {
      videoElement.muted = false;
      videoElement.removeAttribute("muted");
    }
  }
}

/** Singleton instance of the video player state. */
const videoPlayerState: VideoPlayerState = new VideoPlayerState();

export default videoPlayerState;
