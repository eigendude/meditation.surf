/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * Persisted audio configuration for the video player.
 * The muted state is stored in local storage so it survives
 * page reloads and Lightning application restarts.
 */
export class AudioState {
  /** Storage key used in the browser's local storage. */
  private static readonly STORAGE_KEY: string = "audioMuted";

  /**
   * Read the current mute setting from storage.
   *
   * @returns `true` when audio should be muted.
   */
  public static isMuted(): boolean {
    return window.localStorage.getItem(AudioState.STORAGE_KEY) === "true";
  }

  /**
   * Persist the mute setting to local storage.
   *
   * @param muted - Whether audio should be muted.
   */
  public static setMuted(muted: boolean): void {
    window.localStorage.setItem(
      AudioState.STORAGE_KEY,
      muted ? "true" : "false",
    );
  }
}

export default AudioState;
