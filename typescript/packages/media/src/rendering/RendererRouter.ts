/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaRuntimeSupportLevel } from "../capability-oracle/MediaRuntimeSupportLevel";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { MediaSessionRole } from "../sessions/MediaSessionRole";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { RendererBackendKind } from "./RendererBackendKind";
import type { RendererCapability } from "./RendererCapability";
import type { RendererDecision } from "./RendererDecision";
import type { RendererDecisionReason } from "./RendererDecisionReason";
import type { RendererFrameHandle } from "./RendererFrameHandle";
import type { RendererSessionBinding } from "./RendererSessionBinding";
import type { RendererSnapshot } from "./RendererSnapshot";

type RendererRouterDecisionInput = {
  role: VariantRolePolicy;
  preferredRendererKindHint: MediaRendererKind | null;
  webgpuSupportLevel: MediaRuntimeSupportLevel;
  webglSupportLevel: MediaRuntimeSupportLevel;
  previewRendererRoutingSupportLevel: MediaRuntimeSupportLevel;
  extractionRendererRoutingSupportLevel: MediaRuntimeSupportLevel;
  committedPlaybackBypassesRendererRouter: boolean;
};

type RendererRouterSnapshotInput = {
  capability: RendererCapability | null;
  decision: RendererDecision | null;
  sessionId: string;
  sessionRole: MediaSessionRole;
  variantRole: VariantRolePolicy | null;
  target: RendererSessionBinding["target"];
  selectedBackend: RendererBackendKind | null;
  activeBackend: RendererBackendKind | null;
  usedLegacyPath: boolean;
  bypassedRendererRouter: boolean;
  fallbackReason: string | null;
  failureReason: string | null;
  frameHandle: RendererFrameHandle | null;
  reasons?: RendererDecisionReason[];
  notes?: string[];
};

/**
 * @brief Shared helper that keeps renderer choice deterministic and cloneable
 */
export class RendererRouter {
  /**
   * @brief Resolve one inspectable capability and decision pair for a role
   *
   * @param input - Immutable renderer routing inputs
   *
   * @returns Capability and decision summaries derived from the role
   */
  public static decide(input: RendererRouterDecisionInput): {
    capability: RendererCapability;
    decision: RendererDecision;
  } {
    const capabilityReasons: RendererDecisionReason[] = [];
    const capabilityNotes: string[] = [];
    const rendererRoutingSupportLevel: MediaRuntimeSupportLevel =
      this.resolveRendererRoutingSupportLevel(
        input.role,
        input.previewRendererRoutingSupportLevel,
        input.extractionRendererRoutingSupportLevel,
      );
    const rendererRoutingAllowed: boolean =
      rendererRoutingSupportLevel === "supported" ||
      rendererRoutingSupportLevel === "degraded";
    const bypassesRendererRouter: boolean =
      this.isCommittedRole(input.role) &&
      input.committedPlaybackBypassesRendererRouter;

    if (input.webgpuSupportLevel === "supported") {
      capabilityReasons.push("webgpu-supported");
      capabilityNotes.push(
        "WebGPU is available for renderer-router work in the current environment.",
      );
    } else {
      capabilityReasons.push("webgpu-unsupported");
      capabilityNotes.push(
        "WebGPU is not currently available for this renderer-router session.",
      );
    }

    if (input.webglSupportLevel === "supported") {
      capabilityReasons.push("webgl-supported");
      capabilityNotes.push(
        "WebGL remains available as the explicit fallback renderer backend.",
      );
    }

    if (rendererRoutingAllowed) {
      capabilityReasons.push("role-prefers-renderer");
      capabilityNotes.push(
        `The ${input.role} role may use the renderer router in this phase.`,
      );
    } else if (this.isCommittedRole(input.role)) {
      capabilityNotes.push(
        `The ${input.role} role deliberately stays on the existing committed playback path in this phase.`,
      );
    } else {
      capabilityNotes.push(
        `The ${input.role} role does not currently have a safe renderer-router path.`,
      );
    }

    const capability: RendererCapability = {
      role: input.role,
      webgpuSupportLevel: input.webgpuSupportLevel,
      webglSupportLevel: input.webglSupportLevel,
      rendererRoutingSupportLevel,
      rendererRoutingAllowed,
      committedPlaybackBypassesRendererRouter:
        input.committedPlaybackBypassesRendererRouter,
      reasons: capabilityReasons,
      notes: capabilityNotes,
    };
    const decisionReasons: RendererDecisionReason[] = [...capabilityReasons];
    const decisionNotes: string[] = [...capabilityNotes];
    const preferredBackendOrder: RendererBackendKind[] = rendererRoutingAllowed
      ? this.createPreferredBackendOrder(input.preferredRendererKindHint)
      : ["none"];
    const fallbackBackendOrder: RendererBackendKind[] = rendererRoutingAllowed
      ? ["webgl", "none"]
      : ["none"];
    const selectedBackend: RendererBackendKind | null = rendererRoutingAllowed
      ? this.selectBackend(input.webgpuSupportLevel, input.webglSupportLevel)
      : null;
    let fallbackRequired: boolean = false;
    let fallbackReason: string | null = null;

    if (bypassesRendererRouter) {
      decisionNotes.push(
        "Committed and background playback intentionally bypass the renderer router in this phase.",
      );
    }

    if (
      rendererRoutingAllowed &&
      selectedBackend === "webgl" &&
      preferredBackendOrder[0] === "webgpu"
    ) {
      fallbackRequired = true;
      fallbackReason =
        "WebGPU was unavailable, so the renderer router fell back to WebGL.";
      decisionReasons.push("webgl-fallback");
      decisionNotes.push(fallbackReason);
    } else if (rendererRoutingAllowed && selectedBackend === null) {
      fallbackRequired = true;
      fallbackReason =
        "No supported renderer backend remained available, so the session stayed on the legacy presentation path.";
      decisionNotes.push(fallbackReason);
    }

    return {
      capability,
      decision: {
        role: input.role,
        shouldRouteThroughRenderer:
          rendererRoutingAllowed && selectedBackend !== null,
        bypassesRendererRouter,
        preferredBackendOrder,
        fallbackBackendOrder,
        selectedBackend,
        fallbackRequired,
        fallbackReason,
        reasons: decisionReasons,
        notes: decisionNotes,
      },
    };
  }

  /**
   * @brief Build one shared renderer snapshot from routing and runtime detail
   *
   * @param input - Snapshot payload being normalized
   *
   * @returns Immutable renderer snapshot
   */
  public static createSnapshot(
    input: RendererRouterSnapshotInput,
  ): RendererSnapshot {
    const reasons: RendererDecisionReason[] = this.deduplicateReasons([
      ...(input.capability?.reasons ?? []),
      ...(input.decision?.reasons ?? []),
      ...(input.reasons ?? []),
    ]);
    const notes: string[] = [
      ...(input.capability?.notes ?? []),
      ...(input.decision?.notes ?? []),
      ...(input.notes ?? []),
    ];

    return {
      capability: this.cloneCapability(input.capability),
      decision: this.cloneDecision(input.decision),
      binding:
        input.selectedBackend === null && input.activeBackend === null
          ? null
          : {
              sessionId: input.sessionId,
              sessionRole: input.sessionRole,
              variantRole: input.variantRole,
              backendKind:
                input.activeBackend ?? input.selectedBackend ?? "none",
              target: input.target,
            },
      selectedBackend: input.selectedBackend,
      activeBackend: input.activeBackend,
      usedLegacyPath: input.usedLegacyPath,
      bypassedRendererRouter: input.bypassedRendererRouter,
      fallbackReason: input.fallbackReason,
      failureReason: input.failureReason,
      frameHandle: this.cloneFrameHandle(input.frameHandle),
      reasons,
      notes,
    };
  }

  /**
   * @brief Clone one shared renderer snapshot
   *
   * @param rendererSnapshot - Snapshot to clone
   *
   * @returns Cloned snapshot, or `null` when absent
   */
  public static cloneSnapshot(
    rendererSnapshot: RendererSnapshot | null,
  ): RendererSnapshot | null {
    if (rendererSnapshot === null) {
      return null;
    }

    return {
      capability: this.cloneCapability(rendererSnapshot.capability),
      decision: this.cloneDecision(rendererSnapshot.decision),
      binding:
        rendererSnapshot.binding === null
          ? null
          : {
              sessionId: rendererSnapshot.binding.sessionId,
              sessionRole: rendererSnapshot.binding.sessionRole,
              variantRole: rendererSnapshot.binding.variantRole,
              backendKind: rendererSnapshot.binding.backendKind,
              target: rendererSnapshot.binding.target,
            },
      selectedBackend: rendererSnapshot.selectedBackend,
      activeBackend: rendererSnapshot.activeBackend,
      usedLegacyPath: rendererSnapshot.usedLegacyPath,
      bypassedRendererRouter: rendererSnapshot.bypassedRendererRouter,
      fallbackReason: rendererSnapshot.fallbackReason,
      failureReason: rendererSnapshot.failureReason,
      frameHandle: this.cloneFrameHandle(rendererSnapshot.frameHandle),
      reasons: [...rendererSnapshot.reasons],
      notes: [...rendererSnapshot.notes],
    };
  }

  /**
   * @brief Clone one renderer capability payload
   *
   * @param rendererCapability - Capability payload to clone
   *
   * @returns Cloned capability payload, or `null` when absent
   */
  public static cloneCapability(
    rendererCapability: RendererCapability | null,
  ): RendererCapability | null {
    if (rendererCapability === null) {
      return null;
    }

    return {
      role: rendererCapability.role,
      webgpuSupportLevel: rendererCapability.webgpuSupportLevel,
      webglSupportLevel: rendererCapability.webglSupportLevel,
      rendererRoutingSupportLevel:
        rendererCapability.rendererRoutingSupportLevel,
      rendererRoutingAllowed: rendererCapability.rendererRoutingAllowed,
      committedPlaybackBypassesRendererRouter:
        rendererCapability.committedPlaybackBypassesRendererRouter,
      reasons: [...rendererCapability.reasons],
      notes: [...rendererCapability.notes],
    };
  }

  /**
   * @brief Clone one renderer decision payload
   *
   * @param rendererDecision - Decision payload to clone
   *
   * @returns Cloned decision payload, or `null` when absent
   */
  public static cloneDecision(
    rendererDecision: RendererDecision | null,
  ): RendererDecision | null {
    if (rendererDecision === null) {
      return null;
    }

    return {
      role: rendererDecision.role,
      shouldRouteThroughRenderer: rendererDecision.shouldRouteThroughRenderer,
      bypassesRendererRouter: rendererDecision.bypassesRendererRouter,
      preferredBackendOrder: [...rendererDecision.preferredBackendOrder],
      fallbackBackendOrder: [...rendererDecision.fallbackBackendOrder],
      selectedBackend: rendererDecision.selectedBackend,
      fallbackRequired: rendererDecision.fallbackRequired,
      fallbackReason: rendererDecision.fallbackReason,
      reasons: [...rendererDecision.reasons],
      notes: [...rendererDecision.notes],
    };
  }

  /**
   * @brief Clone one renderer frame handle
   *
   * @param rendererFrameHandle - Frame handle to clone
   *
   * @returns Cloned frame handle, or `null` when absent
   */
  public static cloneFrameHandle(
    rendererFrameHandle: RendererFrameHandle | null,
  ): RendererFrameHandle | null {
    if (rendererFrameHandle === null) {
      return null;
    }

    return {
      representation: rendererFrameHandle.representation,
      origin: rendererFrameHandle.origin,
      width: rendererFrameHandle.width,
      height: rendererFrameHandle.height,
      frameTimeMs: rendererFrameHandle.frameTimeMs,
    };
  }

  /**
   * @brief Resolve routing support from the current role and support levels
   *
   * @param role - Role currently being evaluated
   * @param previewRendererRoutingSupportLevel - Preview support level
   * @param extractionRendererRoutingSupportLevel - Extraction support level
   *
   * @returns Role-specific routing support level
   */
  private static resolveRendererRoutingSupportLevel(
    role: VariantRolePolicy,
    previewRendererRoutingSupportLevel: MediaRuntimeSupportLevel,
    extractionRendererRoutingSupportLevel: MediaRuntimeSupportLevel,
  ): MediaRuntimeSupportLevel {
    if (this.isPreviewRole(role)) {
      return previewRendererRoutingSupportLevel;
    }

    if (this.isExtractionRole(role)) {
      return extractionRendererRoutingSupportLevel;
    }

    return "unsupported";
  }

  /**
   * @brief Build the stable preferred backend order for routed roles
   *
   * @param preferredRendererKindHint - Existing shared renderer hint
   *
   * @returns Ordered backend preference list
   */
  private static createPreferredBackendOrder(
    preferredRendererKindHint: MediaRendererKind | null,
  ): RendererBackendKind[] {
    void preferredRendererKindHint;

    return ["webgpu", "webgl"];
  }

  /**
   * @brief Pick the first viable backend from the fixed preference order
   *
   * @param webgpuSupportLevel - WebGPU support level
   * @param webglSupportLevel - WebGL support level
   *
   * @returns Chosen backend, or `null` when none remains viable
   */
  private static selectBackend(
    webgpuSupportLevel: MediaRuntimeSupportLevel,
    webglSupportLevel: MediaRuntimeSupportLevel,
  ): RendererBackendKind | null {
    if (webgpuSupportLevel === "supported") {
      return "webgpu";
    }

    if (webglSupportLevel === "supported") {
      return "webgl";
    }

    return null;
  }

  /**
   * @brief Check whether a role belongs to preview routing work
   *
   * @param role - Role under evaluation
   *
   * @returns `true` when the role is preview-scoped
   */
  private static isPreviewRole(role: VariantRolePolicy): boolean {
    return role === "preview-warm" || role === "preview-active";
  }

  /**
   * @brief Check whether a role belongs to extraction or thumbnail routing work
   *
   * @param role - Role under evaluation
   *
   * @returns `true` when the role is extraction-scoped
   */
  private static isExtractionRole(role: VariantRolePolicy): boolean {
    return role === "thumbnail-extract" || role === "thumbnail-preview";
  }

  /**
   * @brief Check whether a role belongs to committed playback work
   *
   * @param role - Role under evaluation
   *
   * @returns `true` when the role is committed or background playback
   */
  private static isCommittedRole(role: VariantRolePolicy): boolean {
    return role === "background-warm" || role === "background-playback";
  }

  /**
   * @brief Deduplicate ordered reason codes while preserving order
   *
   * @param reasons - Reason codes to normalize
   *
   * @returns Deduplicated reason-code array
   */
  private static deduplicateReasons(
    reasons: RendererDecisionReason[],
  ): RendererDecisionReason[] {
    const deduplicatedReasons: RendererDecisionReason[] = [];

    for (const reason of reasons) {
      if (deduplicatedReasons.includes(reason)) {
        continue;
      }

      deduplicatedReasons.push(reason);
    }

    return deduplicatedReasons;
  }
}
