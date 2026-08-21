/*
 * Copyright (C) 2025-2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { TvAppLauncher } from "./bootstrap/TvAppLauncher";

// Application entry point
const appLauncher: TvAppLauncher = new TvAppLauncher();

appLauncher.launch();
