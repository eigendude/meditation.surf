/*
 * Copyright (C) 2025 Garrett Brown
 * This file is part of meditation.surf - https://github.com/eigendude/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * Ambient declarations for JavaScript-only dependencies that do not ship
 * TypeScript module metadata.
 */
declare module "@metrological/sdk";
// Shaka Player does not ship TypeScript module declarations.
// Provide a minimal module definition so it can be imported with types.
/// <reference path="../node_modules/shaka-player/dist/shaka-player.compiled.d.ts" />
declare module "shaka-player/dist/shaka-player.compiled.js" {
  const shaka: typeof globalThis.shaka;
  export default shaka;
}
