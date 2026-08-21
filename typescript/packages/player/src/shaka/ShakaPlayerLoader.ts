/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { VideoPlayerLoadRequest } from "../core/VideoPlayerLoadRequest";
import { VideoPlayerLogger } from "../core/VideoPlayerLogger";

type ShakaPlayer = {
  readonly addEventListener: (
    type: string,
    listener: (event: Event) => void,
  ) => void;
  readonly attach: (videoElement: HTMLVideoElement) => Promise<void>;
  readonly destroy: () => Promise<void>;
  readonly load: (url: string) => Promise<void>;
};

type ShakaPlayerConstructor = {
  new (): ShakaPlayer;
  readonly isBrowserSupported: () => boolean;
};

type ShakaModule = {
  readonly polyfill: {
    readonly installAll: () => void;
  };
  readonly Player: ShakaPlayerConstructor;
};

type ShakaImportResult = {
  readonly default: ShakaModule;
};

type ShakaPlayerLoaderHandlers = {
  readonly onError: (error: Error) => void;
};

/**
 * @brief Minimal owner for the optional Shaka playback fallback path
 */
export class ShakaPlayerLoader {
  private readonly logger: VideoPlayerLogger;
  private readonly handlers: ShakaPlayerLoaderHandlers;
  private shakaPlayer: ShakaPlayer | null;

  /**
   * @brief Build one loader around the player error path
   *
   * @param logger - Shared lifecycle logger
   * @param handlers - Error callbacks forwarded to the player
   */
  public constructor(
    logger: VideoPlayerLogger,
    handlers: ShakaPlayerLoaderHandlers,
  ) {
    this.logger = logger;
    this.handlers = handlers;
    this.shakaPlayer = null;
  }

  /**
   * @brief Load one source through the minimal Shaka fallback path
   *
   * @param videoElement - Target video element
   * @param source - Source to load
   *
   * @returns Promise that resolves once Shaka has loaded the source
   */
  public async load(
    videoElement: HTMLVideoElement,
    source: VideoPlayerLoadRequest,
  ): Promise<void> {
    this.logger.log("Shaka playback selected", source.url);

    const shakaModule: ShakaImportResult =
      await import("shaka-player/dist/shaka-player.compiled.js");
    const shakaLib: ShakaModule = shakaModule.default;

    shakaLib.polyfill.installAll();

    if (!shakaLib.Player.isBrowserSupported()) {
      throw new Error("Shaka Player is not supported in this runtime.");
    }

    const shakaPlayer: ShakaPlayer = new shakaLib.Player();

    shakaPlayer.addEventListener("error", (event: Event): void => {
      const shakaEvent: Event & {
        readonly detail?: {
          readonly code?: number;
        };
      } = event;
      const errorCode: number | string = shakaEvent.detail?.code ?? "unknown";

      this.handlers.onError(
        new Error(`Shaka Player reported code ${errorCode}.`),
      );
    });

    this.shakaPlayer = shakaPlayer;
    await shakaPlayer.attach(videoElement);
    await shakaPlayer.load(source.url);
  }

  /**
   * @brief Tear down the active Shaka player, when one exists
   *
   * @returns Promise that resolves after teardown completes
   */
  public async destroy(): Promise<void> {
    const shakaPlayer: ShakaPlayer | null = this.shakaPlayer;

    if (shakaPlayer === null) {
      return;
    }

    this.shakaPlayer = null;

    try {
      await shakaPlayer.destroy();
    } catch (error: unknown) {
      this.logger.logFailure("failed to destroy Shaka", error);
    }
  }
}
