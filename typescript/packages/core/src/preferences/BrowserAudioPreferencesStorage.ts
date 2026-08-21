/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  AudioPreferences,
  type AudioPreferencesInit,
} from "./AudioPreferences";
import type { IAudioPreferencesStorage } from "./IAudioPreferencesStorage";

/**
 * @brief Browser local-storage implementation for shared audio preferences
 *
 * This keeps the persistence adapter class-based while still allowing each app
 * to decide whether browser storage is the right runtime backend.
 */
export class BrowserAudioPreferencesStorage implements IAudioPreferencesStorage {
  private static readonly MUTED_KEY: string = "audioMuted";
  private static readonly VOLUME_KEY: string = "audioVolume";

  private readonly storage: Storage;

  /**
   * @brief Create a browser storage adapter for audio preferences
   *
   * @param storage - Browser storage backend used for persistence
   */
  public constructor(
    storage: Storage = BrowserAudioPreferencesStorage.getDefaultStorage(),
  ) {
    this.storage = storage;
  }

  /**
   * @brief Load persisted preferences from browser storage
   *
   * @returns A normalized preference object
   */
  public load(): AudioPreferences {
    const mutedValue: string | null = this.storage.getItem(
      BrowserAudioPreferencesStorage.MUTED_KEY,
    );
    const volumeValue: string | null = this.storage.getItem(
      BrowserAudioPreferencesStorage.VOLUME_KEY,
    );
    const parsedVolume: number =
      volumeValue === null ? Number.NaN : parseFloat(volumeValue);
    const audioPreferencesInit: AudioPreferencesInit = {
      muted: mutedValue === null ? undefined : mutedValue === "true",
      volume: Number.isNaN(parsedVolume) ? undefined : parsedVolume,
    };

    return AudioPreferences.from(audioPreferencesInit);
  }

  /**
   * @brief Save normalized audio preferences into browser storage
   *
   * @param preferences - Shared audio preference object to persist
   */
  public save(preferences: AudioPreferences): void {
    const normalizedPreferences: AudioPreferences =
      AudioPreferences.from(preferences);

    this.storage.setItem(
      BrowserAudioPreferencesStorage.MUTED_KEY,
      normalizedPreferences.muted ? "true" : "false",
    );
    this.storage.setItem(
      BrowserAudioPreferencesStorage.VOLUME_KEY,
      normalizedPreferences.volume.toString(),
    );
  }

  /**
   * @brief Resolve the default browser storage backend
   *
   * @returns The browser local-storage object
   */
  private static getDefaultStorage(): Storage {
    if (typeof window === "undefined") {
      throw new Error(
        "BrowserAudioPreferencesStorage requires an explicit Storage object outside the browser.",
      );
    }

    return window.localStorage;
  }
}
