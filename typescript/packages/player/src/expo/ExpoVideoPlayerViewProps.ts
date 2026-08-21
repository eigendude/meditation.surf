/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoViewProps } from "expo-video";

/**
 * @brief Minimal VideoView props owned by the shared Expo runtime
 *
 * The app can spread these props onto `VideoView` and layer app-specific
 * presentation props around them later.
 */
export type ExpoVideoPlayerViewProps = Pick<
  VideoViewProps,
  "onFirstFrameRender" | "player"
>;
