/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { VideoView } from "expo-video";
import type { JSX } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { ExpoVideoViewProps } from "../bootstrap/UseExpoAppRuntime";

/**
 * @brief Props consumed by the shared Expo background video surface
 */
export interface ExpoBackgroundVideoSurfaceProps {
  readonly contentFit: ExpoVideoViewProps["contentFit"];
  readonly onFirstFrameRender: ExpoVideoViewProps["onFirstFrameRender"];
  readonly player: ExpoVideoViewProps["player"];
  readonly playsInline: ExpoVideoViewProps["playsInline"];
  readonly style: StyleProp<ViewStyle>;
}

/**
 * @brief Render the native Expo background video surface
 *
 * Native Expo can continue using the stock `VideoView`. A dedicated component
 * keeps the app screen stable while allowing web to swap in a tighter binding.
 *
 * @param props - Stable background video view configuration
 *
 * @returns Native Expo background video surface
 */
export function ExpoBackgroundVideoSurface(
  props: ExpoBackgroundVideoSurfaceProps,
): JSX.Element {
  return (
    <VideoView
      contentFit={props.contentFit}
      nativeControls={false}
      onFirstFrameRender={props.onFirstFrameRender}
      player={props.player}
      playsInline={props.playsInline}
      style={props.style}
    />
  );
}
