/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import Blits from "@lightningjs/blits";

// Type alias for the factory returned by Blits.Application
type LightningAppFactory = ReturnType<typeof Blits.Application>;

// Minimal LightningJS app
const LightningApp: LightningAppFactory = Blits.Application({});

/**
 * Launch the LightningJS application sized to the current viewport
 */
export function launchLightningApp(): void {
  Blits.Launch(LightningApp, "app", {
    w: window.innerWidth,
    h: window.innerHeight,
    canvasColor: "#000000",
  });
}
