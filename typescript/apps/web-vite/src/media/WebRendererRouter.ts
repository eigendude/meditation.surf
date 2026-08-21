/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  type MediaSessionRole,
  type RendererBackendKind,
  type RendererCapability,
  type RendererDecision,
  type RendererFrameHandle,
  RendererRouter as SharedRendererRouter,
  type RendererSessionBinding,
  type RendererSnapshot,
  type VariantRolePolicy,
} from "@meditation-surf/core";

import { WebGlRenderer } from "./WebGlRenderer";
import { WebGpuRenderer } from "./WebGpuRenderer";

type WebRendererRouteRequest = {
  capability: RendererCapability | null;
  decision: RendererDecision | null;
  sessionId: string;
  sessionRole: MediaSessionRole;
  variantRole: VariantRolePolicy | null;
  target: RendererSessionBinding["target"];
  frameSource: CanvasImageSource;
  frameHandle: RendererFrameHandle;
  hostElement: HTMLElement | null;
  legacyFallbackReason: string;
  notes: string[];
};

type WebRoutableRenderer = WebGlRenderer | WebGpuRenderer;

/**
 * @brief Small web-only router that binds preview or extraction frames to one backend
 */
export class WebRendererRouter {
  private activeRenderer: WebRoutableRenderer | null;
  private rendererSnapshot: RendererSnapshot | null;
  private readonly webGlRenderer: WebGlRenderer | null;
  private readonly webGpuRenderer: WebGpuRenderer | null;

  /**
   * @brief Build the web renderer router with lazy backend ownership
   */
  public constructor() {
    this.activeRenderer = null;
    this.rendererSnapshot = null;
    this.webGlRenderer = WebGlRenderer.isSupported()
      ? new WebGlRenderer()
      : null;
    this.webGpuRenderer = WebGpuRenderer.isSupported()
      ? new WebGpuRenderer()
      : null;
  }

  /**
   * @brief Route one frame through WebGPU, then WebGL, before falling back
   *
   * @param request - Immutable frame-routing request
   *
   * @returns Shared renderer snapshot describing the chosen path
   */
  public async routeFrame(
    request: WebRendererRouteRequest,
  ): Promise<RendererSnapshot> {
    const decision: RendererDecision | null = request.decision;
    const capability: RendererCapability | null = request.capability;

    if (
      decision === null ||
      capability === null ||
      !decision.shouldRouteThroughRenderer
    ) {
      const legacySnapshot: RendererSnapshot =
        SharedRendererRouter.createSnapshot({
          capability,
          decision,
          sessionId: request.sessionId,
          sessionRole: request.sessionRole,
          variantRole: request.variantRole,
          target: request.target,
          selectedBackend: decision?.selectedBackend ?? null,
          activeBackend: null,
          usedLegacyPath: true,
          bypassedRendererRouter: decision?.bypassesRendererRouter ?? false,
          fallbackReason:
            decision?.fallbackReason ?? request.legacyFallbackReason,
          failureReason: null,
          frameHandle: request.frameHandle,
          notes: request.notes,
        });

      this.rendererSnapshot = legacySnapshot;

      return legacySnapshot;
    }

    const runtimeFallbackNotes: string[] = [];

    for (const backendKind of decision.preferredBackendOrder) {
      if (backendKind === "none") {
        continue;
      }

      const renderer: WebRoutableRenderer | null =
        this.resolveRenderer(backendKind);

      if (renderer === null) {
        runtimeFallbackNotes.push(
          `${backendKind} was selected by policy but is unavailable in this browser runtime.`,
        );
        continue;
      }

      try {
        await renderer.renderFrame(
          request.frameSource,
          request.frameHandle.width,
          request.frameHandle.height,
        );

        if (request.hostElement !== null) {
          renderer.attach(request.hostElement);
        }

        this.detachOtherRenderer(renderer);
        this.activeRenderer = renderer;
        this.rendererSnapshot = SharedRendererRouter.createSnapshot({
          capability,
          decision,
          sessionId: request.sessionId,
          sessionRole: request.sessionRole,
          variantRole: request.variantRole,
          target: request.target,
          selectedBackend: decision.selectedBackend,
          activeBackend: backendKind,
          usedLegacyPath: false,
          bypassedRendererRouter: decision.bypassesRendererRouter,
          fallbackReason:
            backendKind === decision.selectedBackend
              ? decision.fallbackReason
              : request.legacyFallbackReason,
          failureReason: null,
          frameHandle: request.frameHandle,
          reasons:
            backendKind === decision.selectedBackend
              ? []
              : ["runtime-fallback"],
          notes: [...request.notes, ...runtimeFallbackNotes],
        });

        return this.rendererSnapshot;
      } catch (error: unknown) {
        runtimeFallbackNotes.push(
          error instanceof Error && error.message.length > 0
            ? error.message
            : `${backendKind} renderer presentation failed.`,
        );
      }
    }

    this.detach();
    this.rendererSnapshot = SharedRendererRouter.createSnapshot({
      capability,
      decision,
      sessionId: request.sessionId,
      sessionRole: request.sessionRole,
      variantRole: request.variantRole,
      target: request.target,
      selectedBackend: decision.selectedBackend,
      activeBackend: null,
      usedLegacyPath: true,
      bypassedRendererRouter: decision.bypassesRendererRouter,
      fallbackReason:
        runtimeFallbackNotes[runtimeFallbackNotes.length - 1] ??
        decision.fallbackReason ??
        request.legacyFallbackReason,
      failureReason:
        runtimeFallbackNotes[runtimeFallbackNotes.length - 1] ?? null,
      frameHandle: request.frameHandle,
      reasons: ["runtime-fallback"],
      notes: [...request.notes, ...runtimeFallbackNotes],
    });

    return this.rendererSnapshot;
  }

  /**
   * @brief Reattach the active renderer canvas to one host when available
   *
   * @param hostElement - Host element that should show the active renderer
   */
  public bindToHost(hostElement: HTMLElement | null): void {
    if (hostElement === null || this.activeRenderer === null) {
      this.detach();
      return;
    }

    this.activeRenderer.attach(hostElement);
  }

  /**
   * @brief Serialize the active backend canvas into a blob
   *
   * @param contentType - Requested image content type
   * @param quality - Optional image quality hint
   *
   * @returns Encoded blob, or `null` when no backend is active
   */
  public async captureBlob(
    contentType: string,
    quality: number | undefined,
  ): Promise<Blob | null> {
    if (this.activeRenderer === null) {
      return null;
    }

    return await this.activeRenderer.toBlob(contentType, quality);
  }

  /**
   * @brief Return the latest renderer snapshot
   *
   * @returns Cloned renderer snapshot, or `null` when no route has run
   */
  public getSnapshot(): RendererSnapshot | null {
    return SharedRendererRouter.cloneSnapshot(this.rendererSnapshot);
  }

  /**
   * @brief Detach any active renderer canvas from its host
   */
  public detach(): void {
    this.activeRenderer?.detach();
  }

  /**
   * @brief Release every backend owned by the router
   */
  public async destroy(): Promise<void> {
    this.detach();
    await this.webGpuRenderer?.destroy();
    await this.webGlRenderer?.destroy();
    this.activeRenderer = null;
    this.rendererSnapshot = null;
  }

  /**
   * @brief Resolve one concrete backend from the shared backend kind
   *
   * @param backendKind - Backend being requested
   *
   * @returns Matching renderer instance, or `null` when unsupported
   */
  private resolveRenderer(
    backendKind: RendererBackendKind,
  ): WebRoutableRenderer | null {
    switch (backendKind) {
      case "webgpu":
        return this.webGpuRenderer;
      case "webgl":
        return this.webGlRenderer;
      case "none":
        return null;
    }
  }

  /**
   * @brief Detach the inactive backend so only one canvas owns the host
   *
   * @param activeRenderer - Backend that should remain attached
   */
  private detachOtherRenderer(activeRenderer: WebRoutableRenderer): void {
    if (
      this.webGpuRenderer !== null &&
      this.webGpuRenderer !== activeRenderer
    ) {
      this.webGpuRenderer.detach();
    }

    if (this.webGlRenderer !== null && this.webGlRenderer !== activeRenderer) {
      this.webGlRenderer.detach();
    }
  }
}
