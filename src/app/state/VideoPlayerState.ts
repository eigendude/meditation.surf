/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { Ads, Lightning, Log, Settings, VideoPlayer } from "@lightningjs/sdk";
import { initLightningSdkPlugin } from "@metrological/sdk";
import type shaka from "shaka-player/dist/shaka-player.compiled.js";

import AudioState from "./AudioState";

type ShakaModule = typeof shaka;
type ShakaPlayer = InstanceType<ShakaModule["Player"]>;
type SettingsCategory = "app" | "platform" | "user";
type SettingsValue = Record<string, unknown>;
type SettingsSubscriber = (err: unknown) => void;
type DisplayBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Populate the public Lightning Settings API without importing the SDK's
 * internal `src/Settings` module path, which is no longer a stable bundling
 * target under Vite.
 */
const initializeLightningSettings = (
  appSettings: SettingsValue,
  platformSettings: SettingsValue,
): void => {
  const settingsStore: Record<SettingsCategory, SettingsValue> = {
    app: appSettings,
    platform: platformSettings,
    user: {},
  };
  const subscribers: Record<string, SettingsSubscriber[]> = {};

  const getValueFromPath = (
    sourceObject: unknown,
    keyPath: string,
  ): unknown => {
    if (sourceObject === null || sourceObject === undefined) {
      return undefined;
    }

    let currentValue: unknown = sourceObject;
    const pathSegments: string[] = keyPath.split(".");

    for (const pathSegment of pathSegments) {
      if (
        currentValue === null ||
        currentValue === undefined ||
        typeof currentValue !== "object"
      ) {
        return undefined;
      }

      currentValue = (currentValue as Record<string, unknown>)[pathSegment];
    }

    if (
      currentValue !== null &&
      typeof currentValue === "object" &&
      Object.keys(currentValue as Record<string, unknown>).length === 0
    ) {
      return undefined;
    }

    return currentValue;
  };

  Settings.get = (
    type: SettingsCategory,
    key: string,
    fallback?: unknown,
  ): unknown => {
    const value: unknown = getValueFromPath(settingsStore[type], key);
    return value !== undefined ? value : fallback;
  };

  Settings.has = (type: SettingsCategory, key: string): boolean => {
    return Settings.get(type, key) !== undefined;
  };

  Settings.set = (key: string, value: unknown): void => {
    settingsStore.user[key] = value;
    for (const subscriber of subscribers[key] ?? []) {
      subscriber(value);
    }
  };

  Settings.subscribe = (key: string, callback: SettingsSubscriber): void => {
    subscribers[key] ??= [];
    subscribers[key].push(callback);
  };

  Settings.unsubscribe = (key: string, callback?: SettingsSubscriber): void => {
    if (callback === undefined) {
      subscribers[key] = [];
      return;
    }

    subscribers[key] = (subscribers[key] ?? []).filter(
      (subscriber: SettingsSubscriber): boolean => subscriber !== callback,
    );
  };

  Settings.clearSubscribers = (): void => {
    for (const key of Object.keys(subscribers)) {
      delete subscribers[key];
    }
  };
};

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
  private shakaPlayer: ShakaPlayer | null;

  /** URL of the demo video used for testing playback. */
  public static readonly DEMO_URL: string =
    "https://stream.mux.com/7YtWnCpXIt014uMcBK65ZjGfnScdcAneU9TjM9nGAJhk.m3u8";

  /** True after the video player has been configured. */
  private initialized: boolean;

  /** URL currently loaded by the video player, if any. */
  private currentUrl: string | null;

  /** Lightning application instance provided after launch. */
  private appInstance: unknown | null;

  /** Boot-time DOM bounds for the displayed stage. */
  private displayBounds: DisplayBounds | null;

  constructor() {
    // The VideoPlayer plugin sets up its video tag only once.
    this.videoPlayer = VideoPlayer;
    this.shakaPlayer = null;
    this.initialized = false as boolean;
    this.appInstance = null as unknown | null;
    this.currentUrl = null as string | null;
    this.displayBounds = null as DisplayBounds | null;
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
    this.applyDisplayBounds();
  }

  private applyDisplayBounds(): void {
    if (this.displayBounds === null) {
      return;
    }

    this.videoPlayer.position(this.displayBounds.left, this.displayBounds.top);
    this.videoPlayer.size(this.displayBounds.width, this.displayBounds.height);

    const videoElement: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (videoElement === undefined) {
      return;
    }

    videoElement.style.position = "absolute";
    videoElement.style.left = `${this.displayBounds.left}px`;
    videoElement.style.top = `${this.displayBounds.top}px`;
    videoElement.style.width = `${this.displayBounds.width}px`;
    videoElement.style.height = `${this.displayBounds.height}px`;
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
      initializeLightningSettings({}, { width, height, textureMode: false });
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
              (module): void => {
                const shakaLib: ShakaModule = module.default;
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
            this.shakaPlayer = null;
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
      videoElement.setAttribute("autoplay", "");
      videoElement.setAttribute("playsinline", "");

      // Mute by default so autoplay is more likely to succeed.
      this.setMuted(true);

      // Save audio changes so user preferences persist across sessions.
      videoElement.addEventListener("volumechange", (): void => {
        AudioState.setMuted(videoElement.muted);
        AudioState.setVolume(videoElement.volume);
      });

      // Fill the viewport while maintaining aspect ratio
      videoElement.style.objectFit = "cover";
      // Ensure the video element renders behind the Lightning canvas
      videoElement.style.zIndex = "0";
    }

    this.applyDisplayBounds();
    this.videoPlayer.show();

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

    // Mute before starting playback to maximize autoplay success.
    this.setMuted(true);

    this.videoPlayer.open(url);
    this.currentUrl = url;

    const playerEl: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (playerEl !== undefined) {
      const restoreAudio: () => void = (): void => {
        const muted: boolean = AudioState.isMuted();
        const volume: number = AudioState.getVolume();
        this.setMuted(muted);
        this.setVolume(volume);
        playerEl.removeEventListener("playing", restoreAudio);
      };
      playerEl.addEventListener("playing", restoreAudio, { once: true });

      playerEl.play().catch((err: unknown): void => {
        const domException: DOMException | null =
          err instanceof DOMException ? err : null;
        if (domException === null || domException.name !== "AbortError") {
          console.warn("Autoplay failed", err);
        }
        this.videoPlayer.play();
      });
    } else {
      this.videoPlayer.play();
    }

    this.videoPlayer.loop(true);
  }

  /**
   * Apply the mute state to the underlying video element and VideoPlayer.
   *
   * @param muted - Whether the player should be muted.
   */
  public setMuted(muted: boolean): void {
    this.videoPlayer.mute(muted);

    const videoElement: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (videoElement !== undefined) {
      videoElement.muted = muted;
      if (muted) {
        videoElement.setAttribute("muted", "");
      } else {
        videoElement.removeAttribute("muted");
      }
    }
  }

  /**
   * Set the playback volume on the underlying video element.
   *
   * @param volume - Volume value in [0, 1].
   */
  public setVolume(volume: number): void {
    const videoElement: HTMLVideoElement | undefined = (this.videoPlayer as any)
      ._videoEl;
    if (videoElement !== undefined) {
      const clamped: number = Math.min(Math.max(volume, 0), 1);
      videoElement.volume = clamped;
    }
  }
}

/** Singleton instance of the video player state. */
const videoPlayerState: VideoPlayerState = new VideoPlayerState();

export default videoPlayerState;
