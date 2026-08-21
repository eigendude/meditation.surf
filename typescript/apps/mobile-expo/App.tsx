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
import type { JSX } from "react";

import { ExpoApp } from "./src/bootstrap/ExpoApp";
import { ExpoAppScreen } from "./src/ui/ExpoAppScreen";

const experience: MeditationExperience = DemoExperienceFactory.create();
const app: ExpoApp = new ExpoApp(experience);

export default function App(): JSX.Element {
  return <ExpoAppScreen app={app} />;
}
