/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { VideoPlayerLoadRequest } from "../core/VideoPlayerLoadRequest";
import type { ExpoVideoSourcePrimitive } from "./ExpoVideoPrimitives";

/**
 * @brief Build Expo video sources from the shared player load request
 */
export class ExpoVideoSourceFactory {
  /**
   * @brief Create one Expo-compatible source object
   *
   * @param source - Shared player load request
   *
   * @returns Expo-native source metadata
   */
  public createSource(
    source: VideoPlayerLoadRequest,
  ): ExpoVideoSourcePrimitive {
    return {
      contentType: this.resolveContentType(source.mimeType),
      uri: source.url,
    };
  }

  /**
   * @brief Resolve Expo's content type from an optional MIME type
   *
   * @param mimeType - Optional caller-provided MIME type
   *
   * @returns Expo-native content type
   */
  private resolveContentType(
    mimeType: string | undefined,
  ): "auto" | "dash" | "hls" | "progressive" | "smoothStreaming" {
    switch (mimeType) {
      case "application/dash+xml":
        return "dash";
      case "application/vnd.apple.mpegurl":
      case "application/x-mpegurl":
        return "hls";
      case "application/vnd.ms-sstr+xml":
        return "smoothStreaming";
      case undefined:
        return "auto";
      default:
        return "progressive";
    }
  }
}
