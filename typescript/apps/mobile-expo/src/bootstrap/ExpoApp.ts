/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MeditationExperience } from "@meditation-surf/core";

import { ExpoExperienceAdapter } from "../experience/ExpoExperienceAdapter";

/**
 * @brief Top-level lifecycle owner for the Expo app layer
 *
 * React Native rendering remains local to `App.tsx`, while this class owns the
 * runtime-specific adaptation of the shared meditation experience.
 */
export class ExpoApp {
  private readonly experienceAdapter: ExpoExperienceAdapter;

  /**
   * @brief Build the Expo app around a shared meditation experience
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    this.experienceAdapter = new ExpoExperienceAdapter(experience);
  }

  /**
   * @brief Return the Expo runtime adapters consumed by the React component
   *
   * @returns Shared adapter object for background video and foreground UI
   */
  public getExperienceAdapter(): ExpoExperienceAdapter {
    return this.experienceAdapter;
  }
}
