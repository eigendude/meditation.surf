/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { OPEN_SANS_MEDIUM_FONT_PATH } from "@meditation-surf/assets";

/**
 * @brief Describes the single Lightning web-font asset loaded at application start
 *
 * Blits only renders text for font families that have been installed into the
 * renderer. Centralizing the font family and asset path keeps the TV app on one
 * known-good font and prevents stale per-component font names from drifting.
 */
export class TvTextFont {
  /**
   * @brief The shared family name used by all Lightning text in the TV app
   */
  public static readonly family: string = "TvAppText";

  /**
   * @brief Resolve the only bundled font asset used by the TV Lightning app
   *
   * Lightning's font loader is more reliable with a fully resolved runtime URL
   * than with a bare root-relative path. The shared asset package owns the
   * canonical public path and this getter resolves it for the active origin.
   */
  public static get file(): string {
    const fontUrl: URL = new URL(OPEN_SANS_MEDIUM_FONT_PATH, document.baseURI);

    return fontUrl.toString();
  }

  /**
   * @brief Create the Blits font definition for the shared web font
   *
   * @returns {{ family: string; type: "web"; file: string }} Blits font config
   */
  public static createBlitsFontDefinition(): {
    family: string;
    type: "web";
    file: string;
  } {
    return {
      family: TvTextFont.family,
      type: "web",
      file: TvTextFont.file,
    };
  }
}
