/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { PreviewFarmBudget } from "../preview/PreviewFarmBudget";
import type { TelemetrySnapshot } from "../telemetry/TelemetrySnapshot";
import type { AdaptiveBudgetDecision } from "./AdaptiveBudgetDecision";
import type { AdaptiveBudgetDecisionReason } from "./AdaptiveBudgetDecisionReason";
import type { RuntimeGuardrailReason } from "./RuntimeGuardrailReason";
import type { RuntimeGuardrailState } from "./RuntimeGuardrailState";

type AdaptiveBudgetPolicyConfig = {
  minimumWarmSessions: number;
  reducedWarmSessions: number;
  reducedRendererBoundSessions: number;
  reducedKeepWarmAfterBlurMs: number;
  reducedPreviewReuseMs: number;
};

/**
 * @brief Conservative adaptive budget policy driven by bounded local telemetry
 */
export class AdaptiveBudgetPolicy {
  private static readonly DEFAULT_CONFIG: AdaptiveBudgetPolicyConfig = {
    minimumWarmSessions: 1,
    reducedWarmSessions: 2,
    reducedRendererBoundSessions: 0,
    reducedKeepWarmAfterBlurMs: 1200,
    reducedPreviewReuseMs: 2200,
  };

  /**
   * @brief Evaluate one explainable adaptive decision from recent telemetry
   *
   * @param baseBudget - Stable budget supplied by app capabilities
   * @param telemetrySnapshot - Current local telemetry snapshot
   * @param evaluatedAtMs - Evaluation timestamp
   *
   * @returns Effective budget and active runtime guardrails
   */
  public static evaluate(
    baseBudget: PreviewFarmBudget,
    telemetrySnapshot: TelemetrySnapshot,
    evaluatedAtMs: number,
  ): {
    adaptiveBudgetDecision: AdaptiveBudgetDecision;
    runtimeGuardrailState: RuntimeGuardrailState;
  } {
    const config: AdaptiveBudgetPolicyConfig = this.DEFAULT_CONFIG;
    const effectiveBudget: PreviewFarmBudget = {
      maxWarmSessions: baseBudget.maxWarmSessions,
      maxActivePreviewSessions: baseBudget.maxActivePreviewSessions,
      maxRendererBoundSessions: baseBudget.maxRendererBoundSessions,
      maxHiddenSessions: baseBudget.maxHiddenSessions,
      maxPreviewReuseMs: baseBudget.maxPreviewReuseMs,
      maxPreviewOverlapMs: baseBudget.maxPreviewOverlapMs,
      keepWarmAfterBlurMs: baseBudget.keepWarmAfterBlurMs,
    };
    const decisionReasons: AdaptiveBudgetDecisionReason[] = [
      "stable-default-budget",
    ];
    const decisionNotes: string[] = [];
    const guardrailReasons: RuntimeGuardrailReason[] = [];
    const guardrailNotes: string[] = [];
    const rollingWindow = telemetrySnapshot.rollingWindow;
    const previewFailureCount: number = rollingWindow.preview.activationFailure;
    const previewSuccessCount: number = rollingWindow.preview.activationSuccess;
    const rendererFailureCount: number =
      rollingWindow.renderer.webgpuFailure +
      rollingWindow.renderer.webglFailure +
      rollingWindow.renderer.legacyFallbacks;
    const rendererSuccessCount: number =
      rollingWindow.renderer.webgpuSuccess +
      rollingWindow.renderer.webglSuccess;
    const customDecodeFailureCount: number = rollingWindow.customDecode.failure;
    const customDecodeSuccessCount: number = rollingWindow.customDecode.success;
    const reuseHitCount: number = rollingWindow.preview.reuseHit;
    const reuseMissCount: number = rollingWindow.preview.reuseMiss;

    if (previewFailureCount >= 3 && previewFailureCount > previewSuccessCount) {
      effectiveBudget.maxWarmSessions = Math.min(
        effectiveBudget.maxWarmSessions,
        Math.max(config.minimumWarmSessions, config.reducedWarmSessions),
      );
      effectiveBudget.keepWarmAfterBlurMs = Math.min(
        effectiveBudget.keepWarmAfterBlurMs,
        config.reducedKeepWarmAfterBlurMs,
      );
      effectiveBudget.maxPreviewReuseMs = Math.min(
        effectiveBudget.maxPreviewReuseMs,
        config.reducedPreviewReuseMs,
      );
      decisionReasons.push("preview-failure-guardrail");
      decisionNotes.push(
        "Recent preview activation failures exceeded successes, so warm retention stayed conservative.",
      );
      guardrailReasons.push("preview-failure-streak");
      guardrailNotes.push(
        "Aggressive preview warming is temporarily suppressed after repeated recent preview failures.",
      );
    }

    if (reuseMissCount >= 3 && reuseHitCount === 0) {
      effectiveBudget.maxWarmSessions = Math.min(
        effectiveBudget.maxWarmSessions,
        config.minimumWarmSessions,
      );
      effectiveBudget.keepWarmAfterBlurMs = Math.min(
        effectiveBudget.keepWarmAfterBlurMs,
        config.reducedKeepWarmAfterBlurMs,
      );
      decisionReasons.push("poor-preview-reuse");
      decisionNotes.push(
        "Recent warm sessions showed low reuse value, so hidden retention was shortened.",
      );
      guardrailReasons.push("low-preview-reuse-value");
      guardrailNotes.push(
        "Extra warm sessions are suppressed while reuse value remains low.",
      );
    } else if (reuseHitCount >= 3 && reuseHitCount > reuseMissCount) {
      decisionReasons.push("good-preview-reuse");
      decisionNotes.push(
        "Recent warm reuse is positive, so the existing conservative retention budget stayed intact.",
      );
    }

    if (
      rendererFailureCount >= 3 &&
      rendererFailureCount > rendererSuccessCount
    ) {
      effectiveBudget.maxRendererBoundSessions = Math.min(
        effectiveBudget.maxRendererBoundSessions,
        config.reducedRendererBoundSessions,
      );
      decisionReasons.push("renderer-fallback-churn");
      decisionNotes.push(
        "Renderer fallback churn was high in the recent window, so renderer-bound preview work was reduced.",
      );
      guardrailReasons.push("renderer-fallback-churn");
      guardrailNotes.push(
        "Renderer-bound preview work is temporarily suppressed until recent routing stabilizes.",
      );
    }

    if (
      customDecodeFailureCount >= 3 &&
      customDecodeFailureCount > customDecodeSuccessCount
    ) {
      effectiveBudget.maxRendererBoundSessions = Math.min(
        effectiveBudget.maxRendererBoundSessions,
        config.reducedRendererBoundSessions,
      );
      decisionReasons.push("custom-decode-failure-rate");
      decisionNotes.push(
        "Recent custom decode failures outpaced successes, so preview work now prefers the legacy path.",
      );
      guardrailReasons.push("custom-decode-instability");
      guardrailNotes.push(
        "Custom decode preview warming is temporarily disabled after repeated recent failures.",
      );
    }

    const runtimeGuardrailState: RuntimeGuardrailState = {
      suppressAggressiveWarmExpansion: guardrailReasons.includes(
        "preview-failure-streak",
      ),
      suppressExtraWarmSessions: guardrailReasons.includes(
        "low-preview-reuse-value",
      ),
      disableCustomDecodePreviewWarm: guardrailReasons.includes(
        "custom-decode-instability",
      ),
      disableRendererBoundPreviewWork: guardrailReasons.includes(
        "renderer-fallback-churn",
      ),
      suppressedRendererBackends:
        rollingWindow.renderer.webgpuFailure >= 3 &&
        rollingWindow.renderer.webgpuFailure >
          rollingWindow.renderer.webgpuSuccess
          ? ["webgpu"]
          : [],
      preferredRendererBackend:
        rollingWindow.renderer.webgpuFailure >= 3 &&
        rollingWindow.renderer.webgpuFailure >
          rollingWindow.renderer.webgpuSuccess
          ? "webgl"
          : null,
      reasons: guardrailReasons.length > 0 ? guardrailReasons : ["none"],
      notes:
        guardrailNotes.length > 0
          ? guardrailNotes
          : ["No runtime guardrails are active in this session."],
      evaluatedAtMs,
    };

    if (runtimeGuardrailState.suppressedRendererBackends.includes("webgpu")) {
      if (
        !runtimeGuardrailState.reasons.includes("renderer-webgpu-instability")
      ) {
        runtimeGuardrailState.reasons.push("renderer-webgpu-instability");
      }

      runtimeGuardrailState.notes.push(
        "WebGPU is temporarily suppressed because recent routing failures exceeded recent successes.",
      );
    }

    return {
      adaptiveBudgetDecision: {
        baseBudget,
        effectiveBudget,
        reasons: decisionReasons,
        notes:
          decisionNotes.length > 0
            ? decisionNotes
            : ["No adaptive budget adjustments are active in this session."],
        evaluatedAtMs,
      },
      runtimeGuardrailState,
    };
  }
}
