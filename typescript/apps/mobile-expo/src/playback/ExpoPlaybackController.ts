/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  IPlaybackController,
  PlaybackSource,
} from "@meditation-surf/player-core";

/**
 * @brief Placeholder Expo playback adapter
 *
 * The mobile app owns its eventual player implementation separately from TV.
 */
export class ExpoPlaybackController implements IPlaybackController {
  // Last loaded source retained for scaffold-level testing and wiring
  private currentSource: PlaybackSource | null = null;

  /**
   * @brief Create an empty placeholder controller
   */
  public constructor() {}

  /**
   * @brief Prepare the placeholder controller
   *
   * @returns No value because the scaffold does not require asynchronous setup
   */
  public initialize(): void {}

  /**
   * @brief Store the requested playback source until Expo playback lands
   *
   * @param source - Shared playback source metadata
   *
   * @returns A promise that resolves after the source has been stored
   */
  public async load(source: PlaybackSource): Promise<void> {
    this.currentSource = source;
  }

  /**
   * @brief No-op play method for the initial scaffold
   *
   * @returns No value because playback start is not implemented yet
   */
  public play(): void {}

  /**
   * @brief No-op pause method for the initial scaffold
   */
  public pause(): void {}

  /**
   * @brief No-op mute method for the initial scaffold
   *
   * @param muted - Requested mute state
   */
  public setMuted(muted: boolean): void {
    void muted;
  }

  /**
   * @brief No-op volume method for the initial scaffold
   *
   * @param volume - Requested volume value
   */
  public setVolume(volume: number): void {
    void volume;
  }

  /**
   * @brief Clear the current source when the scaffold shuts down
   *
   * @returns A promise that resolves after the placeholder state has been cleared
   */
  public async destroy(): Promise<void> {
    this.currentSource = null;
  }
}
