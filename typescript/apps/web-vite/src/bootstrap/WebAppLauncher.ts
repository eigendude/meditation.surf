/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MeditationExperience } from "@meditation-surf/core";

import { WebApp } from "./WebApp";

/**
 * @brief Own bootstrap of the web app entry flow
 */
export class WebAppLauncher {
  private readonly experience: MeditationExperience;

  /**
   * @brief Capture the shared experience used to launch the web app
   *
   * @param experience - Shared meditation experience
   */
  public constructor(experience: MeditationExperience) {
    this.experience = experience;
  }

  /**
   * @brief Launch the web app once using the configured experience
   *
   * @returns A promise that resolves after startup work has been kicked off
   */
  public async launch(): Promise<void> {
    const app: WebApp = new WebApp(this.experience);

    await app.start();
  }
}
