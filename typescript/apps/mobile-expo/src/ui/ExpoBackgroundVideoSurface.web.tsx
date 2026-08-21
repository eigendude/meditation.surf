/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CSSProperties, JSX } from "react";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";

import type { ExpoVideoViewProps } from "../bootstrap/UseExpoAppRuntime";

/**
 * @brief Props consumed by the Expo web background video surface
 */
export interface ExpoBackgroundVideoSurfaceProps {
  readonly contentFit: ExpoVideoViewProps["contentFit"];
  readonly onFirstFrameRender: ExpoVideoViewProps["onFirstFrameRender"];
  readonly player: ExpoVideoViewProps["player"];
  readonly playsInline: ExpoVideoViewProps["playsInline"];
  readonly style: unknown;
}

/**
 * @brief Structural subset of the Expo web player used by the background view
 */
type ExpoWebBackgroundPlayer = {
  mountVideoView: (videoElement: HTMLVideoElement) => void;
  unmountVideoView: (videoElement: HTMLVideoElement) => void;
};

/**
 * @brief Flatten one React Native style object for the web `video` element
 */
function getVideoElementStyle(style: unknown): CSSProperties {
  return StyleSheet.flatten(style) as CSSProperties;
}

/**
 * @brief Render the Expo web background surface without declarative `src` rebinding
 *
 * Expo's stock web `VideoView` drives the same HTML video from two directions:
 * `replaceAsync()` imperatively calls `load()`, while the component also binds
 * `src` declaratively during render. The background lane only needs one stable
 * mount, so this wrapper mounts the shared player once and lets the runtime own
 * subsequent source changes.
 *
 * @param props - Stable background video view configuration
 *
 * @returns Expo web background `video` element bound to the shared player
 */
export function ExpoBackgroundVideoSurface(
  props: ExpoBackgroundVideoSurfaceProps,
): JSX.Element {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mountedPlayerRef = useRef<ExpoWebBackgroundPlayer | null>(null);
  const waitingForFirstFrameRef = useRef<boolean>(false);
  const webPlayer: ExpoWebBackgroundPlayer =
    props.player as unknown as ExpoWebBackgroundPlayer;

  useEffect((): (() => void) => {
    const videoElement: HTMLVideoElement | null = videoElementRef.current;

    if (videoElement === null) {
      return (): void => undefined;
    }

    const handleLoadStart = (): void => {
      waitingForFirstFrameRef.current = true;
    };
    const handleLoadedData = (): void => {
      if (waitingForFirstFrameRef.current) {
        props.onFirstFrameRender?.();
      }

      waitingForFirstFrameRef.current = false;
    };

    videoElement.addEventListener("loadstart", handleLoadStart);
    videoElement.addEventListener("loadeddata", handleLoadedData);

    return (): void => {
      videoElement.removeEventListener("loadstart", handleLoadStart);
      videoElement.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [props.onFirstFrameRender]);

  useEffect((): (() => void) => {
    const videoElement: HTMLVideoElement | null = videoElementRef.current;
    const mountedPlayer: ExpoWebBackgroundPlayer | null =
      mountedPlayerRef.current;

    if (videoElement === null) {
      return (): void => undefined;
    }

    mountedPlayer?.unmountVideoView(videoElement);
    webPlayer.mountVideoView(videoElement);
    mountedPlayerRef.current = webPlayer;

    return (): void => {
      webPlayer.unmountVideoView(videoElement);

      if (mountedPlayerRef.current === webPlayer) {
        mountedPlayerRef.current = null;
      }
    };
  }, [webPlayer]);

  return (
    <video
      controls={false}
      playsInline={props.playsInline}
      ref={videoElementRef}
      style={{
        ...getVideoElementStyle(props.style),
        objectFit: props.contentFit,
      }}
    />
  );
}
