/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  DemoExperienceFactory,
  type MeditationExperience,
} from "@meditation-surf/core";

import { TvApp } from "./TvApp";

/**
 * @brief Own bootstrap of the TV app entry flow
 */
export class TvAppLauncher {
  /**
   * @brief Launch the TV app once using the shared demo meditation experience
   */
  public launch(): void {
    const experience: MeditationExperience = DemoExperienceFactory.create();
    const app: TvApp = new TvApp(experience);

    app.start();
  }
}
