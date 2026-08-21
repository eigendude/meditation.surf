/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import { type JSX, useEffect, useRef } from "react";
import { Animated, View } from "react-native";

import type { ExpoApp } from "../bootstrap/ExpoApp";
import type { ExpoAppRuntime } from "../bootstrap/UseExpoAppRuntime";
import { useExpoAppRuntime } from "../bootstrap/UseExpoAppRuntime";
import type { ExpoFocusableElement } from "../input/ExpoBrowseInputAdapter";
import { ExpoBackgroundVideoSurface } from "./ExpoBackgroundVideoSurface";
import { ExpoBrowseOverlay } from "./ExpoBrowseOverlay";

/**
 * @brief Props consumed by the top-level Expo app screen
 */
export interface ExpoAppScreenProps {
  readonly app: ExpoApp;
}

/**
 * @brief Render the top-level Expo app surface
 *
 * The component stays focused on view composition while the runtime hook owns
 * subscriptions, animation state, and viewport-derived values.
 *
 * @param props - Shared Expo app wrapper
 *
 * @returns Root Expo screen bound to the shared meditation experience
 */
export function ExpoAppScreen(props: ExpoAppScreenProps): JSX.Element {
  const runtime: ExpoAppRuntime = useExpoAppRuntime({ app: props.app });
  const rootViewRef = useRef<View | null>(null);

  useEffect((): void => {
    runtime.experienceAdapter.browseInputAdapter.focusKeyboardRoot(
      rootViewRef.current as ExpoFocusableElement | null,
    );
  }, [runtime.experienceAdapter]);

  return (
    <View
      ref={rootViewRef}
      focusable={runtime.browseInputBindings.rootInputProps.focusable}
      style={runtime.experienceAdapter.appLayoutController.getContainerStyle()}
      tabIndex={runtime.browseInputBindings.rootInputProps.tabIndex}
    >
      <ExpoBackgroundVideoSurface
        contentFit={runtime.videoViewProps.contentFit}
        onFirstFrameRender={runtime.videoViewProps.onFirstFrameRender}
        player={runtime.videoViewProps.player}
        playsInline={runtime.videoViewProps.playsInline}
        style={runtime.experienceAdapter.appLayoutController.getBackgroundLayerStyle()}
      />
      <View
        pointerEvents="none"
        style={runtime.experienceAdapter.appLayoutController.getLoadingPlaneStyle()}
      >
        <Animated.Image
          resizeMode="contain"
          source={runtime.experienceAdapter.appLayoutController.getCenteredOverlaySource()}
          style={[
            runtime.experienceAdapter.appLayoutController.getCenteredOverlayStyle(),
            runtime.overlaySize,
            {
              opacity: runtime.loadingOpacity,
            },
          ]}
        />
      </View>
      <View
        accessible={false}
        pointerEvents="box-none"
        style={runtime.experienceAdapter.appLayoutController.getOverlayUiPlaneStyle()}
      >
        <Animated.View
          pointerEvents="box-none"
          style={{
            opacity: runtime.overlayOpacity,
          }}
        >
          <ExpoBrowseOverlay
            browseFocusState={runtime.browseFocusState}
            content={runtime.browseContent}
            getItemInputHandlers={
              runtime.browseInputBindings.getItemInputHandlers
            }
          />
        </Animated.View>
      </View>
    </View>
  );
}
