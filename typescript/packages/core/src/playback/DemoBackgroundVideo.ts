/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { FixtureCatalog } from "../catalog/FixtureCatalog";
import {
  BackgroundVideoModel,
  type BackgroundVideoPlaybackPolicy,
} from "./BackgroundVideoModel";

/**
 * @brief Shared product-level playback behavior for the demo background video
 *
 * Each app still owns its own player wiring and fullscreen presentation.
 */
export class DemoBackgroundVideo extends BackgroundVideoModel {
  private static readonly PLAYBACK_POLICY: BackgroundVideoPlaybackPolicy = {
    autoplay: true,
    loop: true,
    muted: true,
    playsInline: true,
    objectFit: "cover",
  };

  /**
   * @brief Create the canonical demo background video model
   */
  public constructor() {
    super(
      FixtureCatalog.getBackgroundVideoItem().getPlaybackSource(),
      DemoBackgroundVideo.PLAYBACK_POLICY,
    );
  }

  /**
   * @brief Create the canonical demo background video model
   *
   * @returns Shared demo background video object
   */
  public static create(): DemoBackgroundVideo {
    return new DemoBackgroundVideo();
  }
}
