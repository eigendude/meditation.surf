/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaCapabilityProfile } from "../capabilities/MediaCapabilityProfile";
import type { CustomDecodeCapability } from "../custom-decode/CustomDecodeCapability";
import type { CustomDecodeDecision } from "../custom-decode/CustomDecodeDecision";
import type { CustomDecodeDecisionReason } from "../custom-decode/CustomDecodeDecisionReason";
import type { CustomDecodeLane } from "../custom-decode/CustomDecodeLane";
import type { MediaRuntimeCapabilities } from "../execution/MediaRuntimeCapabilities";
import type { RendererCapability } from "../rendering/RendererCapability";
import type { RendererDecision } from "../rendering/RendererDecision";
import { RendererRouter } from "../rendering/RendererRouter";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { CapabilityDecision } from "./CapabilityDecision";
import type { CapabilityDecisionReason } from "./CapabilityDecisionReason";
import type { CapabilityProbeResult } from "./CapabilityProbeResult";
import type { MediaRoleCapabilityRequest } from "./MediaRoleCapabilityRequest";
import type { MediaRoleCapabilitySnapshot } from "./MediaRoleCapabilitySnapshot";
import type { MediaRuntimeSupportLevel } from "./MediaRuntimeSupportLevel";

/**
 * @brief Pure shared oracle that resolves conservative lane and renderer preferences
 *
 * The oracle stays intentionally inspectable. It folds app-shell capability
 * reports, runtime-adapter capability claims, and role intent into a stable
 * snapshot that planners and choosers can both reuse.
 */
export class CapabilityOracle {
  private static readonly cacheByKey: Map<string, MediaRoleCapabilitySnapshot> =
    new Map<string, MediaRoleCapabilitySnapshot>();

  /**
   * @brief Resolve one inspectable capability snapshot for the supplied role
   *
   * @param request - Immutable role-scoped capability request
   *
   * @returns Cached or freshly computed capability snapshot
   */
  public static decide(
    request: MediaRoleCapabilityRequest,
  ): MediaRoleCapabilitySnapshot {
    const cacheKey: string = this.createCacheKey(request);
    const cachedSnapshot: MediaRoleCapabilitySnapshot | undefined =
      this.cacheByKey.get(cacheKey);

    if (cachedSnapshot !== undefined) {
      return this.cloneSnapshot(cachedSnapshot);
    }

    const probeResult: CapabilityProbeResult = this.createProbeResult(request);
    const rendererResolution: {
      capability: RendererCapability;
      decision: RendererDecision;
    } = RendererRouter.decide({
      role: request.role,
      preferredRendererKindHint: request.preferredRendererKindHint,
      webgpuSupportLevel: probeResult.webgpuRendererSupportLevel,
      webglSupportLevel: probeResult.webglRendererSupportLevel,
      previewRendererRoutingSupportLevel:
        probeResult.previewRendererRoutingSupportLevel,
      extractionRendererRoutingSupportLevel:
        probeResult.extractionRendererRoutingSupportLevel,
      committedPlaybackBypassesRendererRouter:
        probeResult.committedPlaybackBypassesRendererRouter,
    });
    const decision: CapabilityDecision = this.createDecision(
      request,
      probeResult,
      rendererResolution.decision,
    );
    const customDecodeCapability: CustomDecodeCapability =
      this.createCustomDecodeCapability(request, probeResult);
    const customDecodeDecision: CustomDecodeDecision =
      this.createCustomDecodeDecision(request, customDecodeCapability);
    const capabilitySnapshot: MediaRoleCapabilitySnapshot = {
      cacheKey,
      request: this.cloneRequest(request),
      probeResult: this.cloneProbeResult(probeResult),
      decision: this.cloneDecision(decision),
      rendererCapability: RendererRouter.cloneCapability(
        rendererResolution.capability,
      )!,
      rendererDecision: RendererRouter.cloneDecision(
        rendererResolution.decision,
      )!,
      customDecodeCapability: this.cloneCustomDecodeCapability(
        customDecodeCapability,
      ),
      customDecodeDecision:
        this.cloneCustomDecodeDecision(customDecodeDecision),
    };

    this.cacheByKey.set(cacheKey, this.cloneSnapshot(capabilitySnapshot));

    return capabilitySnapshot;
  }

  /**
   * @brief Return the current in-memory cache contents for shared debug consumers
   *
   * @returns Cached snapshots sorted by cache key
   */
  public static getCacheSnapshot(): MediaRoleCapabilitySnapshot[] {
    return [...this.cacheByKey.values()]
      .sort(
        (
          leftSnapshot: MediaRoleCapabilitySnapshot,
          rightSnapshot: MediaRoleCapabilitySnapshot,
        ): number =>
          leftSnapshot.cacheKey.localeCompare(rightSnapshot.cacheKey),
      )
      .map(
        (
          capabilitySnapshot: MediaRoleCapabilitySnapshot,
        ): MediaRoleCapabilitySnapshot =>
          this.cloneSnapshot(capabilitySnapshot),
      );
  }

  /**
   * @brief Clear the lightweight in-memory cache maintained by the oracle
   */
  public static invalidateCache(): void {
    this.cacheByKey.clear();
  }

  /**
   * @brief Build a stable cache key from the immutable request payload
   *
   * @param request - Role-scoped capability request
   *
   * @returns Deterministic cache key
   */
  private static createCacheKey(request: MediaRoleCapabilityRequest): string {
    return JSON.stringify({
      role: request.role,
      preferredLaneHint: request.preferredLaneHint,
      preferredRendererKindHint: request.preferredRendererKindHint,
      existingChosenLane: request.existingChosenLane,
      runtimeLanePreference: request.runtimeLanePreference,
      appCapabilityProfile: request.appCapabilityProfile,
      runtimeCapabilities: request.runtimeCapabilities,
    });
  }

  /**
   * @brief Probe the current runtime and app profile into support-level metadata
   *
   * @param request - Immutable role-scoped capability request
   *
   * @returns Small support-level probe snapshot
   */
  private static createProbeResult(
    request: MediaRoleCapabilityRequest,
  ): CapabilityProbeResult {
    const appCapabilityProfile: MediaCapabilityProfile | null =
      request.appCapabilityProfile;
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      request.runtimeCapabilities;
    const nativeLaneSupportLevel: MediaRuntimeSupportLevel =
      this.resolveLaneSupportLevel(request.role, "native", request);
    const shakaLaneSupportLevel: MediaRuntimeSupportLevel =
      this.resolveLaneSupportLevel(request.role, "shaka", request);
    const customLaneSupportLevel: MediaRuntimeSupportLevel =
      this.resolveLaneSupportLevel(request.role, "custom", request);
    const webCodecsSupportLevel: MediaRuntimeSupportLevel =
      this.resolveWebCodecsSupportLevel(request);
    const premiumPlaybackSupportLevel: MediaRuntimeSupportLevel =
      this.resolvePremiumSupportLevel(request.role, request);
    const workerOffloadSupportLevel: MediaRuntimeSupportLevel =
      appCapabilityProfile === null
        ? "unknown"
        : appCapabilityProfile.supportsWorkerOffload
          ? "supported"
          : "unsupported";
    const nativeRendererSupportLevel: MediaRuntimeSupportLevel =
      appCapabilityProfile === null
        ? "unknown"
        : appCapabilityProfile.supportsNativePlayback ||
            appCapabilityProfile.supportsShakaPlayback
          ? "supported"
          : "unsupported";
    const webgpuRendererSupportLevel: MediaRuntimeSupportLevel =
      this.resolveRendererBackendSupportLevel(
        appCapabilityProfile?.supportsWebGPUPreferred ?? null,
        runtimeCapabilities?.supportsWebGpuRenderer ?? null,
      );
    const webglRendererSupportLevel: MediaRuntimeSupportLevel =
      this.resolveRendererBackendSupportLevel(
        appCapabilityProfile?.supportsWebGLFallback ?? null,
        runtimeCapabilities?.supportsWebGlRenderer ?? null,
      );
    const previewRendererRoutingSupportLevel: MediaRuntimeSupportLevel =
      this.resolveRendererRoutingSupportLevel(
        appCapabilityProfile?.supportsPreviewVideo ?? null,
        runtimeCapabilities?.supportsRendererPreviewRouting ?? null,
      );
    const extractionRendererRoutingSupportLevel: MediaRuntimeSupportLevel =
      this.resolveRendererRoutingSupportLevel(
        appCapabilityProfile?.supportsThumbnailExtraction ?? null,
        runtimeCapabilities?.supportsRendererExtractionRouting ?? null,
      );
    const overallSupportLevel: MediaRuntimeSupportLevel =
      this.resolveOverallSupportLevel(
        request.role,
        nativeLaneSupportLevel,
        shakaLaneSupportLevel,
        customLaneSupportLevel,
        premiumPlaybackSupportLevel,
        appCapabilityProfile,
        runtimeCapabilities,
      );

    return {
      overallSupportLevel,
      nativeLaneSupportLevel,
      shakaLaneSupportLevel,
      customLaneSupportLevel,
      webCodecsSupportLevel,
      nativeRendererSupportLevel,
      webgpuRendererSupportLevel,
      webglRendererSupportLevel,
      previewRendererRoutingSupportLevel,
      extractionRendererRoutingSupportLevel,
      committedPlaybackBypassesRendererRouter:
        runtimeCapabilities?.committedPlaybackBypassesRendererRouter ?? true,
      premiumPlaybackSupportLevel,
      workerOffloadSupportLevel,
    };
  }

  /**
   * @brief Convert probe metadata into a stable lane and renderer decision
   *
   * @param request - Role-scoped capability request
   * @param probeResult - Support-level probe snapshot
   *
   * @returns Deterministic capability decision
   */
  private static createDecision(
    request: MediaRoleCapabilityRequest,
    probeResult: CapabilityProbeResult,
    rendererDecision: RendererDecision,
  ): CapabilityDecision {
    const reasons: CapabilityDecisionReason[] = ["runtime-capability"];
    const notes: string[] = [
      `Capability oracle evaluated ${request.role} against the current app and runtime profile.`,
    ];
    const preferredLaneOrder: MediaPlaybackLane[] =
      this.createPreferredLaneOrder(request, probeResult, reasons, notes);
    const preferredFallbackLaneOrder: MediaPlaybackLane[] =
      this.createPreferredFallbackLaneOrder(request, preferredLaneOrder);
    const preferredRendererOrder: MediaRendererKind[] =
      this.createPreferredRendererOrder(
        request,
        probeResult,
        preferredLaneOrder,
        rendererDecision,
      );
    const premiumPlaybackViable: boolean =
      probeResult.premiumPlaybackSupportLevel === "supported" &&
      !this.isLowCostRole(request.role);
    const workerOffloadViable: boolean =
      probeResult.workerOffloadSupportLevel === "supported";

    if (this.isLowCostRole(request.role)) {
      reasons.push("role-prefers-low-cost");
      notes.push(
        "This role prefers a lower-cost startup path over the richest possible playback lane.",
      );
    }

    if (this.isHighQualityRole(request.role)) {
      reasons.push("role-prefers-high-quality");
      notes.push(
        "This role prefers stable image or playback quality when the runtime already reports a safe path.",
      );
    }

    if (
      request.preferredLaneHint !== null ||
      request.existingChosenLane !== null ||
      request.runtimeCapabilities?.existingBackgroundPlaybackLane !== null
    ) {
      reasons.push("explicit-fallback");
      notes.push(
        "Existing lane hints were kept in the fallback order to preserve conservative runtime behavior.",
      );
    }

    if (preferredLaneOrder.length === 0) {
      reasons.push("runtime-limited");
      notes.push(
        "No playback lane remained viable for this role after applying conservative runtime and app filters.",
      );
    }

    if (
      request.runtimeCapabilities !== null &&
      request.appCapabilityProfile !== null &&
      preferredLaneOrder.length > 0
    ) {
      const appSupportedLaneCount: number = this.getKnownPlaybackLanes().filter(
        (lane: MediaPlaybackLane): boolean =>
          this.isLaneSupportedByProfile(lane, request.appCapabilityProfile),
      ).length;

      if (preferredLaneOrder.length < appSupportedLaneCount) {
        reasons.push("adapter-limited");
        notes.push(
          "The runtime adapter exposes fewer safe lanes than the broader app capability profile suggests.",
        );
      }
    }

    if (preferredLaneOrder.includes("native")) {
      reasons.push("native-supported");
      notes.push("Native playback remains available for this role.");
    }

    if (preferredLaneOrder.includes("shaka")) {
      reasons.push("shaka-supported");
      notes.push("Shaka playback remains available for this role.");
    }

    if (premiumPlaybackViable) {
      reasons.push("premium-supported");
      notes.push(
        "The current role and runtime profile can safely attempt a premium playback tier.",
      );
    } else {
      reasons.push("premium-unsupported");
      notes.push(
        "Premium playback was not treated as viable for this role or runtime path.",
      );
    }

    return {
      supportLevel: probeResult.overallSupportLevel,
      preferredLaneOrder,
      preferredFallbackLaneOrder,
      preferredRendererOrder,
      premiumPlaybackViable,
      workerOffloadViable,
      reasons,
      notes,
    };
  }

  /**
   * @brief Resolve the support level for one concrete lane and role
   *
   * @param role - Shared media role being evaluated
   * @param lane - Candidate playback lane
   * @param request - Immutable capability request
   *
   * @returns Support level for the requested lane
   */
  private static resolveLaneSupportLevel(
    role: VariantRolePolicy,
    lane: MediaPlaybackLane,
    request: MediaRoleCapabilityRequest,
  ): MediaRuntimeSupportLevel {
    const appCapabilityProfile: MediaCapabilityProfile | null =
      request.appCapabilityProfile;
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      request.runtimeCapabilities;

    if (appCapabilityProfile === null && runtimeCapabilities === null) {
      return "unknown";
    }

    if (!this.isLaneSupportedByProfile(lane, appCapabilityProfile)) {
      return "unsupported";
    }

    if (this.isThumbnailRole(role)) {
      if (appCapabilityProfile === null) {
        return "unknown";
      }

      return appCapabilityProfile.supportsThumbnailExtraction
        ? "supported"
        : "unsupported";
    }

    if (this.isPreviewRole(role)) {
      if (appCapabilityProfile?.supportsPreviewVideo !== true) {
        return "unsupported";
      }

      if (runtimeCapabilities === null) {
        return "supported";
      }

      if (!runtimeCapabilities.canPreviewInline) {
        return "unsupported";
      }

      return runtimeCapabilities.canWarmFirstFrame ? "supported" : "degraded";
    }

    if (runtimeCapabilities === null) {
      return "supported";
    }

    if (!runtimeCapabilities.supportsCommittedPlayback) {
      return "unsupported";
    }

    if (!runtimeCapabilities.committedPlaybackLanes.includes(lane)) {
      return "unsupported";
    }

    return "supported";
  }

  /**
   * @brief Resolve whether premium playback is viable for the supplied role
   *
   * @param role - Shared media role being evaluated
   * @param request - Immutable capability request
   *
   * @returns Support level for premium playback
   */
  private static resolvePremiumSupportLevel(
    role: VariantRolePolicy,
    request: MediaRoleCapabilityRequest,
  ): MediaRuntimeSupportLevel {
    const appCapabilityProfile: MediaCapabilityProfile | null =
      request.appCapabilityProfile;
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      request.runtimeCapabilities;

    if (this.isLowCostRole(role)) {
      return "unsupported";
    }

    if (appCapabilityProfile === null) {
      return "unknown";
    }

    if (!appCapabilityProfile.supportsPremiumPlayback) {
      return "unsupported";
    }

    if (runtimeCapabilities === null) {
      return "supported";
    }

    if (this.isPreviewRole(role) || this.isThumbnailRole(role)) {
      return "degraded";
    }

    return runtimeCapabilities.supportsPremiumCommittedPlayback
      ? "supported"
      : "unsupported";
  }

  /**
   * @brief Resolve one renderer backend support level from app and runtime state
   *
   * @param appSupportsRenderer - Whether the app profile reports backend support
   * @param runtimeSupportsRenderer - Whether the runtime adapter reports backend support
   *
   * @returns Support level for the renderer backend
   */
  private static resolveRendererBackendSupportLevel(
    appSupportsRenderer: boolean | null,
    runtimeSupportsRenderer: boolean | null,
  ): MediaRuntimeSupportLevel {
    if (appSupportsRenderer === null && runtimeSupportsRenderer === null) {
      return "unknown";
    }

    if (appSupportsRenderer === false || runtimeSupportsRenderer === false) {
      return "unsupported";
    }

    if (appSupportsRenderer === true || runtimeSupportsRenderer === true) {
      return "supported";
    }

    return "unknown";
  }

  /**
   * @brief Resolve generic preview or extraction routing support from app and runtime state
   *
   * @param appSupportsRouting - Whether the app profile reports routing support
   * @param runtimeSupportsRouting - Whether the runtime adapter reports routing support
   *
   * @returns Support level for renderer-router usage
   */
  private static resolveRendererRoutingSupportLevel(
    appSupportsRouting: boolean | null,
    runtimeSupportsRouting: boolean | null,
  ): MediaRuntimeSupportLevel {
    if (appSupportsRouting === null && runtimeSupportsRouting === null) {
      return "unknown";
    }

    if (appSupportsRouting === false || runtimeSupportsRouting === false) {
      return "unsupported";
    }

    if (appSupportsRouting === true || runtimeSupportsRouting === true) {
      return "supported";
    }

    return "unknown";
  }

  /**
   * @brief Resolve whether the current app and runtime expose WebCodecs support
   *
   * @param request - Immutable capability request
   *
   * @returns Support level for WebCodecs-backed work
   */
  private static resolveWebCodecsSupportLevel(
    request: MediaRoleCapabilityRequest,
  ): MediaRuntimeSupportLevel {
    const appCapabilityProfile: MediaCapabilityProfile | null =
      request.appCapabilityProfile;
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      request.runtimeCapabilities;

    if (appCapabilityProfile === null && runtimeCapabilities === null) {
      return "unknown";
    }

    if (appCapabilityProfile?.supportsWebCodecs === false) {
      return "unsupported";
    }

    if (runtimeCapabilities === null) {
      return appCapabilityProfile?.supportsWebCodecs === true
        ? "supported"
        : "unknown";
    }

    return runtimeCapabilities.supportsWebCodecs ? "supported" : "unsupported";
  }

  /**
   * @brief Fold lane and premium support into one overall role support level
   *
   * @param role - Shared media role being evaluated
   * @param nativeLaneSupportLevel - Native lane support
   * @param shakaLaneSupportLevel - Shaka lane support
   * @param customLaneSupportLevel - Custom lane support
   * @param premiumPlaybackSupportLevel - Premium playback support
   * @param appCapabilityProfile - App profile under evaluation
   * @param runtimeCapabilities - Runtime capability snapshot under evaluation
   *
   * @returns Overall support level for the role
   */
  private static resolveOverallSupportLevel(
    role: VariantRolePolicy,
    nativeLaneSupportLevel: MediaRuntimeSupportLevel,
    shakaLaneSupportLevel: MediaRuntimeSupportLevel,
    customLaneSupportLevel: MediaRuntimeSupportLevel,
    premiumPlaybackSupportLevel: MediaRuntimeSupportLevel,
    appCapabilityProfile: MediaCapabilityProfile | null,
    runtimeCapabilities: MediaRuntimeCapabilities | null,
  ): MediaRuntimeSupportLevel {
    if (this.isThumbnailRole(role)) {
      if (appCapabilityProfile === null && runtimeCapabilities === null) {
        return "unknown";
      }

      return appCapabilityProfile?.supportsThumbnailExtraction === true
        ? "supported"
        : "unsupported";
    }

    const laneSupportLevels: MediaRuntimeSupportLevel[] = [
      nativeLaneSupportLevel,
      shakaLaneSupportLevel,
      customLaneSupportLevel,
    ];

    if (laneSupportLevels.includes("supported")) {
      return "supported";
    }

    if (
      laneSupportLevels.includes("degraded") ||
      premiumPlaybackSupportLevel === "degraded"
    ) {
      return "degraded";
    }

    if (laneSupportLevels.includes("unknown")) {
      return "unknown";
    }

    return "unsupported";
  }

  /**
   * @brief Build the stable preferred lane order for one role
   *
   * @param request - Immutable capability request
   * @param probeResult - Support-level probe summary
   * @param reasons - Mutable reason collection
   * @param notes - Mutable note collection
   *
   * @returns Ordered viable lane list for the role
   */
  private static createPreferredLaneOrder(
    request: MediaRoleCapabilityRequest,
    probeResult: CapabilityProbeResult,
    reasons: CapabilityDecisionReason[],
    notes: string[],
  ): MediaPlaybackLane[] {
    const orderedLanes: Array<MediaPlaybackLane | null> = [];
    const premiumCapable: boolean =
      probeResult.premiumPlaybackSupportLevel === "supported" ||
      probeResult.premiumPlaybackSupportLevel === "degraded";

    if (request.runtimeLanePreference === "prefer-existing-runtime") {
      orderedLanes.push(
        request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
        request.preferredLaneHint,
        request.existingChosenLane,
        "native",
        "shaka",
        "custom",
      );
    } else if (request.runtimeLanePreference === "prefer-native") {
      orderedLanes.push(
        "native",
        request.preferredLaneHint,
        request.existingChosenLane,
        request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
        "shaka",
        "custom",
      );
    } else if (request.runtimeLanePreference === "prefer-shaka") {
      orderedLanes.push(
        "shaka",
        request.preferredLaneHint,
        request.existingChosenLane,
        request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
        "native",
        "custom",
      );
    } else if (this.isPreviewRole(request.role)) {
      orderedLanes.push(
        request.preferredLaneHint,
        request.existingChosenLane,
        "native",
        "shaka",
        "custom",
      );
    } else if (this.isThumbnailRole(request.role)) {
      orderedLanes.push(
        premiumCapable ? "shaka" : request.preferredLaneHint,
        "native",
        "shaka",
        "custom",
      );
    } else if (premiumCapable && this.isHighQualityRole(request.role)) {
      orderedLanes.push(
        request.preferredLaneHint,
        request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
        request.existingChosenLane,
        "shaka",
        "native",
        "custom",
      );
    } else {
      orderedLanes.push(
        request.preferredLaneHint,
        request.existingChosenLane,
        request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
        "native",
        "shaka",
        "custom",
      );
    }

    const preferredLaneOrder: MediaPlaybackLane[] = orderedLanes.filter(
      (lane: MediaPlaybackLane | null): lane is MediaPlaybackLane =>
        lane !== null && this.isLaneViableForProbe(lane, probeResult),
    );

    if (preferredLaneOrder.length > 0) {
      notes.push(
        `Preferred lane order for ${request.role}: ${preferredLaneOrder.join(" -> ")}.`,
      );
    }

    if (preferredLaneOrder[0] === "native") {
      notes.push("Native won the primary lane ordering for this role.");
    } else if (preferredLaneOrder[0] === "shaka") {
      notes.push("Shaka won the primary lane ordering for this role.");
    } else if (preferredLaneOrder[0] === "custom") {
      notes.push(
        "The existing custom runtime path remained the safest first choice.",
      );
    }

    return this.deduplicateLaneOrder(preferredLaneOrder);
  }

  /**
   * @brief Build a stable fallback order from the preferred order plus hints
   *
   * @param request - Immutable capability request
   * @param preferredLaneOrder - Lane order selected by the oracle
   *
   * @returns Stable fallback lane order with the primary lane removed
   */
  private static createPreferredFallbackLaneOrder(
    request: MediaRoleCapabilityRequest,
    preferredLaneOrder: MediaPlaybackLane[],
  ): MediaPlaybackLane[] {
    const fallbackCandidates: Array<MediaPlaybackLane | null> = [
      ...preferredLaneOrder.slice(1),
      request.preferredLaneHint,
      request.existingChosenLane,
      request.runtimeCapabilities?.existingBackgroundPlaybackLane ?? null,
    ];

    return this.deduplicateLaneOrder(
      fallbackCandidates.filter(
        (lane: MediaPlaybackLane | null): lane is MediaPlaybackLane =>
          lane !== null && lane !== preferredLaneOrder[0],
      ),
    );
  }

  /**
   * @brief Build the stable renderer order associated with the resolved lanes
   *
   * @param request - Immutable capability request
   * @param probeResult - Support-level probe summary
   * @param preferredLaneOrder - Lane ordering selected for the role
   *
   * @returns Stable renderer order
   */
  private static createPreferredRendererOrder(
    request: MediaRoleCapabilityRequest,
    probeResult: CapabilityProbeResult,
    preferredLaneOrder: MediaPlaybackLane[],
    rendererDecision: RendererDecision,
  ): MediaRendererKind[] {
    const rendererOrder: Array<MediaRendererKind | null> = [];
    const primaryLane: MediaPlaybackLane | null = preferredLaneOrder[0] ?? null;

    rendererOrder.push(request.preferredRendererKindHint);

    if (
      rendererDecision.shouldRouteThroughRenderer &&
      rendererDecision.selectedBackend !== null
    ) {
      rendererOrder.push(
        ...rendererDecision.preferredBackendOrder.map(
          (
            backendKind: RendererDecision["preferredBackendOrder"][number],
          ): MediaRendererKind | null =>
            this.mapBackendKindToRendererKind(backendKind),
        ),
      );
    } else if (
      rendererDecision.bypassesRendererRouter &&
      (primaryLane === "native" || primaryLane === "shaka")
    ) {
      rendererOrder.push("native-plane");
    }

    rendererOrder.push("none");

    return rendererOrder.filter(
      (
        rendererKind: MediaRendererKind | null,
      ): rendererKind is MediaRendererKind =>
        rendererKind !== null &&
        this.isRendererViableForProbe(rendererKind, probeResult),
    );
  }

  /**
   * @brief Convert one concrete backend kind into the shared renderer family
   *
   * @param backendKind - Concrete backend being mapped
   *
   * @returns Shared renderer family, or `null` when the backend is not routed
   */
  private static mapBackendKindToRendererKind(
    backendKind: RendererDecision["preferredBackendOrder"][number],
  ): MediaRendererKind | null {
    switch (backendKind) {
      case "webgpu":
        return "webgpu";
      case "webgl":
        return "webgl";
      case "none":
        return "none";
    }
  }

  /**
   * @brief Determine whether a lane survives the current probe result
   *
   * @param lane - Candidate playback lane
   * @param probeResult - Support-level probe snapshot
   *
   * @returns `true` when the lane remains viable
   */
  private static isLaneViableForProbe(
    lane: MediaPlaybackLane,
    probeResult: CapabilityProbeResult,
  ): boolean {
    switch (lane) {
      case "native":
        return probeResult.nativeLaneSupportLevel !== "unsupported";
      case "shaka":
        return probeResult.shakaLaneSupportLevel !== "unsupported";
      case "custom":
        return probeResult.customLaneSupportLevel !== "unsupported";
    }
  }

  /**
   * @brief Determine whether a renderer survives the current probe result
   *
   * @param rendererKind - Candidate renderer kind
   * @param probeResult - Support-level probe snapshot
   *
   * @returns `true` when the renderer remains viable
   */
  private static isRendererViableForProbe(
    rendererKind: MediaRendererKind,
    probeResult: CapabilityProbeResult,
  ): boolean {
    switch (rendererKind) {
      case "native-plane":
        return probeResult.nativeRendererSupportLevel !== "unsupported";
      case "webgpu":
        return probeResult.webgpuRendererSupportLevel !== "unsupported";
      case "webgl":
        return probeResult.webglRendererSupportLevel !== "unsupported";
      case "none":
        return true;
    }
  }

  /**
   * @brief Check whether the app profile reports support for the supplied lane
   *
   * @param lane - Candidate playback lane
   * @param appCapabilityProfile - App profile under evaluation
   *
   * @returns `true` when the app profile reports support for the lane
   */
  private static isLaneSupportedByProfile(
    lane: MediaPlaybackLane,
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): boolean {
    if (appCapabilityProfile === null) {
      return true;
    }

    switch (lane) {
      case "native":
        return appCapabilityProfile.supportsNativePlayback;
      case "shaka":
        return appCapabilityProfile.supportsShakaPlayback;
      case "custom":
        return appCapabilityProfile.supportsCustomPipeline;
    }
  }

  /**
   * @brief Identify low-cost roles that should avoid rich premium assumptions
   *
   * @param role - Shared media role under evaluation
   *
   * @returns `true` when the role favors startup cost over richness
   */
  private static isLowCostRole(role: VariantRolePolicy): boolean {
    return (
      role === "thumbnail-preview" ||
      role === "preview-warm" ||
      role === "preview-active"
    );
  }

  /**
   * @brief Identify roles that can justify higher quality when supported
   *
   * @param role - Shared media role under evaluation
   *
   * @returns `true` when the role favors higher quality
   */
  private static isHighQualityRole(role: VariantRolePolicy): boolean {
    return (
      role === "thumbnail-extract" ||
      role === "background-warm" ||
      role === "background-playback"
    );
  }

  /**
   * @brief Identify preview-scoped roles
   *
   * @param role - Shared media role under evaluation
   *
   * @returns `true` when the role belongs to preview orchestration
   */
  private static isPreviewRole(role: VariantRolePolicy): boolean {
    return role === "preview-warm" || role === "preview-active";
  }

  /**
   * @brief Identify thumbnail-scoped roles
   *
   * @param role - Shared media role under evaluation
   *
   * @returns `true` when the role belongs to thumbnail orchestration
   */
  private static isThumbnailRole(role: VariantRolePolicy): boolean {
    return role === "thumbnail-extract" || role === "thumbnail-preview";
  }

  /**
   * @brief Return the lane list known to the current shared media domain
   *
   * @returns Stable list of known playback lanes
   */
  private static getKnownPlaybackLanes(): MediaPlaybackLane[] {
    return ["native", "shaka", "custom"];
  }

  /**
   * @brief Resolve the custom decode lane associated with one shared role
   *
   * @param role - Shared media role under evaluation
   *
   * @returns Matching custom decode lane, or `null` when the role is excluded
   */
  private static resolveCustomDecodeLane(
    role: VariantRolePolicy,
  ): CustomDecodeLane | null {
    switch (role) {
      case "thumbnail-extract":
        return "thumbnail-extraction";
      case "preview-warm":
        return "preview-warm";
      case "preview-active":
        return "preview-active";
      case "thumbnail-preview":
      case "background-warm":
      case "background-playback":
        return null;
    }
  }

  /**
   * @brief Build the role-scoped custom decode capability summary
   *
   * @param request - Immutable capability request
   * @param probeResult - Shared probe summary already computed for the role
   *
   * @returns Inspectable custom decode capability snapshot
   */
  private static createCustomDecodeCapability(
    request: MediaRoleCapabilityRequest,
    probeResult: CapabilityProbeResult,
  ): CustomDecodeCapability {
    const lane: CustomDecodeLane | null = this.resolveCustomDecodeLane(
      request.role,
    );
    const reasons: CustomDecodeDecisionReason[] = [];
    const notes: string[] = [];
    const runtimeCapabilities: MediaRuntimeCapabilities | null =
      request.runtimeCapabilities;
    const appCapabilityProfile: MediaCapabilityProfile | null =
      request.appCapabilityProfile;

    if (lane === null) {
      reasons.push("role-disallows-custom-decode");
      notes.push(
        `The ${request.role} role keeps committed or non-extraction work on existing playback lanes in this phase.`,
      );

      return {
        lane: null,
        allowedByRole: false,
        supportLevel: "unsupported",
        webCodecsSupportLevel: probeResult.webCodecsSupportLevel,
        reasons,
        notes,
      };
    }

    reasons.push("role-allows-custom-decode");

    if (lane === "thumbnail-extraction") {
      reasons.push("preferred-for-extraction");
      notes.push(
        "Representative still extraction may attempt custom decode before falling back to the existing thumbnail runtime path.",
      );
    } else {
      reasons.push("preferred-for-preview");
      notes.push(
        "Preview-first-frame work may attempt custom decode before the runtime falls back to the existing preview lane.",
      );
    }

    if (probeResult.webCodecsSupportLevel === "supported") {
      reasons.push("webcodecs-supported");
    } else if (probeResult.webCodecsSupportLevel === "unsupported") {
      reasons.push("webcodecs-unsupported");
    }

    const appAllowsLane: boolean =
      lane === "thumbnail-extraction"
        ? appCapabilityProfile?.supportsCustomDecodeThumbnailExtraction === true
        : lane === "preview-warm"
          ? appCapabilityProfile?.supportsCustomDecodePreviewWarm === true
          : appCapabilityProfile?.supportsCustomDecodePreviewActive === true;
    const runtimeAllowsLane: boolean =
      runtimeCapabilities === null ||
      runtimeCapabilities.customDecodeLanes.includes(lane);
    const supportLevel: MediaRuntimeSupportLevel =
      probeResult.webCodecsSupportLevel !== "supported"
        ? probeResult.webCodecsSupportLevel
        : appAllowsLane && runtimeAllowsLane
          ? "supported"
          : "unsupported";

    if (!appAllowsLane || !runtimeAllowsLane) {
      notes.push(
        `The current app or runtime does not advertise ${lane} as a safe custom decode lane.`,
      );
    }

    return {
      lane,
      allowedByRole: true,
      supportLevel,
      webCodecsSupportLevel: probeResult.webCodecsSupportLevel,
      reasons,
      notes,
    };
  }

  /**
   * @brief Build the shared custom decode decision derived from capability data
   *
   * @param request - Immutable capability request
   * @param customDecodeCapability - Role-scoped capability summary
   *
   * @returns Inspectable custom decode decision
   */
  private static createCustomDecodeDecision(
    request: MediaRoleCapabilityRequest,
    customDecodeCapability: CustomDecodeCapability,
  ): CustomDecodeDecision {
    const reasons: CustomDecodeDecisionReason[] = [
      ...customDecodeCapability.reasons,
    ];
    const notes: string[] = [...customDecodeCapability.notes];
    const lane: CustomDecodeLane | null = customDecodeCapability.lane;

    if (
      lane === null ||
      !customDecodeCapability.allowedByRole ||
      customDecodeCapability.supportLevel !== "supported"
    ) {
      return {
        lane,
        shouldAttempt: false,
        preferred: false,
        fallbackRequired: true,
        fallbackReason:
          lane === null
            ? `The ${request.role} role deliberately stays on the existing non-custom-decode path in this phase.`
            : "Custom decode is unsupported for the current app or runtime profile.",
        reasons,
        notes,
      };
    }

    if (lane === "preview-active") {
      reasons.push("implementation-stub");
      reasons.push("runtime-fallback");
      notes.push(
        "Preview-active custom decode currently stops at frame preparation and still falls back to the established preview renderer path.",
      );

      return {
        lane,
        shouldAttempt: true,
        preferred: true,
        fallbackRequired: true,
        fallbackReason:
          "Preview-active custom decode still relies on the existing preview renderer path in this phase.",
        reasons,
        notes,
      };
    }

    return {
      lane,
      shouldAttempt: true,
      preferred: true,
      fallbackRequired: false,
      fallbackReason: null,
      reasons,
      notes,
    };
  }

  /**
   * @brief Deduplicate one ordered lane list while preserving order
   *
   * @param lanes - Ordered lanes to normalize
   *
   * @returns Deduplicated lane order
   */
  private static deduplicateLaneOrder(
    lanes: MediaPlaybackLane[],
  ): MediaPlaybackLane[] {
    const deduplicatedLanes: MediaPlaybackLane[] = [];

    for (const lane of lanes) {
      if (deduplicatedLanes.includes(lane)) {
        continue;
      }

      deduplicatedLanes.push(lane);
    }

    return deduplicatedLanes;
  }

  /**
   * @brief Clone one cached capability snapshot
   *
   * @param capabilitySnapshot - Snapshot to clone
   *
   * @returns Cloned snapshot
   */
  private static cloneSnapshot(
    capabilitySnapshot: MediaRoleCapabilitySnapshot,
  ): MediaRoleCapabilitySnapshot {
    return {
      cacheKey: capabilitySnapshot.cacheKey,
      request: this.cloneRequest(capabilitySnapshot.request),
      probeResult: this.cloneProbeResult(capabilitySnapshot.probeResult),
      decision: this.cloneDecision(capabilitySnapshot.decision),
      rendererCapability: RendererRouter.cloneCapability(
        capabilitySnapshot.rendererCapability,
      )!,
      rendererDecision: RendererRouter.cloneDecision(
        capabilitySnapshot.rendererDecision,
      )!,
      customDecodeCapability: this.cloneCustomDecodeCapability(
        capabilitySnapshot.customDecodeCapability,
      ),
      customDecodeDecision: this.cloneCustomDecodeDecision(
        capabilitySnapshot.customDecodeDecision,
      ),
    };
  }

  /**
   * @brief Clone one capability request
   *
   * @param request - Capability request to clone
   *
   * @returns Cloned request
   */
  private static cloneRequest(
    request: MediaRoleCapabilityRequest,
  ): MediaRoleCapabilityRequest {
    return {
      role: request.role,
      appCapabilityProfile:
        request.appCapabilityProfile === null
          ? null
          : {
              supportsNativePlayback:
                request.appCapabilityProfile.supportsNativePlayback,
              supportsShakaPlayback:
                request.appCapabilityProfile.supportsShakaPlayback,
              supportsPreviewVideo:
                request.appCapabilityProfile.supportsPreviewVideo,
              supportsThumbnailExtraction:
                request.appCapabilityProfile.supportsThumbnailExtraction,
              supportsWebCodecs: request.appCapabilityProfile.supportsWebCodecs,
              supportsCustomDecodeThumbnailExtraction:
                request.appCapabilityProfile
                  .supportsCustomDecodeThumbnailExtraction,
              supportsCustomDecodePreviewWarm:
                request.appCapabilityProfile.supportsCustomDecodePreviewWarm,
              supportsCustomDecodePreviewActive:
                request.appCapabilityProfile.supportsCustomDecodePreviewActive,
              supportsWorkerOffload:
                request.appCapabilityProfile.supportsWorkerOffload,
              supportsWebGPUPreferred:
                request.appCapabilityProfile.supportsWebGPUPreferred,
              supportsWebGLFallback:
                request.appCapabilityProfile.supportsWebGLFallback,
              supportsCustomPipeline:
                request.appCapabilityProfile.supportsCustomPipeline,
              supportsPremiumPlayback:
                request.appCapabilityProfile.supportsPremiumPlayback,
              previewSchedulerBudget: {
                maxWarmSessions:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxWarmSessions,
                maxActivePreviewSessions:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxActivePreviewSessions,
                maxRendererBoundSessions:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxRendererBoundSessions,
                maxHiddenSessions:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxHiddenSessions,
                maxPreviewReuseMs:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxPreviewReuseMs,
                maxPreviewOverlapMs:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .maxPreviewOverlapMs,
                keepWarmAfterBlurMs:
                  request.appCapabilityProfile.previewSchedulerBudget
                    .keepWarmAfterBlurMs,
              },
            },
      runtimeCapabilities:
        request.runtimeCapabilities === null
          ? null
          : {
              canWarmFirstFrame: request.runtimeCapabilities.canWarmFirstFrame,
              canActivateBackground:
                request.runtimeCapabilities.canActivateBackground,
              canPreviewInline: request.runtimeCapabilities.canPreviewInline,
              canKeepHiddenWarmSession:
                request.runtimeCapabilities.canKeepHiddenWarmSession,
              canPromoteWarmSession:
                request.runtimeCapabilities.canPromoteWarmSession,
              canRunMultipleWarmSessions:
                request.runtimeCapabilities.canRunMultipleWarmSessions,
              supportsWebCodecs: request.runtimeCapabilities.supportsWebCodecs,
              supportsWebGpuRenderer:
                request.runtimeCapabilities.supportsWebGpuRenderer,
              supportsWebGlRenderer:
                request.runtimeCapabilities.supportsWebGlRenderer,
              supportsRendererPreviewRouting:
                request.runtimeCapabilities.supportsRendererPreviewRouting,
              supportsRendererExtractionRouting:
                request.runtimeCapabilities.supportsRendererExtractionRouting,
              committedPlaybackBypassesRendererRouter:
                request.runtimeCapabilities
                  .committedPlaybackBypassesRendererRouter,
              customDecodeLanes: [
                ...request.runtimeCapabilities.customDecodeLanes,
              ],
              supportsCommittedPlayback:
                request.runtimeCapabilities.supportsCommittedPlayback,
              supportsPremiumCommittedPlayback:
                request.runtimeCapabilities.supportsPremiumCommittedPlayback,
              committedPlaybackLanePreference:
                request.runtimeCapabilities.committedPlaybackLanePreference,
              committedPlaybackLanes: [
                ...request.runtimeCapabilities.committedPlaybackLanes,
              ],
              existingBackgroundPlaybackLane:
                request.runtimeCapabilities.existingBackgroundPlaybackLane,
              previewSchedulerBudget: {
                maxWarmSessions:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxWarmSessions,
                maxActivePreviewSessions:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxActivePreviewSessions,
                maxRendererBoundSessions:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxRendererBoundSessions,
                maxHiddenSessions:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxHiddenSessions,
                maxPreviewReuseMs:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxPreviewReuseMs,
                maxPreviewOverlapMs:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .maxPreviewOverlapMs,
                keepWarmAfterBlurMs:
                  request.runtimeCapabilities.previewSchedulerBudget
                    .keepWarmAfterBlurMs,
              },
              audioCapabilities: {
                canPlayCommittedAudio:
                  request.runtimeCapabilities.audioCapabilities
                    .canPlayCommittedAudio,
                canAttemptPremiumAudio:
                  request.runtimeCapabilities.audioCapabilities
                    .canAttemptPremiumAudio,
                canFallbackStereo:
                  request.runtimeCapabilities.audioCapabilities
                    .canFallbackStereo,
                canKeepPreviewMuted:
                  request.runtimeCapabilities.audioCapabilities
                    .canKeepPreviewMuted,
                canKeepExtractionSilent:
                  request.runtimeCapabilities.audioCapabilities
                    .canKeepExtractionSilent,
              },
            },
      preferredLaneHint: request.preferredLaneHint,
      preferredRendererKindHint: request.preferredRendererKindHint,
      existingChosenLane: request.existingChosenLane,
      runtimeLanePreference: request.runtimeLanePreference,
    };
  }

  /**
   * @brief Clone one probe snapshot
   *
   * @param probeResult - Probe snapshot to clone
   *
   * @returns Cloned probe snapshot
   */
  private static cloneProbeResult(
    probeResult: CapabilityProbeResult,
  ): CapabilityProbeResult {
    return {
      overallSupportLevel: probeResult.overallSupportLevel,
      nativeLaneSupportLevel: probeResult.nativeLaneSupportLevel,
      shakaLaneSupportLevel: probeResult.shakaLaneSupportLevel,
      customLaneSupportLevel: probeResult.customLaneSupportLevel,
      webCodecsSupportLevel: probeResult.webCodecsSupportLevel,
      nativeRendererSupportLevel: probeResult.nativeRendererSupportLevel,
      webgpuRendererSupportLevel: probeResult.webgpuRendererSupportLevel,
      webglRendererSupportLevel: probeResult.webglRendererSupportLevel,
      previewRendererRoutingSupportLevel:
        probeResult.previewRendererRoutingSupportLevel,
      extractionRendererRoutingSupportLevel:
        probeResult.extractionRendererRoutingSupportLevel,
      committedPlaybackBypassesRendererRouter:
        probeResult.committedPlaybackBypassesRendererRouter,
      premiumPlaybackSupportLevel: probeResult.premiumPlaybackSupportLevel,
      workerOffloadSupportLevel: probeResult.workerOffloadSupportLevel,
    };
  }

  /**
   * @brief Clone one capability decision
   *
   * @param decision - Capability decision to clone
   *
   * @returns Cloned decision
   */
  private static cloneDecision(
    decision: CapabilityDecision,
  ): CapabilityDecision {
    return {
      supportLevel: decision.supportLevel,
      preferredLaneOrder: [...decision.preferredLaneOrder],
      preferredFallbackLaneOrder: [...decision.preferredFallbackLaneOrder],
      preferredRendererOrder: [...decision.preferredRendererOrder],
      premiumPlaybackViable: decision.premiumPlaybackViable,
      workerOffloadViable: decision.workerOffloadViable,
      reasons: [...decision.reasons],
      notes: [...decision.notes],
    };
  }

  /**
   * @brief Clone one custom decode capability summary
   *
   * @param customDecodeCapability - Capability summary to clone
   *
   * @returns Cloned custom decode capability summary
   */
  private static cloneCustomDecodeCapability(
    customDecodeCapability: CustomDecodeCapability,
  ): CustomDecodeCapability {
    return {
      lane: customDecodeCapability.lane,
      allowedByRole: customDecodeCapability.allowedByRole,
      supportLevel: customDecodeCapability.supportLevel,
      webCodecsSupportLevel: customDecodeCapability.webCodecsSupportLevel,
      reasons: [...customDecodeCapability.reasons],
      notes: [...customDecodeCapability.notes],
    };
  }

  /**
   * @brief Clone one custom decode decision
   *
   * @param customDecodeDecision - Decision to clone
   *
   * @returns Cloned custom decode decision
   */
  private static cloneCustomDecodeDecision(
    customDecodeDecision: CustomDecodeDecision,
  ): CustomDecodeDecision {
    return {
      lane: customDecodeDecision.lane,
      shouldAttempt: customDecodeDecision.shouldAttempt,
      preferred: customDecodeDecision.preferred,
      fallbackRequired: customDecodeDecision.fallbackRequired,
      fallbackReason: customDecodeDecision.fallbackReason,
      reasons: [...customDecodeDecision.reasons],
      notes: [...customDecodeDecision.notes],
    };
  }
}
