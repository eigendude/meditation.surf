/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaCapabilityProfile } from "../capabilities/MediaCapabilityProfile";
import { CapabilityOracle } from "../capability-oracle/CapabilityOracle";
import type { MediaRoleCapabilitySnapshot } from "../capability-oracle/MediaRoleCapabilitySnapshot";
import type { CustomDecodeDecision } from "../custom-decode/CustomDecodeDecision";
import type { MediaIntent } from "../intent/MediaIntent";
import type { MediaKernelItem } from "../kernel/MediaKernelItem";
import type { MediaKernelState } from "../kernel/MediaKernelState";
import type { PreviewCandidate } from "../preview/PreviewCandidate";
import type { PreviewCandidateInput } from "../preview/PreviewCandidateInput";
import type { PreviewCandidateScore } from "../preview/PreviewCandidateScore";
import type { PreviewFarmState } from "../preview/PreviewFarmState";
import { PreviewScheduler } from "../preview/PreviewScheduler";
import type { PreviewSchedulerDecision } from "../preview/PreviewSchedulerDecision";
import type { PreviewSchedulerDecisionReason } from "../preview/PreviewSchedulerDecisionReason";
import type { PreviewWarmState } from "../preview/PreviewWarmState";
import type { MediaPlaybackLane } from "../sessions/MediaPlaybackLane";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { MediaSessionRole } from "../sessions/MediaSessionRole";
import type { MediaSourceDescriptor } from "../sources/MediaSourceDescriptor";
import type { TelemetrySnapshot } from "../telemetry/TelemetrySnapshot";
import type { AdaptiveBudgetDecision } from "../tuning/AdaptiveBudgetDecision";
import type { RuntimeGuardrailState } from "../tuning/RuntimeGuardrailState";
import { VariantPolicy } from "../variant-policy/VariantPolicy";
import type { VariantRolePolicy } from "../variant-policy/VariantRolePolicy";
import type { VariantSelectionDecision } from "../variant-policy/VariantSelectionDecision";
import type { MediaPlan } from "./MediaPlan";
import type { MediaPlanReason } from "./MediaPlanReason";
import type { MediaPlanSession } from "./MediaPlanSession";

type PlannedRoleDecision = {
  capabilitySnapshot: MediaRoleCapabilitySnapshot;
  customDecodeDecision: CustomDecodeDecision;
  fallbackPlaybackLaneOrder: MediaPlaybackLane[];
  desiredPlaybackLane: MediaPlaybackLane | null;
  desiredRendererKind: MediaRendererKind;
  variantSelection: VariantSelectionDecision;
};

/**
 * @brief Deterministic inputs used to build one shared media session plan
 */
export type MediaSessionPlannerInput<
  TMediaItem extends MediaKernelItem = MediaKernelItem,
> = {
  appCapabilityProfile: MediaCapabilityProfile | null;
  currentMediaKernelState: MediaKernelState;
  mediaIntent: MediaIntent | null;
  focusedItem: TMediaItem | null;
  selectedItem: TMediaItem | null;
  activeItem: TMediaItem | null;
  adaptiveBudgetDecision: AdaptiveBudgetDecision;
  previewCandidateInputs: PreviewCandidateInput<TMediaItem>[];
  planningNowMs: number;
  runtimeGuardrailState: RuntimeGuardrailState;
  telemetry: TelemetrySnapshot;
  createSourceDescriptor: (mediaItem: TMediaItem) => MediaSourceDescriptor;
};

/**
 * @brief Convert shared browse and playback intent into logical media sessions
 *
 * The planner is intentionally pure. It does not mutate controller state,
 * start playback, or inspect any runtime objects beyond immutable descriptors.
 */
export class MediaSessionPlanner {
  /**
   * @brief Build a deterministic session plan for the current orchestration inputs
   *
   * @param input - Current capability, intent, and content context
   *
   * @returns Planned sessions ordered by importance and role
   */
  public static createPlan<TMediaItem extends MediaKernelItem>(
    input: MediaSessionPlannerInput<TMediaItem>,
  ): MediaPlan {
    const plannedSessions: MediaPlanSession[] = [];
    const selectedItem: TMediaItem | null = input.selectedItem;
    const activeItem: TMediaItem | null = input.activeItem;
    const appCapabilityProfile: MediaCapabilityProfile | null =
      input.appCapabilityProfile;
    const currentIntentType: MediaIntent["type"] =
      input.mediaIntent?.type ?? "idle";
    const backgroundItem: TMediaItem | null = selectedItem ?? activeItem;

    if (backgroundItem !== null) {
      plannedSessions.push(
        this.createBackgroundSession(
          backgroundItem,
          selectedItem !== null ? "selected" : "background-active",
          appCapabilityProfile,
          selectedItem !== null ? "selected-item" : "background-active-item",
          input.createSourceDescriptor,
        ),
      );
    } else if (
      currentIntentType === "idle" &&
      this.hasActiveBackgroundSession(input.currentMediaKernelState)
    ) {
      plannedSessions.push(
        this.createPreservedBackgroundSession(
          input.currentMediaKernelState,
          appCapabilityProfile,
        ),
      );
    }

    const previewCandidates: PreviewCandidate[] = this.createPreviewCandidates(
      input,
      backgroundItem?.id ?? null,
    );
    const previousPreviewFarmState: PreviewFarmState =
      input.currentMediaKernelState.plan.previewFarm;
    const previewFarmState: PreviewFarmState = PreviewScheduler.createState({
      previewCandidates,
      supportsPreviewVideo: appCapabilityProfile?.supportsPreviewVideo === true,
      previewBudget: input.adaptiveBudgetDecision.effectiveBudget,
      currentlyPlannedWarmSessionIds: previousPreviewFarmState.warmedSessionIds,
      currentlyPlannedActiveSessionIds:
        previousPreviewFarmState.activeSessionIds,
      currentSessionAssignments: previousPreviewFarmState.sessionAssignments,
      backgroundItemId: backgroundItem?.id ?? null,
      mediaIntentType: currentIntentType,
      adaptiveBudgetDecision: input.adaptiveBudgetDecision,
      nowMs: input.planningNowMs,
      runtimeGuardrailState: input.runtimeGuardrailState,
      telemetry: input.telemetry,
    });
    const previewSessions: MediaPlanSession[] =
      this.createPreviewPlanSessionsFromFarm(previewFarmState, input);

    plannedSessions.push(...previewSessions);

    return {
      sessions: plannedSessions.sort(
        (
          leftPlannedSession: MediaPlanSession,
          rightPlannedSession: MediaPlanSession,
        ): number =>
          this.comparePlannedSessions(leftPlannedSession, rightPlannedSession),
      ),
      previewFarm: this.clonePreviewFarmState(previewFarmState),
    };
  }

  /**
   * @brief Determine whether the current kernel already tracks an active background session
   *
   * @param currentMediaKernelState - Current immutable kernel snapshot
   *
   * @returns `true` when a background session already exists in active state
   */
  private static hasActiveBackgroundSession(
    currentMediaKernelState: MediaKernelState,
  ): boolean {
    return currentMediaKernelState.sessions.some(
      (sessionSnapshot: MediaKernelState["sessions"][number]): boolean =>
        sessionSnapshot.descriptor.role === "background" &&
        this.isActiveBackgroundSessionState(sessionSnapshot.state),
    );
  }

  /**
   * @brief Create a background-oriented session plan entry
   *
   * @param mediaItem - Item that should own the logical background session
   * @param intentType - Logical intent that led to background planning
   * @param appCapabilityProfile - Runtime capability profile for the current app
   * @param reasonKind - Reason variant recorded in debug output
   *
   * @returns Planned background session
   */
  private static createBackgroundSession<TMediaItem extends MediaKernelItem>(
    mediaItem: TMediaItem,
    intentType: "selected" | "background-active",
    appCapabilityProfile: MediaCapabilityProfile | null,
    reasonKind: "selected-item" | "background-active-item",
    createSourceDescriptor: (mediaItem: TMediaItem) => MediaSourceDescriptor,
  ): MediaPlanSession {
    const sourceDescriptor: MediaSourceDescriptor =
      createSourceDescriptor(mediaItem);
    const plannedRoleDecision: PlannedRoleDecision =
      this.createPlannedRoleDecision(
        "background-playback",
        appCapabilityProfile,
        this.selectBackgroundPlaybackLane(appCapabilityProfile),
        this.selectRendererKind(appCapabilityProfile),
      );

    return {
      sessionId: this.createSessionId("background", sourceDescriptor),
      itemId: mediaItem.id,
      source: sourceDescriptor,
      role: "background",
      capabilitySnapshot: plannedRoleDecision.capabilitySnapshot,
      customDecodeDecision: plannedRoleDecision.customDecodeDecision,
      fallbackPlaybackLaneOrder: plannedRoleDecision.fallbackPlaybackLaneOrder,
      desiredPlaybackLane: plannedRoleDecision.desiredPlaybackLane,
      variantSelection: plannedRoleDecision.variantSelection,
      desiredRendererKind: plannedRoleDecision.desiredRendererKind,
      desiredWarmth: "active",
      priority: "critical",
      visibility: "visible",
      reason: {
        intentType,
        kind: reasonKind,
        message:
          reasonKind === "selected-item"
            ? "Selected item should own the background playback session"
            : "Current active playback item should remain the background playback target",
      },
    };
  }

  /**
   * @brief Convert browse-derived preview inputs into scored shared candidates
   *
   * @param input - Planner inputs including browse-driven preview targets
   * @param backgroundItemId - Item currently reserved for background playback
   *
   * @returns Runtime-agnostic preview candidates sorted later by the scheduler
   */
  private static createPreviewCandidates<TMediaItem extends MediaKernelItem>(
    input: MediaSessionPlannerInput<TMediaItem>,
    backgroundItemId: string | null,
  ): PreviewCandidate[] {
    const previewCandidates: PreviewCandidate[] = [];
    const seenSessionIds: Set<string> = new Set<string>();
    const previewWarmRoleDecision: PlannedRoleDecision =
      this.createPlannedRoleDecision(
        "preview-warm",
        input.appCapabilityProfile,
        this.selectPreviewPlaybackLane(input.appCapabilityProfile),
        this.selectRendererKind(input.appCapabilityProfile),
      );

    for (const previewCandidateInput of input.previewCandidateInputs) {
      if (previewCandidateInput.mediaItem.id === backgroundItemId) {
        continue;
      }

      const sourceDescriptor: MediaSourceDescriptor =
        input.createSourceDescriptor(previewCandidateInput.mediaItem);
      const sessionId: string = this.createSessionId(
        "preview",
        sourceDescriptor,
      );
      const currentWarmState: PreviewWarmState =
        this.resolveCurrentPreviewWarmState(
          input.currentMediaKernelState,
          sessionId,
        );
      const canUseCustomDecode: boolean =
        previewWarmRoleDecision.customDecodeDecision.shouldAttempt &&
        !input.runtimeGuardrailState.disableCustomDecodePreviewWarm;
      const canUseWebGpuRenderer: boolean =
        previewWarmRoleDecision.capabilitySnapshot.rendererDecision.preferredBackendOrder.includes(
          "webgpu",
        );
      const canUseWebGlRenderer: boolean =
        previewWarmRoleDecision.capabilitySnapshot.rendererDecision.preferredBackendOrder.includes(
          "webgl",
        );
      const rendererRoutingSupported: boolean =
        previewWarmRoleDecision.capabilitySnapshot.rendererDecision
          .shouldRouteThroughRenderer &&
        !input.runtimeGuardrailState.disableRendererBoundPreviewWork;
      const preferredRendererKind: MediaRendererKind | null =
        previewWarmRoleDecision.desiredRendererKind;
      const mustUseLegacyPreviewPath: boolean =
        !canUseCustomDecode ||
        !rendererRoutingSupported ||
        previewWarmRoleDecision.capabilitySnapshot.rendererDecision
          .selectedBackend === null;
      const canReuseWarmSession: boolean =
        currentWarmState === "warming" ||
        currentWarmState === "ready-first-frame" ||
        currentWarmState === "preview-active" ||
        currentWarmState === "cooling";

      if (seenSessionIds.has(sessionId)) {
        continue;
      }

      const previewCandidateScore: PreviewCandidateScore =
        this.createPreviewCandidateScore(
          previewCandidateInput.reason,
          sourceDescriptor.sourceId,
          canUseCustomDecode,
          mustUseLegacyPreviewPath,
          input.currentMediaKernelState,
        );

      seenSessionIds.add(sessionId);
      previewCandidates.push({
        candidateId: sessionId,
        sessionId,
        itemId: previewCandidateInput.mediaItem.id,
        source: sourceDescriptor,
        rowIndex: previewCandidateInput.rowIndex,
        itemIndex: previewCandidateInput.itemIndex,
        reason: previewCandidateInput.reason,
        score: previewCandidateScore,
        currentWarmState,
        focusStartedAtMs: previewCandidateInput.focusStartedAtMs,
        lastFocusedAtMs: previewCandidateInput.lastFocusedAtMs,
        canReuseWarmSession,
        canUseCustomDecode,
        canUseWebGpuRenderer,
        canUseWebGlRenderer,
        mustUseLegacyPreviewPath,
        rendererRoutingSupported,
        preferredRendererKind,
        requiresRendererBudget: canUseCustomDecode && !mustUseLegacyPreviewPath,
        notes: [
          ...input.runtimeGuardrailState.notes,
          canUseCustomDecode
            ? "Candidate may use the preview custom-decode warm path."
            : "Candidate stays on the established preview video warm path.",
          canUseWebGpuRenderer
            ? "Candidate can route preview-first-frame work through WebGPU when budget allows."
            : canUseWebGlRenderer
              ? "Candidate can route preview-first-frame work through WebGL when budget allows."
              : "Candidate has no renderer-router backend available for preview warm routing.",
        ],
      });
    }

    return previewCandidates;
  }

  /**
   * @brief Create a stable score for one preview candidate reason
   *
   * @param reason - Candidate reason emitted by the browse bridge
   * @param sourceId - Source identifier used for light reuse heuristics
   * @param currentMediaKernelState - Current immutable kernel snapshot
   *
   * @returns Deterministic candidate score metadata
   */
  private static createPreviewCandidateScore(
    reason: PreviewSchedulerDecisionReason,
    sourceId: string,
    canUseCustomDecode: boolean,
    mustUseLegacyPreviewPath: boolean,
    currentMediaKernelState: MediaKernelState,
  ): PreviewCandidateScore {
    const baseValue: number = this.getPreviewReasonScore(reason);
    const reuseBonus: number = currentMediaKernelState.sessions.some(
      (sessionSnapshot: MediaKernelState["sessions"][number]): boolean =>
        sessionSnapshot.descriptor.role === "preview" &&
        sessionSnapshot.descriptor.source?.sourceId === sourceId &&
        sessionSnapshot.warmth !== "cold",
    )
      ? 25
      : 0;
    const rendererBonus: number =
      canUseCustomDecode && !mustUseLegacyPreviewPath ? 10 : 0;
    const rendererPenalty: number =
      canUseCustomDecode &&
      !mustUseLegacyPreviewPath &&
      reason !== "focused-item"
        ? 15
        : 0;
    const notes: string[] = [];

    if (reuseBonus > 0) {
      notes.push(
        "Candidate receives a reuse bonus because a preview session already exists for this source.",
      );
    }

    if (rendererBonus > 0) {
      notes.push(
        "Candidate can use the renderer-aware warm path when the renderer budget allows it.",
      );
    }

    if (rendererPenalty > 0) {
      notes.push(
        "Candidate keeps a small penalty so focused work can reserve the renderer-bound budget first.",
      );
    }

    return {
      reason,
      baseValue,
      reuseBonus,
      rendererBonus,
      rendererPenalty,
      totalValue: baseValue + reuseBonus + rendererBonus - rendererPenalty,
      notes,
    };
  }

  /**
   * @brief Convert preview-farm decisions back into executable logical sessions
   *
   * @param previewFarmState - Full scheduler result for the current plan
   * @param input - Current planner inputs
   *
   * @returns Materialized preview sessions that execution should own
   */
  private static createPreviewPlanSessionsFromFarm<
    TMediaItem extends MediaKernelItem,
  >(
    previewFarmState: PreviewFarmState,
    input: MediaSessionPlannerInput<TMediaItem>,
  ): MediaPlanSession[] {
    const plannedPreviewSessions: MediaPlanSession[] = [];
    const appCapabilityProfile: MediaCapabilityProfile | null =
      input.appCapabilityProfile;

    for (const previewSchedulerDecision of previewFarmState.decisions) {
      if (
        !previewSchedulerDecision.shouldWarm &&
        !previewSchedulerDecision.shouldActivate
      ) {
        continue;
      }

      const previewCandidate: PreviewCandidate | undefined =
        previewFarmState.candidates.find(
          (candidate: PreviewCandidate): boolean =>
            candidate.sessionId === previewSchedulerDecision.sessionId,
        );

      if (previewCandidate === undefined) {
        continue;
      }

      const previewRole: VariantRolePolicy =
        previewSchedulerDecision.shouldActivate
          ? "preview-active"
          : "preview-warm";
      const plannedRoleDecision: PlannedRoleDecision =
        this.createPlannedRoleDecision(
          previewRole,
          appCapabilityProfile,
          this.selectPreviewPlaybackLane(appCapabilityProfile),
          this.selectRendererKind(appCapabilityProfile),
        );

      plannedPreviewSessions.push({
        sessionId: previewCandidate.sessionId,
        itemId: previewCandidate.itemId,
        source: {
          sourceId: previewCandidate.source.sourceId,
          kind: previewCandidate.source.kind,
          originType: previewCandidate.source.originType,
          url: previewCandidate.source.url,
          mimeType: previewCandidate.source.mimeType,
          posterUrl: previewCandidate.source.posterUrl,
        },
        role: "preview",
        capabilitySnapshot: plannedRoleDecision.capabilitySnapshot,
        customDecodeDecision: plannedRoleDecision.customDecodeDecision,
        fallbackPlaybackLaneOrder:
          plannedRoleDecision.fallbackPlaybackLaneOrder,
        desiredPlaybackLane: plannedRoleDecision.desiredPlaybackLane,
        variantSelection: plannedRoleDecision.variantSelection,
        desiredRendererKind:
          previewSchedulerDecision.selectedRendererKind ??
          this.selectRendererKind(appCapabilityProfile),
        desiredWarmth: previewSchedulerDecision.shouldActivate
          ? "preloaded"
          : "first-frame",
        priority: this.resolvePreviewPriority(previewCandidate.reason),
        visibility: previewSchedulerDecision.shouldActivate
          ? "visible"
          : "hidden",
        reason: this.createPreviewPlanReason(
          previewCandidate.reason,
          previewSchedulerDecision.shouldActivate,
        ),
      });
    }

    return plannedPreviewSessions;
  }

  /**
   * @brief Preserve an already-active background session when no stronger target exists
   *
   * @param currentMediaKernelState - Current immutable kernel snapshot
   * @param appCapabilityProfile - Runtime capability profile for the current app
   *
   * @returns Planned background session copied from the active shared session snapshot
   */
  private static createPreservedBackgroundSession(
    currentMediaKernelState: MediaKernelState,
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): MediaPlanSession {
    const activeBackgroundSession:
      | MediaKernelState["sessions"][number]
      | undefined = currentMediaKernelState.sessions.find(
      (sessionSnapshot: MediaKernelState["sessions"][number]): boolean =>
        sessionSnapshot.descriptor.role === "background" &&
        this.isActiveBackgroundSessionState(sessionSnapshot.state),
    );
    const sourceDescriptor: MediaSourceDescriptor | null =
      activeBackgroundSession?.descriptor.source ?? null;
    const plannedRoleDecision: PlannedRoleDecision =
      this.createPlannedRoleDecision(
        "background-playback",
        appCapabilityProfile,
        this.selectBackgroundPlaybackLane(appCapabilityProfile),
        this.selectRendererKind(appCapabilityProfile),
      );

    return {
      sessionId:
        activeBackgroundSession?.descriptor.sessionId ??
        this.createFallbackSessionId("background", sourceDescriptor),
      itemId: activeBackgroundSession?.descriptor.itemId ?? null,
      source: sourceDescriptor,
      role: "background",
      capabilitySnapshot: plannedRoleDecision.capabilitySnapshot,
      customDecodeDecision: plannedRoleDecision.customDecodeDecision,
      fallbackPlaybackLaneOrder: plannedRoleDecision.fallbackPlaybackLaneOrder,
      desiredPlaybackLane: plannedRoleDecision.desiredPlaybackLane,
      variantSelection: plannedRoleDecision.variantSelection,
      desiredRendererKind: plannedRoleDecision.desiredRendererKind,
      desiredWarmth: "active",
      priority: "high",
      visibility: "visible",
      reason: {
        intentType: "idle",
        kind: "preserve-existing-background-session",
        message:
          "Keep the existing active background session planned while no stronger intent is present",
      },
    };
  }

  /**
   * @brief Create a stable logical session identifier from role and source
   *
   * @param role - Logical role assigned to the session
   * @param sourceDescriptor - Shared source descriptor for the session
   *
   * @returns Stable session identifier
   */
  private static createSessionId(
    role: MediaSessionRole,
    sourceDescriptor: MediaSourceDescriptor,
  ): string {
    return `${role}:${sourceDescriptor.sourceId}`;
  }

  /**
   * @brief Create a fallback session identifier when a source is absent
   *
   * @param role - Logical role assigned to the session
   * @param sourceDescriptor - Optional source descriptor for the session
   *
   * @returns Stable best-effort session identifier
   */
  private static createFallbackSessionId(
    role: MediaSessionRole,
    sourceDescriptor: MediaSourceDescriptor | null,
  ): string {
    return `${role}:${sourceDescriptor?.sourceId ?? "unknown"}`;
  }

  /**
   * @brief Translate current kernel session state into preview-specific warmth
   *
   * @param currentMediaKernelState - Current immutable kernel snapshot
   * @param sessionId - Preview session identifier being inspected
   *
   * @returns Preview warmth state visible to the scheduler
   */
  private static resolveCurrentPreviewWarmState(
    currentMediaKernelState: MediaKernelState,
    sessionId: string,
  ): PreviewWarmState {
    const previewSessionSnapshot:
      | MediaKernelState["sessions"][number]
      | undefined = currentMediaKernelState.sessions.find(
      (sessionSnapshot: MediaKernelState["sessions"][number]): boolean =>
        sessionSnapshot.descriptor.sessionId === sessionId &&
        sessionSnapshot.descriptor.role === "preview",
    );

    if (previewSessionSnapshot === undefined) {
      return "cold";
    }

    switch (previewSessionSnapshot.state) {
      case "loading":
      case "probing":
        return "warming";
      case "first-frame-ready":
        return "ready-first-frame";
      case "previewing":
        return "preview-active";
      case "idle":
      case "failed":
      case "paused":
      case "playing":
        return previewSessionSnapshot.warmth === "cold"
          ? "cold"
          : "ready-first-frame";
    }
  }

  /**
   * @brief Determine whether a session state should count as an active background owner
   *
   * @param mediaSessionState - Shared lifecycle state recorded for a session
   *
   * @returns `true` when the session is already warm enough to preserve
   */
  private static isActiveBackgroundSessionState(
    mediaSessionState: MediaKernelState["sessions"][number]["state"],
  ): boolean {
    return (
      mediaSessionState === "previewing" ||
      mediaSessionState === "playing" ||
      mediaSessionState === "paused"
    );
  }

  /**
   * @brief Resolve lane, renderer, and quality intent for one planned role
   *
   * @param role - Shared media role being planned
   * @param appCapabilityProfile - Runtime capability profile for the current app
   * @param preferredLaneHint - Conservative lane hint derived from prior planning rules
   * @param preferredRendererKindHint - Conservative renderer hint derived from app capabilities
   *
   * @returns Stable role decision used by the plan snapshot
   */
  private static createPlannedRoleDecision(
    role: VariantRolePolicy,
    appCapabilityProfile: MediaCapabilityProfile | null,
    preferredLaneHint: MediaPlaybackLane | null,
    preferredRendererKindHint: MediaRendererKind,
  ): PlannedRoleDecision {
    const capabilitySnapshot: MediaRoleCapabilitySnapshot =
      CapabilityOracle.decide({
        role,
        appCapabilityProfile,
        runtimeCapabilities: null,
        preferredLaneHint,
        preferredRendererKindHint,
        existingChosenLane: null,
        runtimeLanePreference: null,
      });
    const variantSelection: VariantSelectionDecision = VariantPolicy.select({
      role,
      capabilitySnapshot,
      inventoryResult: null,
      maxWidth: null,
      maxHeight: null,
      maxBandwidth: null,
    });

    return {
      capabilitySnapshot,
      customDecodeDecision: capabilitySnapshot.customDecodeDecision,
      fallbackPlaybackLaneOrder: [
        ...capabilitySnapshot.decision.preferredFallbackLaneOrder,
      ],
      desiredPlaybackLane:
        capabilitySnapshot.decision.preferredLaneOrder[0] ?? preferredLaneHint,
      variantSelection,
      desiredRendererKind:
        capabilitySnapshot.decision.preferredRendererOrder[0] ??
        preferredRendererKindHint,
    };
  }

  /**
   * @brief Select the most conservative preview playback lane supported by the app
   *
   * @param appCapabilityProfile - Runtime capability profile for the current app
   *
   * @returns Lane preferred for preview planning, or `null` when unsupported
   */
  private static selectPreviewPlaybackLane(
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): MediaPlaybackLane | null {
    if (appCapabilityProfile === null) {
      return null;
    }

    if (appCapabilityProfile.supportsNativePlayback) {
      return "native";
    }

    if (appCapabilityProfile.supportsShakaPlayback) {
      return "shaka";
    }

    if (appCapabilityProfile.supportsCustomPipeline) {
      return "custom";
    }

    return null;
  }

  /**
   * @brief Convert one preview reason into a stable planning priority
   *
   * @param reason - Preview scheduler reason emitted by the browse bridge
   *
   * @returns Shared plan priority for the preview session
   */
  private static resolvePreviewPriority(
    reason: PreviewSchedulerDecisionReason,
  ): MediaPlanSession["priority"] {
    switch (reason) {
      case "focused-item":
        return "high";
      case "focus-neighbor":
        return "normal";
      case "likely-next-item":
        return "normal";
      case "visible-item":
        return "normal";
      case "recent-focus":
        return "low";
      case "over-budget":
      case "lower-priority":
      case "runtime-unsupported":
      case "background-priority":
        return "low";
    }
  }

  /**
   * @brief Build a human-readable plan reason for one preview session
   *
   * @param reason - Preview scheduler reason that selected the session
   * @param shouldActivate - Whether the session should actively preview now
   *
   * @returns Shared plan reason stored beside the executable session
   */
  private static createPreviewPlanReason(
    reason: PreviewSchedulerDecisionReason,
    shouldActivate: boolean,
  ): MediaPlanReason {
    switch (reason) {
      case "focused-item":
        return {
          intentType: shouldActivate ? "focused-delay-elapsed" : "focused",
          kind: shouldActivate ? "focused-delay-elapsed-item" : "focused-item",
          message: shouldActivate
            ? "Focused item stayed active long enough to own the active preview session"
            : "Focused item should warm the primary preview session",
        };
      case "focus-neighbor":
        return {
          intentType: "focused",
          kind: "focus-neighbor-item",
          message:
            "Immediate row neighbor should stay warm when preview budget allows",
        };
      case "likely-next-item":
        return {
          intentType: "focused",
          kind: "focus-neighbor-item",
          message:
            "Likely next browse target should be warmed conservatively when preview budget allows",
        };
      case "visible-item":
        return {
          intentType: "focused",
          kind: "visible-item",
          message:
            "Visible browse item should be eligible for preview warming when budget allows",
        };
      case "recent-focus":
        return {
          intentType: "focused",
          kind: "recent-focus-item",
          message:
            "Recently focused item should remain warm briefly for preview reuse",
        };
      case "over-budget":
      case "lower-priority":
      case "runtime-unsupported":
      case "background-priority":
        return {
          intentType: "focused",
          kind: "recent-focus-item",
          message:
            "Preview scheduler retained a lower-priority candidate for short-term reuse",
        };
    }
  }

  /**
   * @brief Convert one scheduler reason into a stable base score
   *
   * @param reason - Preview candidate reason emitted by the browse bridge
   *
   * @returns Deterministic numeric base score
   */
  private static getPreviewReasonScore(
    reason: PreviewSchedulerDecisionReason,
  ): number {
    switch (reason) {
      case "focused-item":
        return 400;
      case "focus-neighbor":
        return 240;
      case "likely-next-item":
        return 210;
      case "visible-item":
        return 180;
      case "recent-focus":
        return 140;
      case "background-priority":
        return 80;
      case "lower-priority":
        return 60;
      case "over-budget":
        return 40;
      case "runtime-unsupported":
        return 20;
    }
  }

  /**
   * @brief Select the strongest background playback lane supported by the app
   *
   * @param appCapabilityProfile - Runtime capability profile for the current app
   *
   * @returns Lane preferred for background planning, or `null` when unsupported
   */
  private static selectBackgroundPlaybackLane(
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): MediaPlaybackLane | null {
    if (appCapabilityProfile === null) {
      return null;
    }

    if (
      appCapabilityProfile.supportsPremiumPlayback &&
      appCapabilityProfile.supportsCustomPipeline
    ) {
      return "custom";
    }

    if (
      appCapabilityProfile.supportsPremiumPlayback &&
      appCapabilityProfile.supportsShakaPlayback
    ) {
      return "shaka";
    }

    if (appCapabilityProfile.supportsNativePlayback) {
      return "native";
    }

    if (appCapabilityProfile.supportsShakaPlayback) {
      return "shaka";
    }

    if (appCapabilityProfile.supportsCustomPipeline) {
      return "custom";
    }

    return null;
  }

  /**
   * @brief Select the current best-fit renderer family without activating advanced pipelines
   *
   * @param appCapabilityProfile - Runtime capability profile for the current app
   *
   * @returns Renderer family that best matches the current app capabilities
   */
  private static selectRendererKind(
    appCapabilityProfile: MediaCapabilityProfile | null,
  ): MediaRendererKind {
    if (appCapabilityProfile?.supportsNativePlayback === true) {
      return "native-plane";
    }

    return "none";
  }

  /**
   * @brief Provide deterministic ordering for debug-friendly plan output
   *
   * @param leftPlannedSession - First session being compared
   * @param rightPlannedSession - Second session being compared
   *
   * @returns Sort order used in the shared plan snapshot
   */
  private static comparePlannedSessions(
    leftPlannedSession: MediaPlanSession,
    rightPlannedSession: MediaPlanSession,
  ): number {
    const leftPriorityRank: number = this.getPriorityRank(
      leftPlannedSession.priority,
    );
    const rightPriorityRank: number = this.getPriorityRank(
      rightPlannedSession.priority,
    );

    if (leftPriorityRank !== rightPriorityRank) {
      return rightPriorityRank - leftPriorityRank;
    }

    if (leftPlannedSession.role !== rightPlannedSession.role) {
      return leftPlannedSession.role.localeCompare(rightPlannedSession.role);
    }

    return leftPlannedSession.sessionId.localeCompare(
      rightPlannedSession.sessionId,
    );
  }

  /**
   * @brief Convert a priority label into a stable numeric sort rank
   *
   * @param priority - Priority label being compared
   *
   * @returns Numeric rank for deterministic sorting
   */
  private static getPriorityRank(
    priority: MediaPlanSession["priority"],
  ): number {
    switch (priority) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "normal":
        return 2;
      case "low":
        return 1;
    }
  }

  /**
   * @brief Clone preview-farm state for safe inclusion in the shared plan
   *
   * @param previewFarmState - Preview-farm state to clone
   *
   * @returns Cloned preview-farm state
   */
  private static clonePreviewFarmState(
    previewFarmState: PreviewFarmState,
  ): PreviewFarmState {
    return {
      budget: {
        maxWarmSessions: previewFarmState.budget.maxWarmSessions,
        maxActivePreviewSessions:
          previewFarmState.budget.maxActivePreviewSessions,
        maxRendererBoundSessions:
          previewFarmState.budget.maxRendererBoundSessions,
        maxHiddenSessions: previewFarmState.budget.maxHiddenSessions,
        maxPreviewReuseMs: previewFarmState.budget.maxPreviewReuseMs,
        maxPreviewOverlapMs: previewFarmState.budget.maxPreviewOverlapMs,
        keepWarmAfterBlurMs: previewFarmState.budget.keepWarmAfterBlurMs,
      },
      telemetry: {
        counters: {
          ...previewFarmState.telemetry.counters,
        },
        rollingWindow: {
          ...previewFarmState.telemetry.rollingWindow,
          preview: {
            ...previewFarmState.telemetry.rollingWindow.preview,
          },
          thumbnail: {
            ...previewFarmState.telemetry.rollingWindow.thumbnail,
          },
          renderer: {
            ...previewFarmState.telemetry.rollingWindow.renderer,
          },
          customDecode: {
            ...previewFarmState.telemetry.rollingWindow.customDecode,
          },
          startup: {
            ...previewFarmState.telemetry.rollingWindow.startup,
          },
          recentEvents:
            previewFarmState.telemetry.rollingWindow.recentEvents.map(
              (event) => ({ ...event }),
            ),
        },
        lastUpdatedAtMs: previewFarmState.telemetry.lastUpdatedAtMs,
        historyLimit: previewFarmState.telemetry.historyLimit,
        windowDurationMs: previewFarmState.telemetry.windowDurationMs,
        recentEvents: previewFarmState.telemetry.recentEvents.map((event) => ({
          ...event,
        })),
      },
      adaptiveBudgetDecision: {
        baseBudget: {
          ...previewFarmState.adaptiveBudgetDecision.baseBudget,
        },
        effectiveBudget: {
          ...previewFarmState.adaptiveBudgetDecision.effectiveBudget,
        },
        reasons: [...previewFarmState.adaptiveBudgetDecision.reasons],
        notes: [...previewFarmState.adaptiveBudgetDecision.notes],
        evaluatedAtMs: previewFarmState.adaptiveBudgetDecision.evaluatedAtMs,
      },
      runtimeGuardrailState: {
        suppressAggressiveWarmExpansion:
          previewFarmState.runtimeGuardrailState
            .suppressAggressiveWarmExpansion,
        suppressExtraWarmSessions:
          previewFarmState.runtimeGuardrailState.suppressExtraWarmSessions,
        disableCustomDecodePreviewWarm:
          previewFarmState.runtimeGuardrailState.disableCustomDecodePreviewWarm,
        disableRendererBoundPreviewWork:
          previewFarmState.runtimeGuardrailState
            .disableRendererBoundPreviewWork,
        suppressedRendererBackends: [
          ...previewFarmState.runtimeGuardrailState.suppressedRendererBackends,
        ],
        preferredRendererBackend:
          previewFarmState.runtimeGuardrailState.preferredRendererBackend,
        reasons: [...previewFarmState.runtimeGuardrailState.reasons],
        notes: [...previewFarmState.runtimeGuardrailState.notes],
        evaluatedAtMs: previewFarmState.runtimeGuardrailState.evaluatedAtMs,
      },
      candidates: previewFarmState.candidates.map(
        (previewCandidate: PreviewCandidate): PreviewCandidate => ({
          candidateId: previewCandidate.candidateId,
          sessionId: previewCandidate.sessionId,
          itemId: previewCandidate.itemId,
          source: {
            sourceId: previewCandidate.source.sourceId,
            kind: previewCandidate.source.kind,
            originType: previewCandidate.source.originType,
            url: previewCandidate.source.url,
            mimeType: previewCandidate.source.mimeType,
            posterUrl: previewCandidate.source.posterUrl,
          },
          rowIndex: previewCandidate.rowIndex,
          itemIndex: previewCandidate.itemIndex,
          reason: previewCandidate.reason,
          score: {
            reason: previewCandidate.score.reason,
            baseValue: previewCandidate.score.baseValue,
            reuseBonus: previewCandidate.score.reuseBonus,
            rendererBonus: previewCandidate.score.rendererBonus,
            rendererPenalty: previewCandidate.score.rendererPenalty,
            totalValue: previewCandidate.score.totalValue,
            notes: [...previewCandidate.score.notes],
          },
          currentWarmState: previewCandidate.currentWarmState,
          focusStartedAtMs: previewCandidate.focusStartedAtMs,
          lastFocusedAtMs: previewCandidate.lastFocusedAtMs,
          canReuseWarmSession: previewCandidate.canReuseWarmSession,
          canUseCustomDecode: previewCandidate.canUseCustomDecode,
          canUseWebGpuRenderer: previewCandidate.canUseWebGpuRenderer,
          canUseWebGlRenderer: previewCandidate.canUseWebGlRenderer,
          mustUseLegacyPreviewPath: previewCandidate.mustUseLegacyPreviewPath,
          rendererRoutingSupported: previewCandidate.rendererRoutingSupported,
          preferredRendererKind: previewCandidate.preferredRendererKind,
          requiresRendererBudget: previewCandidate.requiresRendererBudget,
          notes: [...previewCandidate.notes],
        }),
      ),
      decisions: previewFarmState.decisions.map(
        (
          previewSchedulerDecision: PreviewSchedulerDecision,
        ): PreviewSchedulerDecision => ({
          candidateId: previewSchedulerDecision.candidateId,
          sessionId: previewSchedulerDecision.sessionId,
          itemId: previewSchedulerDecision.itemId,
          score: {
            reason: previewSchedulerDecision.score.reason,
            baseValue: previewSchedulerDecision.score.baseValue,
            reuseBonus: previewSchedulerDecision.score.reuseBonus,
            rendererBonus: previewSchedulerDecision.score.rendererBonus,
            rendererPenalty: previewSchedulerDecision.score.rendererPenalty,
            totalValue: previewSchedulerDecision.score.totalValue,
            notes: [...previewSchedulerDecision.score.notes],
          },
          primaryReason: previewSchedulerDecision.primaryReason,
          transitionReason: previewSchedulerDecision.transitionReason,
          deferredReason: previewSchedulerDecision.deferredReason,
          evictionReason: previewSchedulerDecision.evictionReason,
          targetWarmState: previewSchedulerDecision.targetWarmState,
          shouldWarm: previewSchedulerDecision.shouldWarm,
          shouldActivate: previewSchedulerDecision.shouldActivate,
          shouldRetain: previewSchedulerDecision.shouldRetain,
          shouldReuse: previewSchedulerDecision.shouldReuse,
          shouldEvict: previewSchedulerDecision.shouldEvict,
          isDeferred: previewSchedulerDecision.isDeferred,
          retainUntilMs: previewSchedulerDecision.retainUntilMs,
          rendererBound: previewSchedulerDecision.rendererBound,
          selectedRendererKind: previewSchedulerDecision.selectedRendererKind,
          shouldAttemptCustomDecode:
            previewSchedulerDecision.shouldAttemptCustomDecode,
          mustUseLegacyPreviewPath:
            previewSchedulerDecision.mustUseLegacyPreviewPath,
          notes: [...previewSchedulerDecision.notes],
        }),
      ),
      sessionAssignments: previewFarmState.sessionAssignments.map(
        (
          previewSessionAssignment,
        ): (typeof previewFarmState.sessionAssignments)[number] => ({
          sessionId: previewSessionAssignment.sessionId,
          itemId: previewSessionAssignment.itemId,
          slotId: previewSessionAssignment.slotId,
          warmState: previewSessionAssignment.warmState,
          sessionState: previewSessionAssignment.sessionState,
          isActive: previewSessionAssignment.isActive,
          assignmentDomain: previewSessionAssignment.assignmentDomain,
          assignmentKind: previewSessionAssignment.assignmentKind,
          rendererBound: previewSessionAssignment.rendererBound,
          rendererKind: previewSessionAssignment.rendererKind,
          transitionReason: previewSessionAssignment.transitionReason,
        }),
      ),
      activeSessionIds: [...previewFarmState.activeSessionIds],
      warmedSessionIds: [...previewFarmState.warmedSessionIds],
      retainedSessionIds: [...previewFarmState.retainedSessionIds],
      reusedSessionIds: [...previewFarmState.reusedSessionIds],
      rendererBoundSessionIds: [...previewFarmState.rendererBoundSessionIds],
      legacyPathSessionIds: [...previewFarmState.legacyPathSessionIds],
      evictedSessionIds: [...previewFarmState.evictedSessionIds],
      deferredSessionIds: [...previewFarmState.deferredSessionIds],
      budgetUsage: {
        warmSessions: previewFarmState.budgetUsage.warmSessions,
        activePreviewSessions:
          previewFarmState.budgetUsage.activePreviewSessions,
        hiddenSessions: previewFarmState.budgetUsage.hiddenSessions,
        rendererBoundSessions:
          previewFarmState.budgetUsage.rendererBoundSessions,
        coldCandidates: previewFarmState.budgetUsage.coldCandidates,
        failedCandidates: previewFarmState.budgetUsage.failedCandidates,
      },
      nextTransitionAtMs: previewFarmState.nextTransitionAtMs,
    };
  }
}
