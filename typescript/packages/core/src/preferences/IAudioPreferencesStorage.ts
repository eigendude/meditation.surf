/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { AudioPreferences } from "./AudioPreferences";

/**
 * @brief Storage contract for persisted audio preferences
 *
 * Each frontend remains free to choose its own persistence backend while the
 * shared core model stays consistent.
 */
export interface IAudioPreferencesStorage {
  /**
   * @brief Load persisted audio preferences
   *
   * @returns The normalized persisted preference object
   */
  load(): AudioPreferences;

  /**
   * @brief Persist a complete preference object
   *
   * @param preferences - Audio preference object to save
   */
  save(preferences: AudioPreferences): void;
}
