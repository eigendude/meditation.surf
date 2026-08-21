/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { MediaIntentType } from "../intent/MediaIntentType";
import type { MediaRendererKind } from "../sessions/MediaRendererKind";
import type { TelemetrySnapshot } from "../telemetry/TelemetrySnapshot";
import type { AdaptiveBudgetDecision } from "../tuning/AdaptiveBudgetDecision";
import type { RuntimeGuardrailState } from "../tuning/RuntimeGuardrailState";
import type { PreviewFarmAssignment } from "./PreviewFarmAssignment";
import type { PreviewFarmBudget } from "./PreviewFarmBudget";
import type { PreviewFarmCandidate } from "./PreviewFarmCandidate";
import type { PreviewFarmEvictionReason } from "./PreviewFarmEvictionReason";
import type { PreviewFarmSnapshot } from "./PreviewFarmSnapshot";
import type { PreviewFarmTransitionReason } from "./PreviewFarmTransitionReason";
import type { PreviewSchedulerDecision } from "./PreviewSchedulerDecision";

type PreviewFarmControllerInput = {
  previewCandidates: PreviewFarmCandidate[];
  supportsPreviewVideo: boolean;
  previewBudget: PreviewFarmBudget;
  currentlyPlannedWarmSessionIds: string[];
  currentlyPlannedActiveSessionIds: string[];
  currentSessionAssignments: PreviewFarmAssignment[];
  backgroundItemId: string | null;
  mediaIntentType: MediaIntentType;
  adaptiveBudgetDecision: AdaptiveBudgetDecision;
  nowMs: number;
  runtimeGuardrailState: RuntimeGuardrailState;
  telemetry: TelemetrySnapshot;
};

type CandidateDecisionState = {
  targetWarmState: PreviewSchedulerDecision["targetWarmState"];
  shouldWarm: boolean;
  shouldActivate: boolean;
  shouldRetain: boolean;
  shouldReuse: boolean;
  shouldEvict: boolean;
  isDeferred: boolean;
  retainUntilMs: number | null;
  transitionReason: PreviewFarmTransitionReason | null;
  deferredReason: PreviewFarmTransitionReason | null;
  evictionReason: PreviewFarmEvictionReason | null;
  rendererBound: boolean;
  selectedRendererKind: MediaRendererKind | null;
  shouldAttemptCustomDecode: boolean;
  mustUseLegacyPreviewPath: boolean;
  notes: string[];
};

/**
 * @brief Shared preview-farm controller that ranks, assigns, and evicts sessions
 */
export class PreviewFarmController {
  /**
   * @brief Shared zero-budget configuration for unsupported runtimes
   */
  public static readonly UNSUPPORTED_BUDGET: PreviewFarmBudget = {
    maxWarmSessions: 0,
    maxActivePreviewSessions: 0,
    maxRendererBoundSessions: 0,
    maxHiddenSessions: 0,
    keepWarmAfterBlurMs: 0,
    maxPreviewReuseMs: 0,
    maxPreviewOverlapMs: 0,
  };

  /**
   * @brief Build one deterministic preview-farm snapshot from the current plan inputs
   *
   * @param input - Current preview candidates, capability gates, and previous assignments
   *
   * @returns Full shared preview-farm snapshot
   */
  public static createState(
    input: PreviewFarmControllerInput,
  ): PreviewFarmSnapshot {
    const previewBudget: PreviewFarmBudget = this.cloneBudget(
      input.previewBudget,
    );
    const previewCandidates: PreviewFarmCandidate[] = input.previewCandidates
      .filter(
        (previewCandidate: PreviewFarmCandidate): boolean =>
          previewCandidate.itemId !== input.backgroundItemId,
      )
      .sort(
        (
          leftPreviewCandidate: PreviewFarmCandidate,
          rightPreviewCandidate: PreviewFarmCandidate,
        ): number =>
          this.compareCandidates(leftPreviewCandidate, rightPreviewCandidate),
      );
    const supportsWarmSessions: boolean =
      input.supportsPreviewVideo &&
      previewBudget.maxWarmSessions > 0 &&
      previewBudget.maxHiddenSessions >= 0;
    const supportsActivePreviewSessions: boolean =
      supportsWarmSessions && previewBudget.maxActivePreviewSessions > 0;
    const activeSessionIds: string[] = [];
    const warmedSessionIds: string[] = [];
    const retainedSessionIds: string[] = [];
    const reusedSessionIds: string[] = [];
    const rendererBoundSessionIds: string[] = [];
    const legacyPathSessionIds: string[] = [];
    const evictedSessionIds: string[] = [];
    const deferredSessionIds: string[] = [];
    const sessionAssignments: PreviewFarmAssignment[] = [];
    const decisions: PreviewSchedulerDecision[] = [];
    const currentAssignmentsBySessionId: Map<string, PreviewFarmAssignment> =
      new Map<string, PreviewFarmAssignment>();
    const claimedSlotIds: Set<string> = new Set<string>();
    const decisionStateBySessionId: Map<string, CandidateDecisionState> =
      new Map<string, CandidateDecisionState>();
    let hiddenSessionCount: number = 0;
    let rendererBoundSessionCount: number = 0;
    let nextTransitionAtMs: number | null = null;

    for (const previewFarmAssignment of input.currentSessionAssignments) {
      currentAssignmentsBySessionId.set(
        previewFarmAssignment.sessionId,
        previewFarmAssignment,
      );
    }

    for (const previewCandidate of previewCandidates) {
      const candidateDecisionState: CandidateDecisionState =
        this.createCandidateDecisionState(
          previewCandidate,
          input,
          previewBudget,
          supportsWarmSessions,
          supportsActivePreviewSessions,
          activeSessionIds.length,
          warmedSessionIds.length,
          hiddenSessionCount,
          rendererBoundSessionCount,
        );

      if (candidateDecisionState.shouldWarm) {
        warmedSessionIds.push(previewCandidate.sessionId);

        if (candidateDecisionState.shouldActivate) {
          activeSessionIds.push(previewCandidate.sessionId);
        } else {
          hiddenSessionCount += 1;
        }

        if (candidateDecisionState.shouldRetain) {
          retainedSessionIds.push(previewCandidate.sessionId);
        }

        if (candidateDecisionState.shouldReuse) {
          reusedSessionIds.push(previewCandidate.sessionId);
        }

        if (candidateDecisionState.rendererBound) {
          rendererBoundSessionIds.push(previewCandidate.sessionId);
          rendererBoundSessionCount += 1;
        } else {
          legacyPathSessionIds.push(previewCandidate.sessionId);
        }

        const slotId: string = this.allocateSlotId(
          previewCandidate,
          currentAssignmentsBySessionId,
          claimedSlotIds,
          sessionAssignments.length,
        );

        sessionAssignments.push({
          sessionId: previewCandidate.sessionId,
          itemId: previewCandidate.itemId,
          slotId,
          warmState: candidateDecisionState.targetWarmState,
          sessionState: candidateDecisionState.targetWarmState,
          isActive: candidateDecisionState.shouldActivate,
          assignmentDomain: "preview-farm",
          assignmentKind: candidateDecisionState.shouldActivate
            ? "active-preview"
            : "warm-preview",
          rendererBound: candidateDecisionState.rendererBound,
          rendererKind: candidateDecisionState.selectedRendererKind,
          transitionReason: candidateDecisionState.transitionReason,
        });
      } else if (candidateDecisionState.isDeferred) {
        deferredSessionIds.push(previewCandidate.sessionId);
      }

      if (candidateDecisionState.shouldEvict) {
        evictedSessionIds.push(previewCandidate.sessionId);
      }

      if (
        candidateDecisionState.shouldRetain &&
        previewCandidate.lastFocusedAtMs !== null
      ) {
        const retainUntilMs: number =
          previewCandidate.lastFocusedAtMs + previewBudget.keepWarmAfterBlurMs;

        nextTransitionAtMs = this.selectEarlierTransition(
          nextTransitionAtMs,
          retainUntilMs,
        );
      }

      decisionStateBySessionId.set(
        previewCandidate.sessionId,
        candidateDecisionState,
      );
    }

    for (const previewCandidate of previewCandidates) {
      const candidateDecisionState: CandidateDecisionState | undefined =
        decisionStateBySessionId.get(previewCandidate.sessionId);

      if (candidateDecisionState === undefined) {
        continue;
      }

      decisions.push({
        candidateId: previewCandidate.candidateId,
        sessionId: previewCandidate.sessionId,
        itemId: previewCandidate.itemId,
        score: {
          reason: previewCandidate.score.reason,
          baseValue: previewCandidate.score.baseValue,
          reuseBonus: previewCandidate.score.reuseBonus,
          rendererBonus: previewCandidate.score.rendererBonus,
          rendererPenalty: previewCandidate.score.rendererPenalty,
          totalValue: previewCandidate.score.totalValue,
          notes: [...previewCandidate.score.notes],
        },
        primaryReason: previewCandidate.reason,
        transitionReason: candidateDecisionState.transitionReason,
        deferredReason: candidateDecisionState.deferredReason,
        evictionReason: candidateDecisionState.evictionReason,
        targetWarmState: candidateDecisionState.targetWarmState,
        shouldWarm: candidateDecisionState.shouldWarm,
        shouldActivate: candidateDecisionState.shouldActivate,
        shouldRetain: candidateDecisionState.shouldRetain,
        shouldReuse: candidateDecisionState.shouldReuse,
        shouldEvict: candidateDecisionState.shouldEvict,
        isDeferred: candidateDecisionState.isDeferred,
        retainUntilMs: candidateDecisionState.retainUntilMs,
        rendererBound: candidateDecisionState.rendererBound,
        selectedRendererKind: candidateDecisionState.selectedRendererKind,
        shouldAttemptCustomDecode:
          candidateDecisionState.shouldAttemptCustomDecode,
        mustUseLegacyPreviewPath:
          candidateDecisionState.mustUseLegacyPreviewPath,
        notes: [...candidateDecisionState.notes],
      });
    }

    return {
      budget: previewBudget,
      telemetry: input.telemetry,
      adaptiveBudgetDecision: input.adaptiveBudgetDecision,
      runtimeGuardrailState: input.runtimeGuardrailState,
      budgetUsage: {
        warmSessions: warmedSessionIds.length,
        activePreviewSessions: activeSessionIds.length,
        hiddenSessions: hiddenSessionCount,
        rendererBoundSessions: rendererBoundSessionIds.length,
        coldCandidates: previewCandidates.filter(
          (previewCandidate: PreviewFarmCandidate): boolean =>
            previewCandidate.currentWarmState === "cold",
        ).length,
        failedCandidates: previewCandidates.filter(
          (previewCandidate: PreviewFarmCandidate): boolean =>
            previewCandidate.currentWarmState === "failed",
        ).length,
      },
      candidates: previewCandidates.map(
        (previewCandidate: PreviewFarmCandidate): PreviewFarmCandidate =>
          this.cloneCandidate(previewCandidate),
      ),
      decisions,
      sessionAssignments,
      activeSessionIds,
      warmedSessionIds,
      retainedSessionIds,
      reusedSessionIds,
      rendererBoundSessionIds,
      legacyPathSessionIds,
      evictedSessionIds,
      deferredSessionIds,
      nextTransitionAtMs,
    };
  }

  /**
   * @brief Clone a preview budget for read-only state output
   *
   * @param previewBudget - Preview budget to clone
   *
   * @returns Cloned preview budget
   */
  private static cloneBudget(
    previewBudget: PreviewFarmBudget,
  ): PreviewFarmBudget {
    return {
      maxWarmSessions: previewBudget.maxWarmSessions,
      maxActivePreviewSessions: previewBudget.maxActivePreviewSessions,
      maxRendererBoundSessions: previewBudget.maxRendererBoundSessions,
      maxHiddenSessions: previewBudget.maxHiddenSessions,
      keepWarmAfterBlurMs: previewBudget.keepWarmAfterBlurMs,
      maxPreviewReuseMs: previewBudget.maxPreviewReuseMs,
      maxPreviewOverlapMs: previewBudget.maxPreviewOverlapMs,
    };
  }

  /**
   * @brief Clone one candidate for read-only snapshot output
   *
   * @param previewCandidate - Candidate to clone
   *
   * @returns Cloned preview candidate
   */
  private static cloneCandidate(
    previewCandidate: PreviewFarmCandidate,
  ): PreviewFarmCandidate {
    return {
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
    };
  }

  /**
   * @brief Compare two candidates using rank and stable browse order
   *
   * @param leftPreviewCandidate - First preview candidate
   * @param rightPreviewCandidate - Second preview candidate
   *
   * @returns Stable sort ordering
   */
  private static compareCandidates(
    leftPreviewCandidate: PreviewFarmCandidate,
    rightPreviewCandidate: PreviewFarmCandidate,
  ): number {
    if (
      leftPreviewCandidate.score.totalValue !==
      rightPreviewCandidate.score.totalValue
    ) {
      return (
        rightPreviewCandidate.score.totalValue -
        leftPreviewCandidate.score.totalValue
      );
    }

    if (leftPreviewCandidate.rowIndex !== rightPreviewCandidate.rowIndex) {
      return (
        (leftPreviewCandidate.rowIndex ?? Number.MAX_SAFE_INTEGER) -
        (rightPreviewCandidate.rowIndex ?? Number.MAX_SAFE_INTEGER)
      );
    }

    if (leftPreviewCandidate.itemIndex !== rightPreviewCandidate.itemIndex) {
      return (
        (leftPreviewCandidate.itemIndex ?? Number.MAX_SAFE_INTEGER) -
        (rightPreviewCandidate.itemIndex ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return leftPreviewCandidate.sessionId.localeCompare(
      rightPreviewCandidate.sessionId,
    );
  }

  /**
   * @brief Build the scheduler decision state for one candidate
   *
   * @param previewCandidate - Candidate being evaluated
   * @param input - Current preview-farm inputs
   * @param previewBudget - Active preview budget
   * @param supportsWarmSessions - Whether the runtime may keep warm sessions
   * @param supportsActivePreviewSessions - Whether active preview may be scheduled
   * @param activeSessionCount - Number of active sessions already selected
   * @param warmSessionCount - Number of warm sessions already selected
   * @param hiddenSessionCount - Number of hidden sessions already selected
   * @param rendererBoundSessionCount - Number of renderer-bound sessions already selected
   *
   * @returns Candidate decision state
   */
  private static createCandidateDecisionState(
    previewCandidate: PreviewFarmCandidate,
    input: PreviewFarmControllerInput,
    previewBudget: PreviewFarmBudget,
    supportsWarmSessions: boolean,
    supportsActivePreviewSessions: boolean,
    activeSessionCount: number,
    warmSessionCount: number,
    hiddenSessionCount: number,
    rendererBoundSessionCount: number,
  ): CandidateDecisionState {
    const wasPreviouslyWarm: boolean =
      input.currentlyPlannedWarmSessionIds.includes(
        previewCandidate.sessionId,
      ) ||
      input.currentlyPlannedActiveSessionIds.includes(
        previewCandidate.sessionId,
      ) ||
      previewCandidate.currentWarmState !== "cold";
    const isFocusedItem: boolean = previewCandidate.reason === "focused-item";
    const canActivateFocusedPreview: boolean =
      supportsActivePreviewSessions &&
      input.mediaIntentType === "focused-delay-elapsed" &&
      isFocusedItem &&
      activeSessionCount < previewBudget.maxActivePreviewSessions;
    const isWithinRetentionWindow: boolean = this.isWithinRetentionWindow(
      previewCandidate,
      input.nowMs,
      previewBudget.keepWarmAfterBlurMs,
    );
    const isWithinReuseWindow: boolean = this.isWithinReuseWindow(
      previewCandidate,
      input.nowMs,
      previewBudget.maxPreviewReuseMs,
    );
    const canRetainRecentFocus: boolean =
      previewCandidate.reason === "recent-focus" && isWithinRetentionWindow;
    const hiddenBudgetRemaining: boolean =
      hiddenSessionCount < previewBudget.maxHiddenSessions;
    const warmBudgetRemaining: boolean =
      warmSessionCount < previewBudget.maxWarmSessions;
    const canWarmHiddenCandidate: boolean =
      supportsWarmSessions && warmBudgetRemaining && hiddenBudgetRemaining;
    const shouldReuseWarmSession: boolean =
      wasPreviouslyWarm &&
      previewCandidate.canReuseWarmSession &&
      isWithinReuseWindow &&
      previewCandidate.currentWarmState !== "failed";
    const shouldKeepWarm: boolean =
      canActivateFocusedPreview ||
      (supportsWarmSessions &&
        (isFocusedItem ||
          previewCandidate.reason === "focus-neighbor" ||
          previewCandidate.reason === "likely-next-item" ||
          previewCandidate.reason === "visible-item" ||
          canRetainRecentFocus ||
          shouldReuseWarmSession) &&
        (canActivateFocusedPreview || canWarmHiddenCandidate));
    const shouldWarm: boolean = shouldKeepWarm;
    const shouldActivate: boolean = canActivateFocusedPreview;
    const shouldRetain: boolean = shouldWarm && canRetainRecentFocus;
    const shouldReuse: boolean = shouldWarm && shouldReuseWarmSession;
    const shouldEvict: boolean = !shouldWarm && wasPreviouslyWarm;
    const isDeferred: boolean = !shouldWarm;
    const rendererBound: boolean =
      shouldWarm &&
      previewCandidate.requiresRendererBudget &&
      rendererBoundSessionCount < previewBudget.maxRendererBoundSessions;
    const mustUseLegacyPreviewPath: boolean =
      !shouldWarm ||
      previewCandidate.mustUseLegacyPreviewPath ||
      !rendererBound;
    const shouldAttemptCustomDecode: boolean =
      shouldWarm &&
      previewCandidate.canUseCustomDecode &&
      !mustUseLegacyPreviewPath;
    const targetWarmState: PreviewSchedulerDecision["targetWarmState"] =
      shouldActivate
        ? "preview-active"
        : shouldRetain
          ? "cooling"
          : shouldWarm
            ? "ready-first-frame"
            : shouldEvict
              ? "evicted"
              : previewCandidate.currentWarmState === "failed"
                ? "failed"
                : "cold";
    const transitionReason: PreviewFarmTransitionReason | null =
      this.selectTransitionReason(
        previewCandidate,
        shouldActivate,
        shouldRetain,
        shouldReuse,
        mustUseLegacyPreviewPath,
      );
    const deferredReason: PreviewFarmTransitionReason | null = isDeferred
      ? this.selectDeferredReason(
          previewCandidate,
          input,
          previewBudget,
          supportsWarmSessions,
          warmBudgetRemaining,
          hiddenBudgetRemaining,
        )
      : null;
    const evictionReason: PreviewFarmEvictionReason | null = shouldEvict
      ? this.selectEvictionReason(
          previewCandidate,
          input,
          previewBudget,
          supportsWarmSessions,
          hiddenBudgetRemaining,
        )
      : null;
    const retainUntilMs: number | null =
      shouldRetain && previewCandidate.lastFocusedAtMs !== null
        ? previewCandidate.lastFocusedAtMs + previewBudget.keepWarmAfterBlurMs
        : null;
    const notes: string[] = [
      ...previewCandidate.notes,
      ...previewCandidate.score.notes,
    ];

    if (shouldReuse) {
      notes.push(
        "Preview farm reused the existing warm session for this item.",
      );
    }

    if (shouldRetain) {
      notes.push(
        "Preview farm retained the recently focused session for bounded reuse after blur.",
      );
    }

    if (shouldWarm && mustUseLegacyPreviewPath) {
      notes.push(
        "Preview farm kept this candidate on the conservative legacy preview path.",
      );
    }

    if (
      shouldWarm &&
      previewCandidate.requiresRendererBudget &&
      !rendererBound
    ) {
      notes.push(
        "Renderer-bound warming stayed conservative because the renderer budget was already reserved for a higher-priority session.",
      );
    }

    return {
      targetWarmState,
      shouldWarm,
      shouldActivate,
      shouldRetain,
      shouldReuse,
      shouldEvict,
      isDeferred,
      retainUntilMs,
      transitionReason,
      deferredReason,
      evictionReason,
      rendererBound,
      selectedRendererKind: mustUseLegacyPreviewPath
        ? null
        : previewCandidate.preferredRendererKind,
      shouldAttemptCustomDecode,
      mustUseLegacyPreviewPath,
      notes,
    };
  }

  /**
   * @brief Reuse a previous slot assignment when possible, otherwise claim the next free slot
   *
   * @param previewCandidate - Candidate being assigned
   * @param currentAssignmentsBySessionId - Previous assignments keyed by session
   * @param claimedSlotIds - Slot identifiers already reserved in the new snapshot
   * @param assignmentIndex - Index of the new assignment
   *
   * @returns Deterministic slot identifier
   */
  private static allocateSlotId(
    previewCandidate: PreviewFarmCandidate,
    currentAssignmentsBySessionId: Map<string, PreviewFarmAssignment>,
    claimedSlotIds: Set<string>,
    assignmentIndex: number,
  ): string {
    const previousPreviewFarmAssignment: PreviewFarmAssignment | undefined =
      currentAssignmentsBySessionId.get(previewCandidate.sessionId);

    if (
      previousPreviewFarmAssignment !== undefined &&
      !claimedSlotIds.has(previousPreviewFarmAssignment.slotId)
    ) {
      claimedSlotIds.add(previousPreviewFarmAssignment.slotId);

      return previousPreviewFarmAssignment.slotId;
    }

    let slotIndex: number = assignmentIndex;
    let slotId: string = `preview-slot-${slotIndex}`;

    while (claimedSlotIds.has(slotId)) {
      slotIndex += 1;
      slotId = `preview-slot-${slotIndex}`;
    }

    claimedSlotIds.add(slotId);

    return slotId;
  }

  /**
   * @brief Determine whether one candidate is still inside the post-blur retain window
   *
   * @param previewCandidate - Candidate being evaluated
   * @param nowMs - Current scheduler timestamp
   * @param keepWarmAfterBlurMs - Post-blur warm retention budget
   *
   * @returns `true` when the recent focus may stay warm
   */
  private static isWithinRetentionWindow(
    previewCandidate: PreviewFarmCandidate,
    nowMs: number,
    keepWarmAfterBlurMs: number,
  ): boolean {
    if (previewCandidate.lastFocusedAtMs === null) {
      return false;
    }

    return nowMs - previewCandidate.lastFocusedAtMs <= keepWarmAfterBlurMs;
  }

  /**
   * @brief Determine whether a previously warmed candidate may still be reused
   *
   * @param previewCandidate - Candidate being evaluated
   * @param nowMs - Current scheduler timestamp
   * @param maxPreviewReuseMs - Maximum warm reuse age
   *
   * @returns `true` when the session may still be reused
   */
  private static isWithinReuseWindow(
    previewCandidate: PreviewFarmCandidate,
    nowMs: number,
    maxPreviewReuseMs: number,
  ): boolean {
    if (previewCandidate.lastFocusedAtMs === null) {
      return false;
    }

    return nowMs - previewCandidate.lastFocusedAtMs <= maxPreviewReuseMs;
  }

  /**
   * @brief Keep the nearest upcoming transition timestamp
   *
   * @param currentTransitionAtMs - Currently selected transition time
   * @param candidateTransitionAtMs - Candidate transition time
   *
   * @returns Earliest non-null transition time
   */
  private static selectEarlierTransition(
    currentTransitionAtMs: number | null,
    candidateTransitionAtMs: number,
  ): number {
    if (currentTransitionAtMs === null) {
      return candidateTransitionAtMs;
    }

    return Math.min(currentTransitionAtMs, candidateTransitionAtMs);
  }

  /**
   * @brief Select the surfaced transition reason for one warmed candidate
   *
   * @param previewCandidate - Candidate being transitioned
   * @param shouldActivate - Whether the session becomes active
   * @param shouldRetain - Whether the session is retained after blur
   * @param shouldReuse - Whether the session reuses prior warm state
   * @param mustUseLegacyPreviewPath - Whether the session stays on the legacy path
   *
   * @returns Transition reason for debug output
   */
  private static selectTransitionReason(
    previewCandidate: PreviewFarmCandidate,
    shouldActivate: boolean,
    shouldRetain: boolean,
    shouldReuse: boolean,
    mustUseLegacyPreviewPath: boolean,
  ): PreviewFarmTransitionReason | null {
    if (shouldActivate) {
      return "focused-item-activated";
    }

    if (shouldReuse) {
      return "existing-warm-session-reused";
    }

    if (shouldRetain) {
      return "recent-focus-retained";
    }

    if (mustUseLegacyPreviewPath) {
      return "legacy-path-required";
    }

    switch (previewCandidate.reason) {
      case "focused-item":
        return "focused-item-warmed";
      case "focus-neighbor":
        return "same-row-neighbor-warmed";
      case "likely-next-item":
        return "likely-next-warmed";
      case "visible-item":
        return "visible-item-warmed";
      case "recent-focus":
        return "recent-focus-retained";
      case "background-priority":
      case "lower-priority":
      case "over-budget":
      case "runtime-unsupported":
        return "lower-priority";
    }
  }

  /**
   * @brief Explain why one candidate stayed cold
   *
   * @param previewCandidate - Candidate that was not selected
   * @param input - Current preview-farm input
   * @param previewBudget - Active preview budget
   * @param supportsWarmSessions - Whether the runtime supports warm sessions
   * @param warmBudgetRemaining - Whether a warm slot is still available
   * @param hiddenBudgetRemaining - Whether a hidden slot is still available
   *
   * @returns Deferred reason for debug output
   */
  private static selectDeferredReason(
    previewCandidate: PreviewFarmCandidate,
    input: PreviewFarmControllerInput,
    previewBudget: PreviewFarmBudget,
    supportsWarmSessions: boolean,
    warmBudgetRemaining: boolean,
    hiddenBudgetRemaining: boolean,
  ): PreviewFarmTransitionReason {
    if (!supportsWarmSessions) {
      return "runtime-unsupported";
    }

    if (previewCandidate.itemId === input.backgroundItemId) {
      return "background-priority";
    }

    if (
      previewCandidate.reason === "recent-focus" &&
      !this.isWithinReuseWindow(
        previewCandidate,
        input.nowMs,
        previewBudget.maxPreviewReuseMs,
      )
    ) {
      return "reuse-window-expired";
    }

    if (!warmBudgetRemaining) {
      return "warm-budget-exhausted";
    }

    if (!hiddenBudgetRemaining) {
      return "hidden-budget-exhausted";
    }

    return "lower-priority";
  }

  /**
   * @brief Explain why one previously warm session is now being evicted
   *
   * @param previewCandidate - Candidate being removed
   * @param input - Current preview-farm input
   * @param previewBudget - Active preview budget
   * @param supportsWarmSessions - Whether the runtime supports warm sessions
   * @param hiddenBudgetRemaining - Whether hidden budget remained available
   *
   * @returns Eviction reason for debug output
   */
  private static selectEvictionReason(
    previewCandidate: PreviewFarmCandidate,
    input: PreviewFarmControllerInput,
    previewBudget: PreviewFarmBudget,
    supportsWarmSessions: boolean,
    hiddenBudgetRemaining: boolean,
  ): PreviewFarmEvictionReason {
    if (
      previewCandidate.reason === "recent-focus" &&
      !this.isWithinReuseWindow(
        previewCandidate,
        input.nowMs,
        previewBudget.maxPreviewReuseMs,
      )
    ) {
      return "reuse-window-expired";
    }

    if (!supportsWarmSessions) {
      return "runtime-unsupported";
    }

    if (previewCandidate.itemId === input.backgroundItemId) {
      return "background-priority";
    }

    if (!hiddenBudgetRemaining) {
      return "hidden-budget-exhausted";
    }

    if (previewCandidate.requiresRendererBudget) {
      return "renderer-budget-exhausted";
    }

    return "over-budget";
  }
}
