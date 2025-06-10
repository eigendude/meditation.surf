/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * Persisted audio configuration for the video player.
 * The mute state and volume are stored in local storage
 * so they survive page reloads and Lightning restarts.
 */
export class AudioState {
  /** Storage key for the mute flag. */
  private static readonly MUTED_KEY: string = "audioMuted";

  /** Storage key for the volume level. */
  private static readonly VOLUME_KEY: string = "audioVolume";

  /**
   * Retrieve the persisted mute flag.
   *
   * @returns `true` when audio should be muted.
   */
  public static isMuted(): boolean {
    return window.localStorage.getItem(AudioState.MUTED_KEY) === "true";
  }

  /**
   * Retrieve the persisted volume level, clamped to [0, 1].
   *
   * @returns Volume level from 0.0 to 1.0.
   */
  public static getVolume(): number {
    const stored: string | null = window.localStorage.getItem(
      AudioState.VOLUME_KEY,
    );
    const value: number = stored === null ? 1 : parseFloat(stored);
    if (Number.isNaN(value)) {
      return 1;
    }
    return Math.min(Math.max(value, 0), 1);
  }

  /**
   * Persist the mute flag.
   *
   * @param muted - Whether audio should be muted.
   */
  public static setMuted(muted: boolean): void {
    window.localStorage.setItem(AudioState.MUTED_KEY, muted ? "true" : "false");
  }

  /**
   * Persist the volume level.
   *
   * @param volume - Volume value in [0, 1].
   */
  public static setVolume(volume: number): void {
    const clamped: number = Math.min(Math.max(volume, 0), 1);
    window.localStorage.setItem(AudioState.VOLUME_KEY, clamped.toString());
  }
}

export default AudioState;
