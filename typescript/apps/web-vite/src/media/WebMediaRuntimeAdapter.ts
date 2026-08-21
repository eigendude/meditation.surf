/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  type Catalog,
  type CommittedPlaybackDecision,
  type CustomDecodeSnapshot,
  type MediaAudioTrackInfo,
  type MediaExecutionCommand,
  type MediaExecutionResult,
  MediaInventoryCloner,
  type MediaInventoryRequest,
  type MediaInventoryResult,
  type MediaItem,
  type MediaPlaybackLane,
  type MediaRuntimeAdapter,
  type MediaRuntimeCapabilities,
  type MediaRuntimeSessionHandle,
  type MediaSourceDescriptor,
  type MediaStartupDebugState,
  type MediaTextTrackInfo,
  type MediaVariantInfo,
  type PlaybackSequenceController,
  type PreviewSchedulerDecision,
  type PreviewSessionAssignment,
  type RendererDecision,
  type RendererFrameHandle,
  RendererRouter as SharedRendererRouter,
  type RendererSnapshot,
} from "@meditation-surf/core";
import { type StartupWarmResult, VfsController } from "@meditation-surf/vfs";

import { WebCustomDecodeSessionAdapter } from "./WebCustomDecodeSessionAdapter";
import {
  type WebPreviewSurfaceEntry,
  WebPreviewSurfaceRegistry,
} from "./WebPreviewSurfaceRegistry";
import { WebRendererCapabilityProbe } from "./WebRendererCapabilityProbe";
import { WebRendererRouter } from "./WebRendererRouter";

type ShakaModule =
  (typeof import("shaka-player/dist/shaka-player.compiled.js"))["default"];
type ShakaPlayer = InstanceType<ShakaModule["Player"]>;
type ShakaTrack = {
  id: number;
  active: boolean;
  audioBandwidth: number | null;
  audioCodec: string | null;
  bandwidth: number;
  channelsCount: number | null;
  codec: string | null;
  codecs: string | null;
  frameRate: number | null;
  height: number | null;
  kind: string | null;
  label: string | null;
  language: string;
  primary: boolean;
  spatialAudio?: boolean;
  type: string;
  videoBandwidth: number | null;
  videoCodec: string | null;
  width: number | null;
};
type ShakaTextTrack = {
  active: boolean;
  codecs: string | null;
  id: number;
  kind: string | null;
  label: string | null;
  language: string;
  primary: boolean;
};
type ShakaInventoryPlayer = {
  destroy(): Promise<void>;
  getAudioTracks(): ShakaTrack[];
  getTextTracks(): ShakaTextTrack[];
  getVariantTracks(): ShakaTrack[];
  load(sourceUrl: string): Promise<unknown>;
};

type ManagedPreviewRuntimeSession = {
  runtimeSessionHandle: MediaRuntimeSessionHandle;
  plannedSessionId: string | null;
  itemId: string | null;
  sourceId: string | null;
  state: MediaExecutionResult["state"];
  customDecodeSnapshot: CustomDecodeSnapshot | null;
  previewRendererRouter: WebRendererRouter | null;
  rendererSnapshot: RendererSnapshot | null;
  hostElement: HTMLDivElement | null;
  videoElement: HTMLVideoElement | null;
  shakaPlayer: ShakaPlayer | null;
};

type ManagedBackgroundRuntimeSession = {
  runtimeSessionHandle: MediaRuntimeSessionHandle;
  plannedSessionId: string | null;
  itemId: string | null;
  state: MediaExecutionResult["state"];
};

/**
 * @brief Thin web runtime adapter for shared media execution commands
 *
 * The web shell now owns a small preview pool plus one separate background
 * playback session. Preview slots stay isolated from the committed background
 * path so browse previews never promote into fullscreen playback.
 */
export class WebMediaRuntimeAdapter implements MediaRuntimeAdapter {
  public static readonly RUNTIME_ID: string = "web-vite";
  private static readonly PREVIEW_POOL_SIZE: number = 3;

  private static readonly CAPABILITIES: MediaRuntimeCapabilities = {
    canWarmFirstFrame: true,
    canActivateBackground: true,
    canPreviewInline: true,
    canKeepHiddenWarmSession: true,
    canPromoteWarmSession: false,
    canRunMultipleWarmSessions: true,
    supportsWebCodecs: WebCustomDecodeSessionAdapter.isSupported(),
    supportsWebGpuRenderer: false,
    supportsWebGlRenderer: false,
    supportsRendererPreviewRouting: false,
    supportsRendererExtractionRouting: false,
    committedPlaybackBypassesRendererRouter: true,
    customDecodeLanes: ["preview-warm", "preview-active"],
    supportsCommittedPlayback: true,
    supportsPremiumCommittedPlayback: true,
    committedPlaybackLanePreference: "prefer-native",
    committedPlaybackLanes: ["native", "shaka"],
    existingBackgroundPlaybackLane: "native",
    previewSchedulerBudget: {
      maxWarmSessions: 3,
      maxActivePreviewSessions: 1,
      maxRendererBoundSessions: 1,
      maxHiddenSessions: 2,
      maxPreviewReuseMs: 5000,
      maxPreviewOverlapMs: 0,
      keepWarmAfterBlurMs: 2500,
    },
    audioCapabilities: {
      canPlayCommittedAudio: true,
      canAttemptPremiumAudio: false,
      canFallbackStereo: true,
      canKeepPreviewMuted: true,
      canKeepExtractionSilent: true,
    },
  };

  public readonly runtimeId: string;

  private readonly catalog: Catalog;
  private readonly playbackSequenceController: PlaybackSequenceController;
  private readonly previewRuntimeSessions: ManagedPreviewRuntimeSession[];
  private readonly previewSurfaceRegistry: WebPreviewSurfaceRegistry;
  private readonly backgroundRuntimeSession: ManagedBackgroundRuntimeSession;
  private readonly inventoryResultPromisesBySourceId: Map<
    string,
    Promise<MediaInventoryResult>
  >;
  private readonly vfsController: VfsController;

  /**
   * @brief Build the web runtime adapter
   *
   * @param catalog - Shared catalog used to resolve items by identifier
   * @param playbackSequenceController - Shared playback sequence controller
   * @param previewSurfaceRegistry - Web-only browse-card preview hosts
   * @param vfsController - Shared VFS controller used for startup warming
   */
  public constructor(
    catalog: Catalog,
    playbackSequenceController: PlaybackSequenceController,
    previewSurfaceRegistry: WebPreviewSurfaceRegistry,
    vfsController: VfsController,
  ) {
    this.runtimeId = WebMediaRuntimeAdapter.RUNTIME_ID;
    this.catalog = catalog;
    this.playbackSequenceController = playbackSequenceController;
    this.previewSurfaceRegistry = previewSurfaceRegistry;
    this.vfsController = vfsController;
    this.previewRuntimeSessions = this.createPreviewRuntimeSessions();
    this.inventoryResultPromisesBySourceId = new Map<
      string,
      Promise<MediaInventoryResult>
    >();
    this.backgroundRuntimeSession = {
      runtimeSessionHandle: {
        handleId: "background-session",
        runtimeId: this.runtimeId,
      },
      plannedSessionId: null,
      itemId: null,
      state: "inactive",
    };
    this.previewSurfaceRegistry.subscribe((): void => {
      this.syncActivePreviewSurfaces();
    });
  }

  /**
   * @brief Report the current web runtime execution capabilities
   *
   * @returns Web runtime capability snapshot
   */
  public getCapabilities(): MediaRuntimeCapabilities {
    const rendererProbeResult = WebRendererCapabilityProbe.probe();

    return {
      ...WebMediaRuntimeAdapter.CAPABILITIES,
      supportsWebGpuRenderer: rendererProbeResult.supportsWebGpuRenderer,
      supportsWebGlRenderer: rendererProbeResult.supportsWebGlRenderer,
      supportsRendererPreviewRouting:
        rendererProbeResult.supportsRendererPreviewRouting,
      supportsRendererExtractionRouting:
        rendererProbeResult.supportsRendererExtractionRouting,
      committedPlaybackBypassesRendererRouter: true,
      customDecodeLanes: [
        ...WebMediaRuntimeAdapter.CAPABILITIES.customDecodeLanes,
      ],
      committedPlaybackLanes: [
        ...WebMediaRuntimeAdapter.CAPABILITIES.committedPlaybackLanes,
      ],
      previewSchedulerBudget: {
        maxWarmSessions:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxWarmSessions,
        maxActivePreviewSessions:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxActivePreviewSessions,
        maxRendererBoundSessions:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxRendererBoundSessions,
        maxHiddenSessions:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxHiddenSessions,
        maxPreviewReuseMs:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxPreviewReuseMs,
        maxPreviewOverlapMs:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .maxPreviewOverlapMs,
        keepWarmAfterBlurMs:
          WebMediaRuntimeAdapter.CAPABILITIES.previewSchedulerBudget
            .keepWarmAfterBlurMs,
      },
      audioCapabilities: {
        canPlayCommittedAudio:
          WebMediaRuntimeAdapter.CAPABILITIES.audioCapabilities
            .canPlayCommittedAudio,
        canAttemptPremiumAudio:
          WebMediaRuntimeAdapter.CAPABILITIES.audioCapabilities
            .canAttemptPremiumAudio,
        canFallbackStereo:
          WebMediaRuntimeAdapter.CAPABILITIES.audioCapabilities
            .canFallbackStereo,
        canKeepPreviewMuted:
          WebMediaRuntimeAdapter.CAPABILITIES.audioCapabilities
            .canKeepPreviewMuted,
        canKeepExtractionSilent:
          WebMediaRuntimeAdapter.CAPABILITIES.audioCapabilities
            .canKeepExtractionSilent,
      },
    };
  }

  /**
   * @brief Resolve the strongest inspectable inventory snapshot available on web
   *
   * @param request - Shared inventory lookup request
   *
   * @returns Full Shaka-backed inventory when available, otherwise explicit partial fallback
   */
  public async resolveMediaInventory(
    request: MediaInventoryRequest,
  ): Promise<MediaInventoryResult> {
    const sourceDescriptor: MediaSourceDescriptor | null =
      request.sourceDescriptor;

    if (sourceDescriptor === null) {
      return {
        supportLevel: "unsupported",
        snapshot: {
          sourceId: null,
          supportLevel: "unsupported",
          inventorySource: "unavailable",
          selectionReason: "inventory-unsupported",
          inventory: null,
          notes: [
            "Web inventory lookup could not run because the source descriptor was missing.",
          ],
        },
        failureReason:
          "No source descriptor was available for web inventory lookup.",
      };
    }

    const existingInventoryPromise: Promise<MediaInventoryResult> | undefined =
      this.inventoryResultPromisesBySourceId.get(sourceDescriptor.sourceId);

    if (existingInventoryPromise !== undefined) {
      return await existingInventoryPromise;
    }

    const inventoryPromise: Promise<MediaInventoryResult> =
      this.buildInventoryResult(request);

    this.inventoryResultPromisesBySourceId.set(
      sourceDescriptor.sourceId,
      inventoryPromise,
    );

    return await inventoryPromise;
  }

  /**
   * @brief Execute one shared runtime command on the web shell
   *
   * @param command - Shared execution command emitted by the media kernel
   *
   * @returns Runtime result reported back to the shared executor
   */
  public async execute(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    switch (command.type) {
      case "sync-plan":
        return this.createResult(
          "inactive",
          command.runtimeSessionHandle,
          null,
          null,
          null,
          null,
        );
      case "warm-session":
        return this.handleWarmSession(command);
      case "activate-session":
        return this.handleActivateSession(command);
      case "deactivate-session":
        return this.handleDeactivateSession(command);
      case "dispose-session":
        return this.handleDisposeSession(command);
    }
  }

  /**
   * @brief Handle preview warming requests
   *
   * @param command - Shared warm command
   *
   * @returns Web execution result
   */
  private async handleWarmSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    const plannedSession: MediaExecutionCommand["session"] = command.session;

    if (plannedSession === null) {
      return this.createResult(
        "unsupported",
        command.runtimeSessionHandle,
        null,
        "Web runtime warm command was missing a planned session.",
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    if (plannedSession.role !== "preview") {
      return this.createResult(
        "unsupported",
        command.runtimeSessionHandle,
        null,
        "Web runtime only warms preview sessions in this phase.",
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    if (plannedSession.source === null) {
      return this.createResult(
        "failed",
        command.runtimeSessionHandle,
        null,
        `Web runtime could not warm preview session ${plannedSession.sessionId} without a source descriptor.`,
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    const previewRuntimeSession: ManagedPreviewRuntimeSession | null =
      this.resolvePreviewRuntimeSession(command, plannedSession);

    if (previewRuntimeSession === null) {
      return this.createResult(
        "failed",
        command.runtimeSessionHandle,
        null,
        `Web runtime could not allocate a preview slot for ${plannedSession.sessionId}.`,
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    if (
      previewRuntimeSession.plannedSessionId === plannedSession.sessionId &&
      previewRuntimeSession.sourceId === plannedSession.source.sourceId &&
      (previewRuntimeSession.state === "ready-first-frame" ||
        previewRuntimeSession.state === "preview-active")
    ) {
      return this.createResult(
        previewRuntimeSession.state,
        previewRuntimeSession.runtimeSessionHandle,
        null,
        null,
        null,
        this.createAcceptedAudioExecution(command, true),
        previewRuntimeSession.customDecodeSnapshot,
        previewRuntimeSession.rendererSnapshot,
      );
    }

    try {
      const previewFarmDecision: PreviewSchedulerDecision | null =
        this.resolvePreviewFarmDecision(command, plannedSession.sessionId);
      const shouldAttemptCustomDecode: boolean =
        previewFarmDecision?.shouldAttemptCustomDecode ?? true;
      const legacyFallbackReason: string =
        previewFarmDecision?.mustUseLegacyPreviewPath === true
          ? (previewFarmDecision.notes.find(
              (previewFarmNote: string): boolean =>
                previewFarmNote.includes("legacy preview path") ||
                previewFarmNote.includes("renderer-bound budget"),
            ) ??
            "Preview farm kept this session on the established preview video path to preserve conservative renderer-bound budgets.")
          : "Preview warm stayed on the existing preview path.";
      const previewCustomDecodeCapability =
        plannedSession.capabilitySnapshot?.customDecodeCapability ?? null;
      const customDecodeSnapshot: CustomDecodeSnapshot | null =
        shouldAttemptCustomDecode
          ? await this.tryWarmPreviewCustomDecode(
              command,
              plannedSession,
              previewRuntimeSession,
            )
          : previewCustomDecodeCapability === null ||
              plannedSession.customDecodeDecision === null
            ? null
            : this.createPreviewCustomDecodeSnapshot(
                previewCustomDecodeCapability,
                plannedSession.customDecodeDecision,
                "unsupported",
                false,
                true,
                legacyFallbackReason,
                null,
              );
      previewRuntimeSession.customDecodeSnapshot =
        this.cloneCustomDecodeSnapshot(customDecodeSnapshot);
      previewRuntimeSession.rendererSnapshot =
        SharedRendererRouter.cloneSnapshot(
          customDecodeSnapshot?.renderer ??
            this.createPreviewRendererFallbackSnapshot(
              plannedSession,
              "preview-warm",
              legacyFallbackReason,
              [],
              null,
            ),
        );
      const startupDebugState: MediaStartupDebugState | null =
        await this.buildStartupDebugState(
          "preview-warm",
          plannedSession.source,
        );
      await this.preparePreviewSessionForReuse(
        previewRuntimeSession,
        plannedSession,
      );
      await this.loadPreviewSource(previewRuntimeSession, plannedSession);
      previewRuntimeSession.videoElement?.pause();
      this.applyRequestedPreviewAudioState(
        previewRuntimeSession.videoElement,
        command.audioExecution,
      );
      previewRuntimeSession.state = "ready-first-frame";

      return this.createResult(
        "ready-first-frame",
        previewRuntimeSession.runtimeSessionHandle,
        null,
        null,
        startupDebugState,
        this.createAcceptedAudioExecution(command, true),
        previewRuntimeSession.customDecodeSnapshot,
        previewRuntimeSession.rendererSnapshot,
      );
    } catch (error: unknown) {
      const failureReason: string = this.describeRuntimeError(
        error,
        `Web preview warm failed for ${plannedSession.sessionId}`,
      );

      previewRuntimeSession.state = "failed";

      return this.createResult(
        "failed",
        previewRuntimeSession.runtimeSessionHandle,
        null,
        failureReason,
        await this.buildStartupDebugState(
          "preview-warm",
          plannedSession.source,
          failureReason,
        ),
        this.createAcceptedAudioExecution(command, false),
        previewRuntimeSession.customDecodeSnapshot,
        previewRuntimeSession.rendererSnapshot,
      );
    }
  }

  /**
   * @brief Handle preview or background activation requests
   *
   * @param command - Shared activate command
   *
   * @returns Web execution result
   */
  private async handleActivateSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    if (command.session?.role === "preview") {
      return this.activatePreviewSession(command);
    }

    return this.activateBackgroundSession(command);
  }

  /**
   * @brief Pause an active runtime session without tearing all resources down
   *
   * @param command - Shared deactivate command
   *
   * @returns Web execution result
   */
  private async handleDeactivateSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    if (command.session?.role === "preview") {
      return this.deactivatePreviewSession(command);
    }

    if (command.session?.role === "background") {
      return this.deactivateBackgroundSession(command);
    }

    return this.createResult(
      "inactive",
      command.runtimeSessionHandle,
      null,
      null,
    );
  }

  /**
   * @brief Dispose runtime resources owned by an obsolete session
   *
   * @param command - Shared dispose command
   *
   * @returns Web execution result
   */
  private async handleDisposeSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    if (command.session?.role === "preview") {
      return this.disposePreviewSession(command);
    }

    if (command.session?.role === "background") {
      return this.disposeBackgroundSession(command);
    }

    return this.createResult(
      "disposed",
      command.runtimeSessionHandle,
      null,
      null,
    );
  }

  /**
   * @brief Activate one preview slot inside the focused card
   *
   * @param command - Shared activate command for a preview session
   *
   * @returns Web execution result
   */
  private async activatePreviewSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    const plannedSession: MediaExecutionCommand["session"] = command.session;

    if (plannedSession === null || plannedSession.role !== "preview") {
      return this.createResult(
        "unsupported",
        command.runtimeSessionHandle,
        null,
        "Web preview activation requires a preview session.",
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    const previewRuntimeSession: ManagedPreviewRuntimeSession | null =
      this.findPreviewRuntimeSession(plannedSession.sessionId, command);

    if (previewRuntimeSession === null) {
      return this.createResult(
        "failed",
        command.runtimeSessionHandle,
        null,
        `Web preview activation could not resolve slot ${plannedSession.sessionId}.`,
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    if (previewRuntimeSession.videoElement === null) {
      return this.createResult(
        "failed",
        previewRuntimeSession.runtimeSessionHandle,
        null,
        `Web preview session ${plannedSession.sessionId} has no warmed video element.`,
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    this.deactivateOtherActivePreviewSessions(plannedSession.sessionId);
    this.attachPreviewRendererSurface(
      previewRuntimeSession,
      plannedSession.itemId,
    );
    this.applyRequestedPreviewAudioState(
      previewRuntimeSession.videoElement,
      command.audioExecution,
    );

    try {
      await previewRuntimeSession.videoElement.play();
      this.detachPreviewRendererSurface(previewRuntimeSession);
      this.attachPreviewSurface(previewRuntimeSession, plannedSession.itemId);
      previewRuntimeSession.state = "preview-active";
      previewRuntimeSession.customDecodeSnapshot =
        this.promotePreviewCustomDecodeSnapshot(
          previewRuntimeSession.customDecodeSnapshot,
        );
      previewRuntimeSession.rendererSnapshot =
        this.promotePreviewRendererSnapshot(
          previewRuntimeSession.rendererSnapshot,
          plannedSession,
        );

      return this.createResult(
        "preview-active",
        previewRuntimeSession.runtimeSessionHandle,
        null,
        null,
        null,
        this.createAcceptedAudioExecution(command, true),
        previewRuntimeSession.customDecodeSnapshot,
        previewRuntimeSession.rendererSnapshot,
      );
    } catch (error: unknown) {
      const failureReason: string = this.describeRuntimeError(
        error,
        `Web preview playback failed for ${plannedSession.sessionId}`,
      );

      this.detachPreviewSurface(previewRuntimeSession);
      this.detachPreviewRendererSurface(previewRuntimeSession);
      previewRuntimeSession.state = "failed";

      return this.createResult(
        "failed",
        previewRuntimeSession.runtimeSessionHandle,
        null,
        failureReason,
        null,
        this.createAcceptedAudioExecution(command, false),
        previewRuntimeSession.customDecodeSnapshot,
        previewRuntimeSession.rendererSnapshot,
      );
    }
  }

  /**
   * @brief Activate the committed background playback path
   *
   * @param command - Shared activate command for a background session
   *
   * @returns Web execution result
   */
  private async activateBackgroundSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    const plannedSession: MediaExecutionCommand["session"] = command.session;
    const runtimeSessionHandle: MediaRuntimeSessionHandle =
      this.backgroundRuntimeSession.runtimeSessionHandle;
    const targetItemId: string | null = plannedSession?.itemId ?? null;
    const mediaItem: MediaItem | null = this.resolveMediaItem(targetItemId);
    const committedPlaybackDecision: CommittedPlaybackDecision | null =
      this.resolveCommittedPlaybackDecision(command);

    if (plannedSession?.role !== "background") {
      return this.createResult(
        "unsupported",
        runtimeSessionHandle,
        committedPlaybackDecision,
        "Web activation is only wired for preview and background sessions.",
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    if (mediaItem === null) {
      return this.createResult(
        "failed",
        runtimeSessionHandle,
        committedPlaybackDecision,
        `Web runtime could not resolve media item ${targetItemId ?? "null"}.`,
        null,
        this.createAcceptedAudioExecution(command, false),
      );
    }

    this.backgroundRuntimeSession.plannedSessionId = plannedSession.sessionId;
    this.backgroundRuntimeSession.itemId = mediaItem.id;
    this.backgroundRuntimeSession.state = "waiting-first-frame";
    this.playbackSequenceController.setCommittedPlayback(
      mediaItem,
      committedPlaybackDecision,
    );

    return this.createResult(
      "waiting-first-frame",
      runtimeSessionHandle,
      committedPlaybackDecision,
      null,
      await this.buildStartupDebugState(
        "committed-playback-startup",
        plannedSession.source,
      ),
      this.createAcceptedAudioExecution(command, true),
    );
  }

  /**
   * @brief Pause and hide one active preview while keeping it warm when possible
   *
   * @param command - Shared deactivate command
   *
   * @returns Web execution result
   */
  private deactivatePreviewSession(
    command: MediaExecutionCommand,
  ): MediaExecutionResult {
    const previewRuntimeSession: ManagedPreviewRuntimeSession | null =
      this.findPreviewRuntimeSession(
        command.session?.sessionId ?? null,
        command,
      );

    if (previewRuntimeSession === null) {
      return this.createResult(
        "inactive",
        command.runtimeSessionHandle,
        null,
        null,
      );
    }

    previewRuntimeSession.videoElement?.pause();
    this.detachPreviewSurface(previewRuntimeSession);
    previewRuntimeSession.state =
      previewRuntimeSession.videoElement !== null &&
      previewRuntimeSession.sourceId !== null
        ? "ready-first-frame"
        : "inactive";

    return this.createResult(
      previewRuntimeSession.state,
      previewRuntimeSession.runtimeSessionHandle,
      null,
      null,
      null,
      null,
      previewRuntimeSession.customDecodeSnapshot,
      previewRuntimeSession.rendererSnapshot,
    );
  }

  /**
   * @brief Mark the background runtime slot as no longer current
   *
   * @param command - Shared deactivate command
   *
   * @returns Web execution result
   */
  private deactivateBackgroundSession(
    command: MediaExecutionCommand,
  ): MediaExecutionResult {
    if (
      this.backgroundRuntimeSession.plannedSessionId !==
      (command.session?.sessionId ?? null)
    ) {
      return this.createResult(
        "inactive",
        this.backgroundRuntimeSession.runtimeSessionHandle,
        null,
        null,
      );
    }

    this.backgroundRuntimeSession.state = "inactive";

    return this.createResult(
      "inactive",
      this.backgroundRuntimeSession.runtimeSessionHandle,
      null,
      null,
    );
  }

  /**
   * @brief Tear preview resources down when an obsolete session is disposed
   *
   * @param command - Shared dispose command
   *
   * @returns Web execution result
   */
  private async disposePreviewSession(
    command: MediaExecutionCommand,
  ): Promise<MediaExecutionResult> {
    const previewRuntimeSession: ManagedPreviewRuntimeSession | null =
      this.findPreviewRuntimeSession(
        command.session?.sessionId ?? null,
        command,
      );

    if (previewRuntimeSession === null) {
      return this.createResult(
        "inactive",
        command.runtimeSessionHandle,
        null,
        null,
      );
    }

    await this.resetPreviewRuntimeSession(previewRuntimeSession);
    previewRuntimeSession.state = "disposed";

    return this.createResult(
      "disposed",
      previewRuntimeSession.runtimeSessionHandle,
      null,
      null,
      null,
      null,
      previewRuntimeSession.customDecodeSnapshot,
      previewRuntimeSession.rendererSnapshot,
    );
  }

  /**
   * @brief Mark the background slot as disposed without changing playback state
   *
   * @param command - Shared dispose command
   *
   * @returns Web execution result
   */
  private disposeBackgroundSession(
    command: MediaExecutionCommand,
  ): MediaExecutionResult {
    if (
      this.backgroundRuntimeSession.plannedSessionId !==
      (command.session?.sessionId ?? null)
    ) {
      return this.createResult(
        "inactive",
        this.backgroundRuntimeSession.runtimeSessionHandle,
        null,
        null,
      );
    }

    this.backgroundRuntimeSession.plannedSessionId = null;
    this.backgroundRuntimeSession.itemId = null;
    this.backgroundRuntimeSession.state = "disposed";

    return this.createResult(
      "disposed",
      this.backgroundRuntimeSession.runtimeSessionHandle,
      null,
      null,
    );
  }

  /**
   * @brief Resolve the actual committed background lane supported by the browser
   *
   * @param command - Shared activate command carrying the chosen decision
   *
   * @returns Runtime-adjusted committed playback decision, or `null` when absent
   */
  private resolveCommittedPlaybackDecision(
    command: MediaExecutionCommand,
  ): CommittedPlaybackDecision | null {
    const committedPlaybackDecision: CommittedPlaybackDecision | null =
      command.committedPlaybackDecision;
    const sourceDescriptor: MediaSourceDescriptor | null =
      command.session?.source ?? null;

    if (
      committedPlaybackDecision === null ||
      sourceDescriptor === null ||
      committedPlaybackDecision.chosenLane !== "native"
    ) {
      return committedPlaybackDecision;
    }

    const videoElement: HTMLVideoElement = document.createElement("video");
    const playbackMimeType: string =
      sourceDescriptor.mimeType ?? "application/x-mpegURL";
    const canUseNativeHlsPlayback: boolean =
      videoElement.canPlayType(playbackMimeType) !== "";

    if (canUseNativeHlsPlayback) {
      return committedPlaybackDecision;
    }

    if (!committedPlaybackDecision.fallbackOrder.includes("shaka")) {
      return committedPlaybackDecision;
    }

    return {
      ...committedPlaybackDecision,
      chosenLane: "shaka",
      reasons: committedPlaybackDecision.reasons.includes(
        "fallback-from-preferred-lane",
      )
        ? [...committedPlaybackDecision.reasons]
        : [
            ...committedPlaybackDecision.reasons,
            "fallback-from-preferred-lane",
          ],
      reasonDetails: [
        ...committedPlaybackDecision.reasonDetails,
        "Browser-native playback was unavailable for this source, so the web runtime fell back to Shaka.",
      ],
      usedPreferredLane: false,
      usedFallbackLane: true,
    };
  }

  /**
   * @brief Build one cached web inventory result for the requested source
   *
   * @param request - Shared inventory lookup request
   *
   * @returns Best available inventory result for the source
   */
  private async buildInventoryResult(
    request: MediaInventoryRequest,
  ): Promise<MediaInventoryResult> {
    const sourceDescriptor: MediaSourceDescriptor | null =
      request.sourceDescriptor;

    if (sourceDescriptor === null) {
      return {
        supportLevel: "unsupported",
        snapshot: {
          sourceId: null,
          supportLevel: "unsupported",
          inventorySource: "unavailable",
          selectionReason: "inventory-unsupported",
          inventory: null,
          notes: ["Web inventory lookup had no source descriptor to inspect."],
        },
        failureReason:
          "Web inventory lookup had no source descriptor to inspect.",
      };
    }

    const playbackMimeType: string =
      sourceDescriptor.mimeType ?? "application/x-mpegURL";
    const probeVideoElement: HTMLVideoElement = document.createElement("video");
    const canUseNativeHlsPlayback: boolean =
      probeVideoElement.canPlayType(playbackMimeType) !== "";

    try {
      return await this.probeShakaInventory(
        sourceDescriptor,
        canUseNativeHlsPlayback,
      );
    } catch (error: unknown) {
      const failureReason: string = this.describeRuntimeError(
        error,
        "Web inventory probing fell back from the adaptive runtime path.",
      );

      if (canUseNativeHlsPlayback) {
        return this.createNativePartialInventoryResult(
          sourceDescriptor,
          failureReason,
        );
      }

      return {
        supportLevel: "unsupported",
        snapshot: {
          sourceId: sourceDescriptor.sourceId,
          supportLevel: "unsupported",
          inventorySource: "unavailable",
          selectionReason: "inventory-probe-failed",
          inventory: null,
          notes: [failureReason],
        },
        failureReason,
      };
    }
  }

  /**
   * @brief Probe one source through Shaka to expose real manifest inventory
   *
   * @param sourceDescriptor - Shared source descriptor being inspected
   * @param canUseNativeHlsPlayback - Whether the browser can use its native path
   *
   * @returns Full manifest-backed inventory result
   */
  private async probeShakaInventory(
    sourceDescriptor: MediaSourceDescriptor,
    canUseNativeHlsPlayback: boolean,
  ): Promise<MediaInventoryResult> {
    const shakaModule: { default: ShakaModule } =
      await import("shaka-player/dist/shaka-player.compiled.js");
    const shaka: ShakaModule = shakaModule.default;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      if (canUseNativeHlsPlayback) {
        return this.createNativePartialInventoryResult(
          sourceDescriptor,
          "Shaka inventory probing was unavailable, so the web shell reported native-only partial inventory.",
        );
      }

      return {
        supportLevel: "unsupported",
        snapshot: {
          sourceId: sourceDescriptor.sourceId,
          supportLevel: "unsupported",
          inventorySource: "unavailable",
          selectionReason: "inventory-unsupported",
          inventory: null,
          notes: [
            "Shaka is unsupported in this browser for inventory probing.",
          ],
        },
        failureReason:
          "Shaka is unsupported in this browser for inventory probing.",
      };
    }

    const probeVideoElement: HTMLVideoElement = document.createElement("video");
    const shakaPlayer: ShakaInventoryPlayer = new shaka.Player(
      probeVideoElement,
    ) as unknown as ShakaInventoryPlayer;

    try {
      await shakaPlayer.load(sourceDescriptor.url);
      const variantTracks: ShakaTrack[] = shakaPlayer.getVariantTracks();
      const audioTracks: ShakaTrack[] = shakaPlayer.getAudioTracks();
      const textTracks: ShakaTextTrack[] = shakaPlayer.getTextTracks();

      return {
        supportLevel: "full",
        snapshot: {
          sourceId: sourceDescriptor.sourceId,
          supportLevel: "full",
          inventorySource: "adaptive-runtime",
          selectionReason: "inventory-full",
          inventory: {
            sourceId: sourceDescriptor.sourceId,
            inventorySource: "adaptive-runtime",
            variants: this.createNormalizedVariantInfos(variantTracks),
            audioTracks: this.createNormalizedAudioTrackInfos(audioTracks),
            textTracks: this.createNormalizedTextTrackInfos(textTracks),
          },
          notes: [
            "Web inventory used a Shaka-backed manifest probe for committed playback.",
            `Manifest probe resolved ${variantTracks.length} variant entries, ${audioTracks.length} audio entries, and ${textTracks.length} text entries before normalization.`,
          ],
        },
        failureReason: null,
      };
    } finally {
      await shakaPlayer.destroy();
    }
  }

  /**
   * @brief Create the native-only partial inventory result used as a safe fallback
   *
   * @param sourceDescriptor - Shared source descriptor being inspected
   * @param note - Human-readable fallback note
   *
   * @returns Partial native inventory result
   */
  private createNativePartialInventoryResult(
    sourceDescriptor: MediaSourceDescriptor,
    note: string,
  ): MediaInventoryResult {
    return {
      supportLevel: "partial",
      snapshot: {
        sourceId: sourceDescriptor.sourceId,
        supportLevel: "partial",
        inventorySource: "native-runtime",
        selectionReason: "inventory-partial",
        inventory: {
          sourceId: sourceDescriptor.sourceId,
          inventorySource: "native-runtime",
          variants: [],
          audioTracks: [],
          textTracks: [],
        },
        notes: [
          "Browser-native playback exposed only partial inventory before committed playback started.",
          note,
        ],
      },
      failureReason: null,
    };
  }

  /**
   * @brief Normalize Shaka variant tracks into a stable shared inventory list
   *
   * @param variantTracks - Variant tracks reported by Shaka
   *
   * @returns Deduplicated and sorted shared variant metadata
   */
  private createNormalizedVariantInfos(
    variantTracks: ShakaTrack[],
  ): MediaVariantInfo[] {
    const variantInfosById: Map<string, MediaVariantInfo> = new Map<
      string,
      MediaVariantInfo
    >();

    for (const variantTrack of variantTracks) {
      const nextVariantInfo: MediaVariantInfo =
        this.createVariantInfo(variantTrack);
      const previousVariantInfo: MediaVariantInfo | undefined =
        variantInfosById.get(nextVariantInfo.id);

      if (previousVariantInfo === undefined) {
        variantInfosById.set(nextVariantInfo.id, nextVariantInfo);
        continue;
      }

      variantInfosById.set(
        nextVariantInfo.id,
        this.mergeVariantInfos(previousVariantInfo, nextVariantInfo),
      );
    }

    return [...variantInfosById.values()].sort(
      (
        leftVariantInfo: MediaVariantInfo,
        rightVariantInfo: MediaVariantInfo,
      ): number =>
        this.scoreVariantInfo(rightVariantInfo) -
        this.scoreVariantInfo(leftVariantInfo),
    );
  }

  /**
   * @brief Normalize Shaka audio tracks into a stable shared inventory list
   *
   * @param audioTracks - Audio tracks reported by Shaka
   *
   * @returns Deduplicated and sorted shared audio-track metadata
   */
  private createNormalizedAudioTrackInfos(
    audioTracks: ShakaTrack[],
  ): MediaAudioTrackInfo[] {
    const audioTrackInfosById: Map<string, MediaAudioTrackInfo> = new Map<
      string,
      MediaAudioTrackInfo
    >();

    for (const audioTrack of audioTracks) {
      const nextAudioTrackInfo: MediaAudioTrackInfo =
        this.createAudioTrackInfo(audioTrack);
      const previousAudioTrackInfo: MediaAudioTrackInfo | undefined =
        audioTrackInfosById.get(nextAudioTrackInfo.id);

      if (previousAudioTrackInfo === undefined) {
        audioTrackInfosById.set(nextAudioTrackInfo.id, nextAudioTrackInfo);
        continue;
      }

      audioTrackInfosById.set(
        nextAudioTrackInfo.id,
        this.mergeAudioTrackInfos(previousAudioTrackInfo, nextAudioTrackInfo),
      );
    }

    return [...audioTrackInfosById.values()].sort(
      (
        leftAudioTrackInfo: MediaAudioTrackInfo,
        rightAudioTrackInfo: MediaAudioTrackInfo,
      ): number =>
        this.scoreAudioTrackInfo(rightAudioTrackInfo) -
        this.scoreAudioTrackInfo(leftAudioTrackInfo),
    );
  }

  /**
   * @brief Normalize Shaka text tracks into a stable shared inventory list
   *
   * @param textTracks - Text tracks reported by Shaka
   *
   * @returns Deduplicated and sorted shared text-track metadata
   */
  private createNormalizedTextTrackInfos(
    textTracks: ShakaTextTrack[],
  ): MediaTextTrackInfo[] {
    const textTrackInfosById: Map<string, MediaTextTrackInfo> = new Map<
      string,
      MediaTextTrackInfo
    >();

    for (const textTrack of textTracks) {
      const nextTextTrackInfo: MediaTextTrackInfo =
        this.createTextTrackInfo(textTrack);
      const previousTextTrackInfo: MediaTextTrackInfo | undefined =
        textTrackInfosById.get(nextTextTrackInfo.id);

      if (previousTextTrackInfo === undefined) {
        textTrackInfosById.set(nextTextTrackInfo.id, nextTextTrackInfo);
        continue;
      }

      textTrackInfosById.set(
        nextTextTrackInfo.id,
        this.mergeTextTrackInfos(previousTextTrackInfo, nextTextTrackInfo),
      );
    }

    return [...textTrackInfosById.values()].sort(
      (
        leftTextTrackInfo: MediaTextTrackInfo,
        rightTextTrackInfo: MediaTextTrackInfo,
      ): number =>
        Number(rightTextTrackInfo.isDefault) -
          Number(leftTextTrackInfo.isDefault) ||
        (leftTextTrackInfo.language ?? "").localeCompare(
          rightTextTrackInfo.language ?? "",
        ) ||
        leftTextTrackInfo.id.localeCompare(rightTextTrackInfo.id),
    );
  }

  /**
   * @brief Merge two variant entries with the same stable identifier
   *
   * @param previousVariantInfo - Previously collected variant metadata
   * @param nextVariantInfo - Newly collected variant metadata
   *
   * @returns Merged variant metadata
   */
  private mergeVariantInfos(
    previousVariantInfo: MediaVariantInfo,
    nextVariantInfo: MediaVariantInfo,
  ): MediaVariantInfo {
    return {
      id: nextVariantInfo.id,
      width: this.selectGreaterNumber(
        previousVariantInfo.width,
        nextVariantInfo.width,
      ),
      height: this.selectGreaterNumber(
        previousVariantInfo.height,
        nextVariantInfo.height,
      ),
      bitrate: this.selectGreaterNumber(
        previousVariantInfo.bitrate,
        nextVariantInfo.bitrate,
      ),
      codec: previousVariantInfo.codec ?? nextVariantInfo.codec,
      frameRate: this.selectGreaterNumber(
        previousVariantInfo.frameRate,
        nextVariantInfo.frameRate,
      ),
      isDefault: previousVariantInfo.isDefault || nextVariantInfo.isDefault,
      isPremiumCandidate:
        previousVariantInfo.isPremiumCandidate ||
        nextVariantInfo.isPremiumCandidate,
    };
  }

  /**
   * @brief Merge two audio-track entries with the same stable identifier
   *
   * @param previousAudioTrackInfo - Previously collected audio-track metadata
   * @param nextAudioTrackInfo - Newly collected audio-track metadata
   *
   * @returns Merged audio-track metadata
   */
  private mergeAudioTrackInfos(
    previousAudioTrackInfo: MediaAudioTrackInfo,
    nextAudioTrackInfo: MediaAudioTrackInfo,
  ): MediaAudioTrackInfo {
    return {
      id: nextAudioTrackInfo.id,
      language: previousAudioTrackInfo.language ?? nextAudioTrackInfo.language,
      channelLayout:
        previousAudioTrackInfo.channelLayout ??
        nextAudioTrackInfo.channelLayout,
      channelCount: this.selectGreaterNumber(
        previousAudioTrackInfo.channelCount,
        nextAudioTrackInfo.channelCount,
      ),
      codec: previousAudioTrackInfo.codec ?? nextAudioTrackInfo.codec,
      isDefault:
        previousAudioTrackInfo.isDefault || nextAudioTrackInfo.isDefault,
      isPremiumCandidate:
        previousAudioTrackInfo.isPremiumCandidate ||
        nextAudioTrackInfo.isPremiumCandidate,
    };
  }

  /**
   * @brief Merge two text-track entries with the same stable identifier
   *
   * @param previousTextTrackInfo - Previously collected text-track metadata
   * @param nextTextTrackInfo - Newly collected text-track metadata
   *
   * @returns Merged text-track metadata
   */
  private mergeTextTrackInfos(
    previousTextTrackInfo: MediaTextTrackInfo,
    nextTextTrackInfo: MediaTextTrackInfo,
  ): MediaTextTrackInfo {
    return {
      id: nextTextTrackInfo.id,
      language: previousTextTrackInfo.language ?? nextTextTrackInfo.language,
      kind: previousTextTrackInfo.kind ?? nextTextTrackInfo.kind,
      label: previousTextTrackInfo.label ?? nextTextTrackInfo.label,
      codec: previousTextTrackInfo.codec ?? nextTextTrackInfo.codec,
      isDefault: previousTextTrackInfo.isDefault || nextTextTrackInfo.isDefault,
    };
  }

  /**
   * @brief Score one variant entry for stable inventory ordering
   *
   * @param variantInfo - Shared variant metadata being ranked
   *
   * @returns Relative score where higher values are listed first
   */
  private scoreVariantInfo(variantInfo: MediaVariantInfo): number {
    const width: number = variantInfo.width ?? 0;
    const height: number = variantInfo.height ?? 0;
    const bitrate: number = variantInfo.bitrate ?? 0;
    const frameRate: number = variantInfo.frameRate ?? 0;
    const resolutionScore: number = width * height;
    const defaultScore: number = variantInfo.isDefault ? 50 : 0;
    const premiumScore: number = variantInfo.isPremiumCandidate ? 100 : 0;

    return resolutionScore + bitrate + frameRate + defaultScore + premiumScore;
  }

  /**
   * @brief Score one audio-track entry for stable inventory ordering
   *
   * @param audioTrackInfo - Shared audio-track metadata being ranked
   *
   * @returns Relative score where higher values are listed first
   */
  private scoreAudioTrackInfo(audioTrackInfo: MediaAudioTrackInfo): number {
    const defaultScore: number = audioTrackInfo.isDefault ? 100 : 0;
    const premiumScore: number = audioTrackInfo.isPremiumCandidate ? 50 : 0;
    const channelCountScore: number = audioTrackInfo.channelCount ?? 0;

    return defaultScore + premiumScore + channelCountScore;
  }

  /**
   * @brief Pick the richer numeric metadata value when merging two entries
   *
   * @param previousValue - Previously collected numeric metadata
   * @param nextValue - Newly collected numeric metadata
   *
   * @returns Greater numeric value, or whichever side was populated
   */
  private selectGreaterNumber(
    previousValue: number | null,
    nextValue: number | null,
  ): number | null {
    if (previousValue === null) {
      return nextValue;
    }

    if (nextValue === null) {
      return previousValue;
    }

    return Math.max(previousValue, nextValue);
  }

  /**
   * @brief Convert one Shaka variant track into the shared inventory domain model
   *
   * @param variantTrack - Shaka variant track
   *
   * @returns Shared variant metadata
   */
  private createVariantInfo(variantTrack: ShakaTrack): MediaVariantInfo {
    return {
      id: `variant-${variantTrack.id}`,
      width: variantTrack.width,
      height: variantTrack.height,
      bitrate:
        variantTrack.videoBandwidth ??
        (variantTrack.bandwidth > 0 ? variantTrack.bandwidth : null),
      codec: variantTrack.videoCodec ?? variantTrack.codecs ?? null,
      frameRate: variantTrack.frameRate,
      isDefault: variantTrack.primary || variantTrack.active,
      isPremiumCandidate: this.isPremiumVariantCandidate(variantTrack),
    };
  }

  /**
   * @brief Convert one Shaka audio track into the shared inventory domain model
   *
   * @param audioTrack - Shaka audio track
   *
   * @returns Shared audio-track metadata
   */
  private createAudioTrackInfo(audioTrack: ShakaTrack): MediaAudioTrackInfo {
    return {
      id: `audio-${audioTrack.id}`,
      language: audioTrack.language || null,
      channelLayout: this.describeChannelLayout(audioTrack.channelsCount),
      channelCount: audioTrack.channelsCount,
      codec: audioTrack.audioCodec ?? audioTrack.codecs ?? null,
      isDefault: audioTrack.primary || audioTrack.active,
      isPremiumCandidate: this.isPremiumAudioCandidate(audioTrack),
    };
  }

  /**
   * @brief Convert one Shaka text track into the shared inventory domain model
   *
   * @param textTrack - Shaka text track
   *
   * @returns Shared text-track metadata
   */
  private createTextTrackInfo(textTrack: ShakaTextTrack): MediaTextTrackInfo {
    return {
      id: `text-${textTrack.id}`,
      language: textTrack.language || null,
      kind: textTrack.kind,
      label: textTrack.label,
      codec: textTrack.codecs ?? null,
      isDefault: textTrack.primary || textTrack.active,
    };
  }

  /**
   * @brief Determine whether one variant should be treated as premium-capable
   *
   * @param variantTrack - Shaka variant track
   *
   * @returns `true` when the track looks like a premium candidate
   */
  private isPremiumVariantCandidate(variantTrack: ShakaTrack): boolean {
    const width: number = variantTrack.width ?? 0;
    const height: number = variantTrack.height ?? 0;
    const bitrate: number =
      variantTrack.videoBandwidth ?? variantTrack.bandwidth ?? 0;
    const codec: string = (
      variantTrack.videoCodec ??
      variantTrack.codecs ??
      ""
    ).toLowerCase();

    return (
      width >= 2560 ||
      height >= 1440 ||
      bitrate >= 12000000 ||
      codec.includes("hvc1") ||
      codec.includes("hev1") ||
      codec.includes("dvhe") ||
      codec.includes("av01")
    );
  }

  /**
   * @brief Determine whether one audio track should be treated as premium-capable
   *
   * @param audioTrack - Shaka audio track
   *
   * @returns `true` when the track looks like a premium candidate
   */
  private isPremiumAudioCandidate(audioTrack: ShakaTrack): boolean {
    const codec: string = (
      audioTrack.audioCodec ??
      audioTrack.codecs ??
      ""
    ).toLowerCase();
    const channelCount: number = audioTrack.channelsCount ?? 0;

    return (
      channelCount > 2 ||
      audioTrack.spatialAudio === true ||
      codec.includes("ec-3") ||
      codec.includes("ac-4") ||
      codec.includes("atmos")
    );
  }

  /**
   * @brief Convert a numeric channel count into a conservative layout label
   *
   * @param channelCount - Audio channel count reported by the runtime
   *
   * @returns Shared channel-layout label, or `null` when unavailable
   */
  private describeChannelLayout(channelCount: number | null): string | null {
    if (channelCount === null) {
      return null;
    }

    switch (channelCount) {
      case 1:
        return "1.0";
      case 2:
        return "2.0";
      case 6:
        return "5.1";
      case 8:
        return "7.1";
      default:
        return `${channelCount}.0`;
    }
  }

  /**
   * @brief Create the fixed preview pool used by the web runtime
   *
   * @returns Stable preview slot array
   */
  private createPreviewRuntimeSessions(): ManagedPreviewRuntimeSession[] {
    const previewRuntimeSessions: ManagedPreviewRuntimeSession[] = [];

    for (
      let previewSlotIndex: number = 0;
      previewSlotIndex < WebMediaRuntimeAdapter.PREVIEW_POOL_SIZE;
      previewSlotIndex += 1
    ) {
      previewRuntimeSessions.push({
        runtimeSessionHandle: {
          handleId: `preview-slot-${previewSlotIndex}`,
          runtimeId: this.runtimeId,
        },
        plannedSessionId: null,
        itemId: null,
        sourceId: null,
        state: "inactive",
        customDecodeSnapshot: null,
        previewRendererRouter: null,
        rendererSnapshot: null,
        hostElement: null,
        videoElement: null,
        shakaPlayer: null,
      });
    }

    return previewRuntimeSessions;
  }

  /**
   * @brief Reuse or allocate one preview slot for the requested logical session
   *
   * @param command - Shared warm command
   * @param plannedSession - Preview session that should own the slot
   *
   * @returns Matched preview slot, or `null` when no slot is available
   */
  private resolvePreviewRuntimeSession(
    command: MediaExecutionCommand,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
  ): ManagedPreviewRuntimeSession | null {
    const previewFarmAssignment: PreviewSessionAssignment | null =
      this.resolvePreviewFarmAssignment(command, plannedSession.sessionId);
    const previewRuntimeSessionByAssignedSlot:
      | ManagedPreviewRuntimeSession
      | undefined =
      previewFarmAssignment === null
        ? undefined
        : this.previewRuntimeSessions.find(
            (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
              previewRuntimeSession.runtimeSessionHandle.handleId ===
              previewFarmAssignment.slotId,
          );

    if (previewRuntimeSessionByAssignedSlot !== undefined) {
      return previewRuntimeSessionByAssignedSlot;
    }

    const existingPreviewRuntimeSession: ManagedPreviewRuntimeSession | null =
      this.findPreviewRuntimeSession(plannedSession.sessionId, command);

    if (existingPreviewRuntimeSession !== null) {
      return existingPreviewRuntimeSession;
    }

    const reusablePreviewRuntimeSession:
      | ManagedPreviewRuntimeSession
      | undefined = this.previewRuntimeSessions.find(
      (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
        previewRuntimeSession.plannedSessionId === null ||
        previewRuntimeSession.state === "inactive" ||
        previewRuntimeSession.state === "disposed",
    );

    if (reusablePreviewRuntimeSession !== undefined) {
      return reusablePreviewRuntimeSession;
    }

    const plannedPreviewSessionIds: Set<string> = new Set<string>(
      command.plan.sessions
        .filter((planSession): boolean => planSession.role === "preview")
        .map((planSession): string => planSession.sessionId),
    );
    const stalePreviewRuntimeSession: ManagedPreviewRuntimeSession | undefined =
      this.previewRuntimeSessions.find(
        (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
          previewRuntimeSession.plannedSessionId !== null &&
          !plannedPreviewSessionIds.has(previewRuntimeSession.plannedSessionId),
      );

    if (stalePreviewRuntimeSession !== undefined) {
      return stalePreviewRuntimeSession;
    }

    const hiddenPreviewRuntimeSession:
      | ManagedPreviewRuntimeSession
      | undefined = this.previewRuntimeSessions.find(
      (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
        previewRuntimeSession.state !== "preview-active",
    );

    return hiddenPreviewRuntimeSession ?? null;
  }

  /**
   * @brief Resolve one preview slot by session ID or runtime handle
   *
   * @param sessionId - Planned preview session identifier
   * @param command - Shared command that may carry the runtime handle
   *
   * @returns Matching preview slot, or `null` when none exists
   */
  private findPreviewRuntimeSession(
    sessionId: string | null,
    command: MediaExecutionCommand,
  ): ManagedPreviewRuntimeSession | null {
    if (sessionId !== null) {
      const previewFarmAssignment: PreviewSessionAssignment | null =
        this.resolvePreviewFarmAssignment(command, sessionId);

      if (previewFarmAssignment !== null) {
        const previewRuntimeSessionByAssignedSlot:
          | ManagedPreviewRuntimeSession
          | undefined = this.previewRuntimeSessions.find(
          (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
            previewRuntimeSession.runtimeSessionHandle.handleId ===
            previewFarmAssignment.slotId,
        );

        if (previewRuntimeSessionByAssignedSlot !== undefined) {
          return previewRuntimeSessionByAssignedSlot;
        }
      }
    }

    const runtimeHandleId: string | null =
      command.runtimeSessionHandle?.handleId ?? null;

    if (runtimeHandleId !== null) {
      const previewRuntimeSessionByHandle:
        | ManagedPreviewRuntimeSession
        | undefined = this.previewRuntimeSessions.find(
        (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
          previewRuntimeSession.runtimeSessionHandle.handleId ===
          runtimeHandleId,
      );

      if (previewRuntimeSessionByHandle !== undefined) {
        return previewRuntimeSessionByHandle;
      }
    }

    if (sessionId === null) {
      return null;
    }

    const previewRuntimeSessionBySessionId:
      | ManagedPreviewRuntimeSession
      | undefined = this.previewRuntimeSessions.find(
      (previewRuntimeSession: ManagedPreviewRuntimeSession): boolean =>
        previewRuntimeSession.plannedSessionId === sessionId,
    );

    return previewRuntimeSessionBySessionId ?? null;
  }

  /**
   * @brief Resolve one shared preview-farm assignment for the current session
   *
   * @param command - Shared command carrying the current farm snapshot
   * @param sessionId - Preview session being resolved
   *
   * @returns Shared preview-farm assignment, or `null` when absent
   */
  private resolvePreviewFarmAssignment(
    command: MediaExecutionCommand,
    sessionId: string,
  ): PreviewSessionAssignment | null {
    const previewFarmAssignment: PreviewSessionAssignment | undefined =
      command.plan.previewFarm.sessionAssignments.find(
        (candidatePreviewFarmAssignment: PreviewSessionAssignment): boolean =>
          candidatePreviewFarmAssignment.sessionId === sessionId,
      );

    return previewFarmAssignment ?? null;
  }

  /**
   * @brief Resolve one shared preview-farm decision for the current session
   *
   * @param command - Shared command carrying the current farm snapshot
   * @param sessionId - Preview session being resolved
   *
   * @returns Shared preview-farm decision, or `null` when absent
   */
  private resolvePreviewFarmDecision(
    command: MediaExecutionCommand,
    sessionId: string,
  ): PreviewSchedulerDecision | null {
    const previewFarmDecision: PreviewSchedulerDecision | undefined =
      command.plan.previewFarm.decisions.find(
        (candidatePreviewFarmDecision: PreviewSchedulerDecision): boolean =>
          candidatePreviewFarmDecision.sessionId === sessionId,
      );

    return previewFarmDecision ?? null;
  }

  /**
   * @brief Prepare one preview slot for a new logical owner
   *
   * @param previewRuntimeSession - Preview slot being reused
   * @param plannedSession - Preview session that should own the slot
   */
  private async preparePreviewSessionForReuse(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
  ): Promise<void> {
    if (
      previewRuntimeSession.plannedSessionId === plannedSession.sessionId &&
      previewRuntimeSession.sourceId === plannedSession.source?.sourceId
    ) {
      return;
    }

    await this.resetPreviewRuntimeSession(previewRuntimeSession);
    previewRuntimeSession.plannedSessionId = plannedSession.sessionId;
    previewRuntimeSession.itemId = plannedSession.itemId;
    previewRuntimeSession.sourceId = plannedSession.source?.sourceId ?? null;
    previewRuntimeSession.state = "warming-first-frame";
  }

  /**
   * @brief Reset one preview slot back to an unowned state
   *
   * @param previewRuntimeSession - Preview slot being cleared
   */
  private async resetPreviewRuntimeSession(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): Promise<void> {
    previewRuntimeSession.videoElement?.pause();
    previewRuntimeSession.previewRendererRouter?.detach();
    this.detachPreviewSurface(previewRuntimeSession);
    await previewRuntimeSession.previewRendererRouter?.destroy();
    await this.destroyPreviewShakaPlayer(previewRuntimeSession);

    if (previewRuntimeSession.videoElement !== null) {
      this.clearVideoElementSource(previewRuntimeSession.videoElement);
    }

    previewRuntimeSession.plannedSessionId = null;
    previewRuntimeSession.itemId = null;
    previewRuntimeSession.sourceId = null;
    previewRuntimeSession.state = "inactive";
    previewRuntimeSession.customDecodeSnapshot = null;
    previewRuntimeSession.previewRendererRouter = null;
    previewRuntimeSession.rendererSnapshot = null;
  }

  /**
   * @brief Load the preview source and wait until the first frame is ready
   *
   * @param previewRuntimeSession - Preview slot receiving the source
   * @param plannedSession - Planned preview session carrying lane hints
   */
  private async loadPreviewSource(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
  ): Promise<void> {
    const sourceDescriptor: MediaSourceDescriptor | null =
      plannedSession.source;
    const videoElement: HTMLVideoElement = this.ensurePreviewVideoElement(
      previewRuntimeSession,
    );
    const orderedLaneHints: MediaPlaybackLane[] = [
      plannedSession.desiredPlaybackLane,
      ...plannedSession.fallbackPlaybackLaneOrder,
    ].filter(
      (lane: MediaPlaybackLane | null): lane is MediaPlaybackLane =>
        lane !== null,
    );

    if (sourceDescriptor === null) {
      throw new Error("Web preview warm requires a source descriptor.");
    }

    const playbackMimeType: string =
      sourceDescriptor.mimeType ?? "application/x-mpegURL";
    const canUseNativeHlsPlayback: boolean =
      videoElement.canPlayType(playbackMimeType) !== "";
    const prefersShaka: boolean = orderedLaneHints[0] === "shaka";
    const readyForFirstFramePromise: Promise<void> =
      this.waitForLoadedData(videoElement);

    videoElement.poster = sourceDescriptor.posterUrl ?? "";

    if (canUseNativeHlsPlayback && !prefersShaka) {
      videoElement.src = sourceDescriptor.url;
      videoElement.load();
      await readyForFirstFramePromise;
      return;
    }

    const shakaModule: { default: ShakaModule } =
      await import("shaka-player/dist/shaka-player.compiled.js");
    const shaka: ShakaModule = shakaModule.default;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      if (canUseNativeHlsPlayback) {
        videoElement.src = sourceDescriptor.url;
        videoElement.load();
        await readyForFirstFramePromise;
        return;
      }

      throw new Error("Shaka Player is not supported in this browser.");
    }

    const shakaPlayer: ShakaPlayer = new shaka.Player(videoElement);

    previewRuntimeSession.shakaPlayer = shakaPlayer;
    await shakaPlayer.load(sourceDescriptor.url);
    await readyForFirstFramePromise;
  }

  /**
   * @brief Attempt the preview custom decode warm path without replacing preview playback
   *
   * @param plannedSession - Planned preview session carrying the custom decode decision
   *
   * @returns Inspectable custom decode snapshot for the preview slot
   */
  private async tryWarmPreviewCustomDecode(
    command: MediaExecutionCommand,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): Promise<CustomDecodeSnapshot | null> {
    const customDecodeDecision = plannedSession.customDecodeDecision;
    const customDecodeCapability =
      plannedSession.capabilitySnapshot?.customDecodeCapability ?? null;

    if (customDecodeDecision === null || customDecodeCapability === null) {
      return null;
    }

    if (!customDecodeDecision.shouldAttempt || plannedSession.source === null) {
      return this.createPreviewCustomDecodeSnapshot(
        customDecodeCapability,
        customDecodeDecision,
        customDecodeDecision.shouldAttempt ? "failed" : "unsupported",
        false,
        true,
        customDecodeDecision.fallbackReason ??
          "Preview warm stayed on the existing preview path.",
        null,
      );
    }

    const customDecodeSessionAdapter: WebCustomDecodeSessionAdapter =
      new WebCustomDecodeSessionAdapter(this.vfsController);

    try {
      const customDecodeSnapshot: CustomDecodeSnapshot =
        await customDecodeSessionAdapter.open(
          plannedSession.source,
          customDecodeCapability,
          customDecodeDecision,
        );

      if (
        !customDecodeSnapshot.usedCustomDecode ||
        customDecodeSnapshot.state !== "first-frame-ready"
      ) {
        return {
          ...this.cloneCustomDecodeSnapshot(customDecodeSnapshot)!,
          renderer: this.createPreviewRendererFallbackSnapshot(
            plannedSession,
            "preview-warm",
            customDecodeSnapshot.fallbackReason ??
              "Preview warm stayed on the existing preview path.",
            [],
            customDecodeSnapshot.selectedFrame === null
              ? null
              : {
                  representation:
                    customDecodeSnapshot.selectedFrame.representation,
                  origin: "custom-decode",
                  width: customDecodeSnapshot.selectedFrame.width,
                  height: customDecodeSnapshot.selectedFrame.height,
                  frameTimeMs: customDecodeSnapshot.selectedFrame.frameTimeMs,
                },
          ),
        };
      }

      const frameResult: Awaited<
        ReturnType<WebCustomDecodeSessionAdapter["captureFrameAtTimeMs"]>
      > = await customDecodeSessionAdapter.captureFrameAtTimeMs(0);
      const rendererSnapshot: RendererSnapshot =
        await this.tryRoutePreviewWarmFrame(
          command,
          plannedSession,
          previewRuntimeSession,
          frameResult.bitmap,
          {
            representation: frameResult.frameHandle.representation,
            origin: "custom-decode",
            width: frameResult.frameHandle.width,
            height: frameResult.frameHandle.height,
            frameTimeMs: frameResult.actualFrameTimeMs,
          },
        );

      return {
        ...this.cloneCustomDecodeSnapshot(customDecodeSnapshot)!,
        selectedFrame: {
          representation: frameResult.frameHandle.representation,
          width: frameResult.frameHandle.width,
          height: frameResult.frameHandle.height,
          frameTimeMs: frameResult.actualFrameTimeMs,
        },
        renderer: SharedRendererRouter.cloneSnapshot(rendererSnapshot),
        notes: [
          ...customDecodeSnapshot.notes,
          "Preview warm prepared a renderer-routable first frame for conservative preview handoff.",
        ],
      };
    } finally {
      await customDecodeSessionAdapter.close();
    }
  }

  /**
   * @brief Update a warmed custom decode snapshot when preview playback activates
   *
   * @param customDecodeSnapshot - Existing preview custom decode snapshot
   *
   * @returns Updated snapshot reflecting the active-preview handoff
   */
  private promotePreviewCustomDecodeSnapshot(
    customDecodeSnapshot: CustomDecodeSnapshot | null,
  ): CustomDecodeSnapshot | null {
    if (customDecodeSnapshot === null) {
      return null;
    }

    return {
      ...this.cloneCustomDecodeSnapshot(customDecodeSnapshot)!,
      state: "previewing",
      usedFallback: true,
      fallbackReason:
        customDecodeSnapshot.decision?.fallbackReason ??
        "Preview-active custom decode fell back to the established preview renderer path.",
      notes: [
        ...customDecodeSnapshot.notes,
        "Preview activation kept the existing video renderer while the custom decode lane remained debug-visible.",
      ],
    };
  }

  /**
   * @brief Attempt one routed first-frame presentation for a warmed preview slot
   *
   * @param plannedSession - Planned preview session being warmed
   * @param previewRuntimeSession - Runtime-owned preview slot being prepared
   * @param frameSource - Browser frame source captured from custom decode
   * @param frameHandle - Shared frame metadata for debug consumers
   *
   * @returns Shared renderer snapshot describing the warm-path route
   */
  private async tryRoutePreviewWarmFrame(
    command: MediaExecutionCommand,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
    previewRuntimeSession: ManagedPreviewRuntimeSession,
    frameSource: CanvasImageSource,
    frameHandle: RendererFrameHandle,
  ): Promise<RendererSnapshot> {
    const runtimeGuardrailState: MediaExecutionCommand["plan"]["previewFarm"]["runtimeGuardrailState"] =
      command.plan.previewFarm.runtimeGuardrailState;
    const webRendererRouter: WebRendererRouter = new WebRendererRouter();
    const rendererSnapshot: RendererSnapshot =
      await webRendererRouter.routeFrame({
        capability:
          plannedSession.capabilitySnapshot?.rendererCapability ?? null,
        decision: this.createGuardrailAdjustedRendererDecision(
          plannedSession.capabilitySnapshot?.rendererDecision ?? null,
          runtimeGuardrailState,
        ),
        sessionId: plannedSession.sessionId,
        sessionRole: "preview",
        variantRole: "preview-warm",
        target: "preview-surface",
        frameSource,
        frameHandle,
        hostElement: null,
        legacyFallbackReason:
          "Preview warm stayed on the existing preview video path.",
        notes: [
          "Preview warm attempted renderer routing for the custom-decode first frame.",
        ],
      });

    if (rendererSnapshot.usedLegacyPath) {
      await webRendererRouter.destroy();
      previewRuntimeSession.previewRendererRouter = null;

      return rendererSnapshot;
    }

    await previewRuntimeSession.previewRendererRouter?.destroy();
    previewRuntimeSession.previewRendererRouter = webRendererRouter;

    return rendererSnapshot;
  }

  /**
   * @brief Apply conservative backend suppression to one renderer decision
   *
   * @param rendererDecision - Shared decision chosen by capability planning
   * @param runtimeGuardrailState - Current session-local runtime guardrails
   *
   * @returns Guardrail-adjusted decision
   */
  private createGuardrailAdjustedRendererDecision(
    rendererDecision: RendererDecision | null,
    runtimeGuardrailState: MediaExecutionCommand["plan"]["previewFarm"]["runtimeGuardrailState"],
  ): RendererDecision | null {
    if (rendererDecision === null) {
      return null;
    }

    const preferredBackendOrder: RendererDecision["preferredBackendOrder"] =
      rendererDecision.preferredBackendOrder.filter(
        (
          backendKind: RendererDecision["preferredBackendOrder"][number],
        ): boolean =>
          backendKind === "none" ||
          !runtimeGuardrailState.suppressedRendererBackends.includes(
            backendKind,
          ),
      );
    const selectedBackend: RendererDecision["selectedBackend"] =
      runtimeGuardrailState.preferredRendererBackend !== null &&
      runtimeGuardrailState.preferredRendererBackend !== "legacy" &&
      preferredBackendOrder.includes(
        runtimeGuardrailState.preferredRendererBackend,
      )
        ? runtimeGuardrailState.preferredRendererBackend
        : (preferredBackendOrder.find(
            (
              backendKind: RendererDecision["preferredBackendOrder"][number],
            ): boolean => backendKind !== "none",
          ) ?? null);

    return {
      ...rendererDecision,
      preferredBackendOrder,
      selectedBackend,
      fallbackReason:
        runtimeGuardrailState.preferredRendererBackend === "legacy"
          ? "Runtime guardrails temporarily prefer the legacy preview path."
          : rendererDecision.fallbackReason,
      notes: [...rendererDecision.notes, ...runtimeGuardrailState.notes],
    };
  }

  /**
   * @brief Create one conservative legacy-path snapshot for preview execution
   *
   * @param plannedSession - Planned preview session owning the snapshot
   * @param variantRole - Role variant being reported
   * @param fallbackReason - Human-readable fallback reason
   * @param notes - Extra notes to append to the renderer snapshot
   * @param frameHandle - Optional frame metadata for the routed or bypassed frame
   *
   * @returns Shared renderer snapshot for the preview session
   */
  private createPreviewRendererFallbackSnapshot(
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
    variantRole: "preview-warm" | "preview-active",
    fallbackReason: string,
    notes: string[],
    frameHandle: RendererFrameHandle | null,
  ): RendererSnapshot {
    return SharedRendererRouter.createSnapshot({
      capability: plannedSession.capabilitySnapshot?.rendererCapability ?? null,
      decision: plannedSession.capabilitySnapshot?.rendererDecision ?? null,
      sessionId: plannedSession.sessionId,
      sessionRole: "preview",
      variantRole,
      target: "preview-surface",
      selectedBackend:
        plannedSession.capabilitySnapshot?.rendererDecision.selectedBackend ??
        null,
      activeBackend: null,
      usedLegacyPath: true,
      bypassedRendererRouter:
        plannedSession.capabilitySnapshot?.rendererDecision
          .bypassesRendererRouter ?? false,
      fallbackReason,
      failureReason: null,
      frameHandle,
      notes,
    });
  }

  /**
   * @brief Update a warm renderer snapshot when the active preview returns to video playback
   *
   * @param rendererSnapshot - Existing warm renderer snapshot
   * @param plannedSession - Planned preview session being activated
   *
   * @returns Updated renderer snapshot for the active preview path
   */
  private promotePreviewRendererSnapshot(
    rendererSnapshot: RendererSnapshot | null,
    plannedSession: NonNullable<MediaExecutionCommand["session"]>,
  ): RendererSnapshot {
    return this.createPreviewRendererFallbackSnapshot(
      plannedSession,
      "preview-active",
      "Preview activation deliberately returned to the established HTMLVideoElement preview path after first-frame preparation.",
      rendererSnapshot === null
        ? [
            "Preview activation stayed entirely on the existing preview video path.",
          ]
        : [
            ...rendererSnapshot.notes,
            "Preview activation reused the conservative video playback path after the renderer-router handoff window.",
          ],
      rendererSnapshot?.frameHandle ?? null,
    );
  }

  /**
   * @brief Keep active preview slots attached after browse rerenders
   */
  private syncActivePreviewSurfaces(): void {
    for (const previewRuntimeSession of this.previewRuntimeSessions) {
      if (previewRuntimeSession.state !== "preview-active") {
        continue;
      }

      this.attachPreviewSurface(
        previewRuntimeSession,
        previewRuntimeSession.itemId,
      );
    }
  }

  /**
   * @brief Pause every active preview other than the requested logical session
   *
   * @param sessionId - Preview session that should remain active
   */
  private deactivateOtherActivePreviewSessions(sessionId: string): void {
    for (const previewRuntimeSession of this.previewRuntimeSessions) {
      if (
        previewRuntimeSession.plannedSessionId === sessionId ||
        previewRuntimeSession.state !== "preview-active"
      ) {
        continue;
      }

      previewRuntimeSession.videoElement?.pause();
      this.detachPreviewSurface(previewRuntimeSession);
      this.detachPreviewRendererSurface(previewRuntimeSession);
      previewRuntimeSession.state = "ready-first-frame";
    }
  }

  /**
   * @brief Attach one warmed renderer canvas to the focused preview host when available
   *
   * @param previewRuntimeSession - Preview slot whose renderer canvas should be shown
   * @param itemId - Focused item that should host the preview renderer
   */
  private attachPreviewRendererSurface(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
    itemId: string | null,
  ): void {
    const previewRendererRouter: WebRendererRouter | null =
      previewRuntimeSession.previewRendererRouter;
    const rendererSnapshot: RendererSnapshot | null =
      previewRuntimeSession.rendererSnapshot;
    const surfaceEntry: WebPreviewSurfaceEntry | null =
      this.previewSurfaceRegistry.getEntry(itemId);

    if (
      previewRendererRouter === null ||
      rendererSnapshot === null ||
      rendererSnapshot.usedLegacyPath ||
      surfaceEntry === null
    ) {
      this.detachPreviewRendererSurface(previewRuntimeSession);
      return;
    }

    previewRendererRouter.bindToHost(surfaceEntry.hostElement);
    surfaceEntry.hostElement.classList.add("is-active");
    previewRuntimeSession.hostElement = surfaceEntry.hostElement;
    this.updatePreviewCardDebugState(surfaceEntry.hostElement);
  }

  /**
   * @brief Detach one preview renderer canvas from its current host
   *
   * @param previewRuntimeSession - Preview slot whose renderer should be detached
   */
  private detachPreviewRendererSurface(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): void {
    previewRuntimeSession.previewRendererRouter?.detach();
  }

  /**
   * @brief Attach one preview slot to the current browse card host
   *
   * @param previewRuntimeSession - Preview slot being shown
   * @param itemId - Focused item that should host the preview video
   */
  private attachPreviewSurface(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
    itemId: string | null,
  ): void {
    const videoElement: HTMLVideoElement | null =
      previewRuntimeSession.videoElement;
    const surfaceEntry: WebPreviewSurfaceEntry | null =
      this.previewSurfaceRegistry.getEntry(itemId);

    if (videoElement === null || surfaceEntry === null) {
      this.detachPreviewSurface(previewRuntimeSession);
      return;
    }

    if (previewRuntimeSession.hostElement === surfaceEntry.hostElement) {
      previewRuntimeSession.previewRendererRouter?.detach();
      surfaceEntry.hostElement.classList.add("is-active");
      this.updatePreviewCardDebugState(surfaceEntry.hostElement);
      return;
    }

    previewRuntimeSession.previewRendererRouter?.detach();
    this.detachPreviewSurface(previewRuntimeSession);
    surfaceEntry.hostElement.replaceChildren(videoElement);
    surfaceEntry.hostElement.classList.add("is-active");
    previewRuntimeSession.hostElement = surfaceEntry.hostElement;
    this.updatePreviewCardDebugState(surfaceEntry.hostElement);
  }

  /**
   * @brief Remove one preview slot from its current browse card host
   *
   * @param previewRuntimeSession - Preview slot being detached
   */
  private detachPreviewSurface(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): void {
    const hostElement: HTMLDivElement | null =
      previewRuntimeSession.hostElement;
    const videoElement: HTMLVideoElement | null =
      previewRuntimeSession.videoElement;

    if (hostElement !== null) {
      hostElement.classList.remove("is-active");
      this.updatePreviewCardDebugState(hostElement);

      if (videoElement !== null && videoElement.parentElement === hostElement) {
        hostElement.replaceChildren();
      }
    }

    previewRuntimeSession.hostElement = null;
  }

  /**
   * @brief Keep the host card's debug data aligned with preview attachment state
   *
   * @param hostElement - Preview host that just changed active state
   */
  private updatePreviewCardDebugState(hostElement: HTMLDivElement): void {
    const thumbnailCardElement: HTMLElement | null = hostElement.closest(
      ".browse-thumbnail-card",
    );
    const artworkElement: HTMLElement | null = hostElement.closest(
      ".browse-thumbnail-artwork",
    );
    const hasStill: boolean =
      artworkElement?.classList.contains("has-still") === true;

    if (thumbnailCardElement === null) {
      return;
    }

    thumbnailCardElement.dataset.thumbnailVisualState =
      hostElement.classList.contains("is-active")
        ? "preview"
        : hasStill
          ? "still"
          : "fallback";
  }

  /**
   * @brief Resolve a shared media item from the catalog
   *
   * @param itemId - Stable item identifier
   *
   * @returns Matching media item, or `null` when none exists
   */
  private resolveMediaItem(itemId: string | null): MediaItem | null {
    if (itemId === null) {
      return null;
    }

    for (const catalogSection of this.catalog.getSections()) {
      const mediaItem: MediaItem | undefined = catalogSection
        .getItems()
        .find(
          (candidateMediaItem: MediaItem): boolean =>
            candidateMediaItem.id === itemId,
        );

      if (mediaItem !== undefined) {
        return mediaItem;
      }
    }

    return null;
  }

  /**
   * @brief Ensure one preview slot owns a reusable video element
   *
   * @param previewRuntimeSession - Preview slot that needs a video element
   *
   * @returns Preview video element used by the slot
   */
  private ensurePreviewVideoElement(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): HTMLVideoElement {
    if (previewRuntimeSession.videoElement !== null) {
      return previewRuntimeSession.videoElement;
    }

    const videoElement: HTMLVideoElement = document.createElement("video");

    videoElement.autoplay = false;
    videoElement.className = "browse-thumbnail-preview-video";
    videoElement.controls = false;
    videoElement.crossOrigin = "anonymous";
    videoElement.defaultMuted = true;
    videoElement.disablePictureInPicture = true;
    videoElement.loop = false;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.preload = "auto";
    videoElement.setAttribute("aria-hidden", "true");
    videoElement.setAttribute("crossorigin", "anonymous");
    videoElement.setAttribute("muted", "");
    videoElement.setAttribute("playsinline", "");

    previewRuntimeSession.videoElement = videoElement;

    return videoElement;
  }

  /**
   * @brief Destroy any active Shaka player owned by one preview slot
   *
   * @param previewRuntimeSession - Preview slot whose player should be destroyed
   */
  private async destroyPreviewShakaPlayer(
    previewRuntimeSession: ManagedPreviewRuntimeSession,
  ): Promise<void> {
    if (previewRuntimeSession.shakaPlayer === null) {
      return;
    }

    const shakaPlayer: ShakaPlayer = previewRuntimeSession.shakaPlayer;

    previewRuntimeSession.shakaPlayer = null;
    await shakaPlayer.destroy();
  }

  /**
   * @brief Reset a video element back to an unloaded state
   *
   * @param videoElement - Video element that should release its current source
   */
  private clearVideoElementSource(videoElement: HTMLVideoElement): void {
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
  }

  /**
   * @brief Wait until the browser reports that the first frame is displayable
   *
   * @param videoElement - Video element being warmed
   *
   * @returns Promise resolved after `loadeddata` fires once
   */
  private waitForLoadedData(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        const handleLoadedData = (): void => {
          cleanupListeners();
          resolve();
        };
        const handleError = (): void => {
          cleanupListeners();
          reject(new Error("The browser failed to load preview media data."));
        };
        const cleanupListeners = (): void => {
          videoElement.removeEventListener("loadeddata", handleLoadedData);
          videoElement.removeEventListener("error", handleError);
        };

        videoElement.addEventListener("loadeddata", handleLoadedData, {
          once: true,
        });
        videoElement.addEventListener("error", handleError, {
          once: true,
        });
      },
    );
  }

  /**
   * @brief Normalize runtime errors into readable failure messages
   *
   * @param error - Runtime error thrown by the browser or player path
   * @param fallbackMessage - Message used when the error is not descriptive
   *
   * @returns Human-readable failure reason
   */
  private describeRuntimeError(
    error: unknown,
    fallbackMessage: string,
  ): string {
    return error instanceof Error && error.message.length > 0
      ? `${fallbackMessage}: ${error.message}`
      : fallbackMessage;
  }

  /**
   * @brief Build one web execution result
   *
   * @param state - Execution state being reported
   * @param runtimeSessionHandle - Runtime-owned session handle
   * @param failureReason - Optional failure or unsupported reason
   *
   * @returns Web execution result
   */
  private createResult(
    state: MediaExecutionResult["state"],
    runtimeSessionHandle: MediaRuntimeSessionHandle | null,
    committedPlaybackDecision: CommittedPlaybackDecision | null,
    failureReason: string | null,
    startupDebugState: MediaStartupDebugState | null = null,
    audioExecution: MediaExecutionResult["audioExecution"] = null,
    customDecode: CustomDecodeSnapshot | null = null,
    renderer: RendererSnapshot | null = null,
  ): MediaExecutionResult {
    return {
      state,
      runtimeSessionHandle,
      committedPlaybackDecision:
        committedPlaybackDecision === null
          ? null
          : {
              ...committedPlaybackDecision,
              qualitySelection: {
                ...committedPlaybackDecision.qualitySelection,
                inventorySnapshot:
                  committedPlaybackDecision.qualitySelection
                    .inventorySnapshot === null
                    ? null
                    : MediaInventoryCloner.cloneSnapshot(
                        committedPlaybackDecision.qualitySelection
                          .inventorySnapshot,
                      ),
                selectedVariant: MediaInventoryCloner.cloneVariantInfo(
                  committedPlaybackDecision.qualitySelection.selectedVariant,
                ),
                reasons: [
                  ...committedPlaybackDecision.qualitySelection.reasons,
                ],
                notes: [...committedPlaybackDecision.qualitySelection.notes],
              },
              inventoryResult: MediaInventoryCloner.cloneResult(
                committedPlaybackDecision.inventoryResult,
              ),
              fallbackOrder: [...committedPlaybackDecision.fallbackOrder],
              reasons: [...committedPlaybackDecision.reasons],
              reasonDetails: [...committedPlaybackDecision.reasonDetails],
            },
      audioExecution:
        audioExecution === null
          ? null
          : {
              requestedAudioMode: audioExecution.requestedAudioMode,
              actualAudioMode: audioExecution.actualAudioMode,
              fallbackMode: audioExecution.fallbackMode,
              premiumAttemptRequested: audioExecution.premiumAttemptRequested,
              usedFallback: audioExecution.usedFallback,
              runtimeAcceptedRequestedMode:
                audioExecution.runtimeAcceptedRequestedMode,
              policyDecision: {
                audioMode: audioExecution.policyDecision.audioMode,
                fallbackMode: audioExecution.policyDecision.fallbackMode,
                requestedPremiumAttempt:
                  audioExecution.policyDecision.requestedPremiumAttempt,
                usedFallback: audioExecution.policyDecision.usedFallback,
                trackPolicy: {
                  preferPremiumAudio:
                    audioExecution.policyDecision.trackPolicy
                      .preferPremiumAudio,
                  preferDefaultTrack:
                    audioExecution.policyDecision.trackPolicy
                      .preferDefaultTrack,
                  preferredLanguage:
                    audioExecution.policyDecision.trackPolicy.preferredLanguage,
                  preferredChannelLayout:
                    audioExecution.policyDecision.trackPolicy
                      .preferredChannelLayout,
                  allowFallbackStereo:
                    audioExecution.policyDecision.trackPolicy
                      .allowFallbackStereo,
                },
                inventorySelectionReason:
                  audioExecution.policyDecision.inventorySelectionReason,
                inventorySnapshot:
                  audioExecution.policyDecision.inventorySnapshot === null
                    ? null
                    : MediaInventoryCloner.cloneSnapshot(
                        audioExecution.policyDecision.inventorySnapshot,
                      ),
                premiumCandidateAvailable:
                  audioExecution.policyDecision.premiumCandidateAvailable,
                selectedAudioTrack: MediaInventoryCloner.cloneAudioTrackInfo(
                  audioExecution.policyDecision.selectedAudioTrack,
                ),
                selectedTrackStrategy:
                  audioExecution.policyDecision.selectedTrackStrategy,
                capabilityProfile:
                  audioExecution.policyDecision.capabilityProfile === null
                    ? null
                    : {
                        canPlayCommittedAudio:
                          audioExecution.policyDecision.capabilityProfile
                            .canPlayCommittedAudio,
                        canAttemptPremiumAudio:
                          audioExecution.policyDecision.capabilityProfile
                            .canAttemptPremiumAudio,
                        canFallbackStereo:
                          audioExecution.policyDecision.capabilityProfile
                            .canFallbackStereo,
                        canKeepPreviewMuted:
                          audioExecution.policyDecision.capabilityProfile
                            .canKeepPreviewMuted,
                        canKeepExtractionSilent:
                          audioExecution.policyDecision.capabilityProfile
                            .canKeepExtractionSilent,
                      },
                committedPlaybackLane:
                  audioExecution.policyDecision.committedPlaybackLane,
                reasons: [...audioExecution.policyDecision.reasons],
                reasonDetails: [...audioExecution.policyDecision.reasonDetails],
              },
              runtimeReason: audioExecution.runtimeReason,
            },
      failureReason,
      startupDebugState:
        startupDebugState === null
          ? null
          : {
              phase: startupDebugState.phase,
              sourceId: startupDebugState.sourceId,
              warmResult:
                startupDebugState.warmResult === null
                  ? null
                  : {
                      manifest: startupDebugState.warmResult.manifest,
                      initSegment: startupDebugState.warmResult.initSegment,
                      startupWindow: startupDebugState.warmResult.startupWindow,
                      hotRange: startupDebugState.warmResult.hotRange,
                      notes: [...startupDebugState.warmResult.notes],
                    },
              directRuntimeFallbackReason:
                startupDebugState.directRuntimeFallbackReason,
            },
      customDecode: this.cloneCustomDecodeSnapshot(customDecode),
      renderer: SharedRendererRouter.cloneSnapshot(renderer),
    };
  }

  /**
   * @brief Create one preview-scoped custom decode snapshot from plan metadata
   *
   * @param capability - Shared capability data for the current preview role
   * @param decision - Shared decision for the current preview role
   * @param state - Session state being reported
   * @param usedCustomDecode - Whether the custom decode path completed work
   * @param usedFallback - Whether the established preview path is still in use
   * @param fallbackReason - Human-readable fallback reason
   * @param failureReason - Optional failure reason
   *
   * @returns Shared custom decode snapshot
   */
  private createPreviewCustomDecodeSnapshot(
    capability: NonNullable<
      NonNullable<MediaExecutionCommand["session"]>["capabilitySnapshot"]
    >["customDecodeCapability"],
    decision: NonNullable<
      MediaExecutionCommand["session"]
    >["customDecodeDecision"],
    state: CustomDecodeSnapshot["state"],
    usedCustomDecode: boolean,
    usedFallback: boolean,
    fallbackReason: string | null,
    failureReason: string | null,
  ): CustomDecodeSnapshot {
    return {
      lane: decision?.lane ?? null,
      state,
      usedCustomDecode,
      usedFallback,
      fallbackReason,
      failureReason,
      selectedFrame: null,
      renderer: null,
      capability: {
        lane: capability.lane,
        allowedByRole: capability.allowedByRole,
        supportLevel: capability.supportLevel,
        webCodecsSupportLevel: capability.webCodecsSupportLevel,
        reasons: [...capability.reasons],
        notes: [...capability.notes],
      },
      decision:
        decision === null
          ? null
          : {
              lane: decision.lane,
              shouldAttempt: decision.shouldAttempt,
              preferred: decision.preferred,
              fallbackRequired: decision.fallbackRequired,
              fallbackReason: decision.fallbackReason,
              reasons: [...decision.reasons],
              notes: [...decision.notes],
            },
      notes:
        fallbackReason === null
          ? [...capability.notes]
          : [...capability.notes, fallbackReason],
    };
  }

  /**
   * @brief Clone custom decode debug state for execution results
   *
   * @param customDecode - Custom decode debug state to clone
   *
   * @returns Cloned custom decode snapshot, or `null` when absent
   */
  private cloneCustomDecodeSnapshot(
    customDecode: CustomDecodeSnapshot | null,
  ): CustomDecodeSnapshot | null {
    if (customDecode === null) {
      return null;
    }

    return {
      lane: customDecode.lane,
      state: customDecode.state,
      usedCustomDecode: customDecode.usedCustomDecode,
      usedFallback: customDecode.usedFallback,
      fallbackReason: customDecode.fallbackReason,
      failureReason: customDecode.failureReason,
      selectedFrame:
        customDecode.selectedFrame === null
          ? null
          : {
              representation: customDecode.selectedFrame.representation,
              width: customDecode.selectedFrame.width,
              height: customDecode.selectedFrame.height,
              frameTimeMs: customDecode.selectedFrame.frameTimeMs,
            },
      renderer: SharedRendererRouter.cloneSnapshot(customDecode.renderer),
      capability:
        customDecode.capability === null
          ? null
          : {
              lane: customDecode.capability.lane,
              allowedByRole: customDecode.capability.allowedByRole,
              supportLevel: customDecode.capability.supportLevel,
              webCodecsSupportLevel:
                customDecode.capability.webCodecsSupportLevel,
              reasons: [...customDecode.capability.reasons],
              notes: [...customDecode.capability.notes],
            },
      decision:
        customDecode.decision === null
          ? null
          : {
              lane: customDecode.decision.lane,
              shouldAttempt: customDecode.decision.shouldAttempt,
              preferred: customDecode.decision.preferred,
              fallbackRequired: customDecode.decision.fallbackRequired,
              fallbackReason: customDecode.decision.fallbackReason,
              reasons: [...customDecode.decision.reasons],
              notes: [...customDecode.decision.notes],
            },
      notes: [...customDecode.notes],
    };
  }

  /**
   * @brief Enforce the shared muted-preview rule on one preview element
   *
   * @param videoElement - Preview element that should stay muted
   * @param audioExecution - Requested audio execution snapshot for the session
   */
  private applyRequestedPreviewAudioState(
    videoElement: HTMLVideoElement | null,
    audioExecution: MediaExecutionCommand["audioExecution"],
  ): void {
    if (videoElement === null || audioExecution === null) {
      return;
    }

    if (audioExecution.requestedAudioMode !== "muted-preview") {
      return;
    }

    videoElement.defaultMuted = true;
    videoElement.muted = true;
    videoElement.volume = 0;
  }

  /**
   * @brief Reflect whether the browser accepted the requested shared audio mode
   *
   * @param command - Shared execution command carrying the requested audio state
   * @param runtimeAcceptedRequestedMode - Whether the browser honored the request
   *
   * @returns Cloned audio execution snapshot, or `null` when absent
   */
  private createAcceptedAudioExecution(
    command: MediaExecutionCommand,
    runtimeAcceptedRequestedMode: boolean,
  ): MediaExecutionResult["audioExecution"] {
    const requestedAudioExecution: MediaExecutionCommand["audioExecution"] =
      command.audioExecution;

    if (requestedAudioExecution === null) {
      return null;
    }

    return {
      requestedAudioMode: requestedAudioExecution.requestedAudioMode,
      actualAudioMode: requestedAudioExecution.requestedAudioMode,
      fallbackMode: requestedAudioExecution.fallbackMode,
      premiumAttemptRequested: requestedAudioExecution.premiumAttemptRequested,
      usedFallback: requestedAudioExecution.usedFallback,
      runtimeAcceptedRequestedMode,
      policyDecision: requestedAudioExecution.policyDecision,
      runtimeReason:
        runtimeAcceptedRequestedMode === true
          ? null
          : "The web runtime did not complete the requested shared audio mode for this command.",
    };
  }

  /**
   * @brief Warm high-value startup artifacts through VFS for one runtime path
   *
   * @param phase - Runtime phase that is consulting VFS
   * @param sourceDescriptor - Source descriptor that owns the startup bytes
   * @param directRuntimeFallbackReason - Optional fallback note for debug output
   *
   * @returns Shared startup debug state, or `null` when no source was available
   */
  private async buildStartupDebugState(
    phase: MediaStartupDebugState["phase"],
    sourceDescriptor: MediaSourceDescriptor | null,
    directRuntimeFallbackReason: string | null = null,
  ): Promise<MediaStartupDebugState | null> {
    if (sourceDescriptor === null) {
      return null;
    }

    try {
      const warmResult: StartupWarmResult =
        await this.vfsController.warmStartupArtifacts({
          source: sourceDescriptor,
          variantKey: null,
          useCase:
            phase === "preview-warm"
              ? "preview-warm"
              : "committed-playback-startup",
          cachePolicy: this.vfsController.getDefaultCachePolicy(),
          allowServiceWorkerLookup: true,
          startupWindowByteLength: 131072,
          hotRangeByteLength: 262144,
        });

      return {
        phase,
        sourceId: sourceDescriptor.sourceId,
        warmResult,
        directRuntimeFallbackReason,
      };
    } catch (error: unknown) {
      return {
        phase,
        sourceId: sourceDescriptor.sourceId,
        warmResult: null,
        directRuntimeFallbackReason: this.describeRuntimeError(
          error,
          directRuntimeFallbackReason ??
            "VFS startup warming fell back to the direct runtime path.",
        ),
      };
    }
  }
}
