/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

/**
 * @brief Small synchronous probe used by the web shell to report renderer support
 */
export type WebRendererCapabilityProbeResult = {
  supportsWebGpuRenderer: boolean;
  supportsWebGlRenderer: boolean;
  supportsRendererPreviewRouting: boolean;
  supportsRendererExtractionRouting: boolean;
};

/**
 * @brief Detect conservative renderer support for the current browser
 */
export class WebRendererCapabilityProbe {
  private static cachedProbeResult: WebRendererCapabilityProbeResult | null =
    null;

  /**
   * @brief Read the browser's current renderer support snapshot
   *
   * @returns Cached or freshly probed support result
   */
  public static probe(): WebRendererCapabilityProbeResult {
    if (this.cachedProbeResult !== null) {
      return {
        ...this.cachedProbeResult,
      };
    }

    const globalNavigator: Navigator | undefined = globalThis.navigator;
    const supportsWebGpuRenderer: boolean =
      globalNavigator !== undefined && "gpu" in globalNavigator;
    const supportsWebGlRenderer: boolean = this.supportsWebGlRenderer();
    const probeResult: WebRendererCapabilityProbeResult = {
      supportsWebGpuRenderer,
      supportsWebGlRenderer,
      supportsRendererPreviewRouting:
        supportsWebGpuRenderer || supportsWebGlRenderer,
      supportsRendererExtractionRouting:
        supportsWebGpuRenderer || supportsWebGlRenderer,
    };

    this.cachedProbeResult = {
      ...probeResult,
    };

    return probeResult;
  }

  /**
   * @brief Detect whether the current browser can create a WebGL context
   *
   * @returns `true` when WebGL can be used as a live fallback backend
   */
  private static supportsWebGlRenderer(): boolean {
    if (typeof document === "undefined") {
      return false;
    }

    const canvasElement: HTMLCanvasElement = document.createElement("canvas");
    const webGlContext: WebGLRenderingContext | null = canvasElement.getContext(
      "webgl",
    ) as WebGLRenderingContext | null;

    return webGlContext !== null;
  }
}
