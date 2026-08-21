/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  CustomDecodeSnapshot,
  MediaThumbnailCandidateFrame,
  MediaThumbnailExtractionAttempt,
  MediaThumbnailExtractionResult,
  MediaThumbnailRequest,
  MediaThumbnailRuntimeAdapter,
  MediaThumbnailRuntimeCapabilities,
  MediaThumbnailSelectionDecision,
  MediaThumbnailSelectionReason,
  RendererFrameHandle,
  RendererSnapshot,
} from "@meditation-surf/core";
import {
  MediaThumbnailFrameSelector,
  RendererRouter as SharedRendererRouter,
} from "@meditation-surf/core";
import { VfsController } from "@meditation-surf/vfs";

import { WebCustomDecodeSessionAdapter } from "./WebCustomDecodeSessionAdapter";
import { WebRendererRouter } from "./WebRendererRouter";

type ShakaModule =
  (typeof import("shaka-player/dist/shaka-player.compiled.js"))["default"];
type ShakaPlayer = InstanceType<ShakaModule["Player"]>;
type WebFrameAnalysis = {
  averageLuma: number;
  darkestSampleLuma: number;
  brightestSampleLuma: number;
  darkPixelRatio: number;
};

/**
 * @brief Real web thumbnail extraction adapter backed by hidden media elements
 *
 * The implementation intentionally stays practical for this phase: one hidden
 * extraction path, bounded first-non-black inspection, optional time-hint
 * seeking, and raw image payloads that the shared VFS layer can persist and
 * lease.
 */
export class WebMediaThumbnailRuntimeAdapter implements MediaThumbnailRuntimeAdapter {
  public static readonly RUNTIME_ID: string = "web-vite-thumbnail";

  private static readonly CAPABILITIES: MediaThumbnailRuntimeCapabilities = {
    canExtractFirstFrame: true,
    canExtractNonBlackFrame: true,
    canExtractFromHiddenMedia: true,
    canCacheObjectUrls: false,
    canPrioritizeFocusedItem: true,
    supportsWebCodecs: WebCustomDecodeSessionAdapter.isSupported(),
    supportsCustomDecodeExtraction: WebCustomDecodeSessionAdapter.isSupported(),
  };

  public readonly runtimeId: string;

  private analysisCanvasElement: HTMLCanvasElement | null;
  private extractionCanvasElement: HTMLCanvasElement | null;
  private extractionRootElement: HTMLDivElement | null;
  private extractionVideoElement: HTMLVideoElement | null;
  private shakaPlayer: ShakaPlayer | null;
  private readonly vfsController: VfsController | null;

  /**
   * @brief Create the reusable web thumbnail extraction adapter
   *
   * @param vfsController - Optional VFS controller used for startup warming
   */
  public constructor(vfsController: VfsController | null = null) {
    this.runtimeId = WebMediaThumbnailRuntimeAdapter.RUNTIME_ID;
    this.analysisCanvasElement = null;
    this.extractionCanvasElement = null;
    this.extractionRootElement = null;
    this.extractionVideoElement = null;
    this.shakaPlayer = null;
    this.vfsController = vfsController;
  }

  /**
   * @brief Report the web thumbnail extraction features available right now
   *
   * @returns Web thumbnail runtime capability snapshot
   */
  public getCapabilities(): MediaThumbnailRuntimeCapabilities {
    return {
      ...WebMediaThumbnailRuntimeAdapter.CAPABILITIES,
    };
  }

  /**
   * @brief Extract one still thumbnail from the supplied media source
   *
   * @param request - Shared thumbnail request emitted by the media controller
   *
   * @returns Extracted still image that the web shell can render directly
   */
  public async extractThumbnail(
    request: MediaThumbnailRequest,
  ): Promise<MediaThumbnailExtractionResult> {
    const videoElement: HTMLVideoElement = this.ensureExtractionVideoElement();
    const analysisCanvasElement: HTMLCanvasElement =
      this.ensureAnalysisCanvasElement();
    const canvasElement: HTMLCanvasElement =
      this.ensureExtractionCanvasElement();
    const extractionStartedAt: number = Date.now();
    let customDecodeSessionAdapter: WebCustomDecodeSessionAdapter | null = null;
    let customDecodeSnapshot: CustomDecodeSnapshot | null =
      this.createFallbackCustomDecodeSnapshot(
        request,
        "Thumbnail extraction is using the existing HTMLVideoElement path.",
      );

    try {
      if (
        request.customDecodeDecision.shouldAttempt &&
        WebMediaThumbnailRuntimeAdapter.CAPABILITIES
          .supportsCustomDecodeExtraction
      ) {
        customDecodeSessionAdapter = new WebCustomDecodeSessionAdapter(
          this.vfsController,
        );
        customDecodeSnapshot = await customDecodeSessionAdapter.open(
          request.sourceDescriptor,
          request.customDecodeCapability,
          request.customDecodeDecision,
        );

        if (
          customDecodeSnapshot.usedCustomDecode &&
          customDecodeSnapshot.state === "first-frame-ready"
        ) {
          const candidateFrames: MediaThumbnailCandidateFrame[] =
            await this.collectCandidateFramesWithCustomDecode(
              request,
              customDecodeSessionAdapter,
              extractionStartedAt,
            );
          const selectionDecision: MediaThumbnailSelectionDecision =
            MediaThumbnailFrameSelector.selectCandidateFrame(
              request.extractionPolicy,
              candidateFrames,
            );

          return await this.captureSelectedFrameWithCustomDecode(
            request,
            customDecodeSessionAdapter,
            selectionDecision,
            extractionStartedAt,
            customDecodeSnapshot,
          );
        }
      }

      await this.warmStartupArtifacts(request);
      await this.loadRequestSource(request, videoElement, extractionStartedAt);
      const candidateFrames: MediaThumbnailCandidateFrame[] =
        await this.collectCandidateFrames(
          request,
          videoElement,
          analysisCanvasElement,
          extractionStartedAt,
        );
      const selectionDecision: MediaThumbnailSelectionDecision =
        MediaThumbnailFrameSelector.selectCandidateFrame(
          request.extractionPolicy,
          candidateFrames,
        );

      return await this.captureSelectedFrame(
        request,
        videoElement,
        canvasElement,
        selectionDecision,
        extractionStartedAt,
        customDecodeSnapshot,
      );
    } finally {
      await customDecodeSessionAdapter?.close();
      await this.resetExtractionPath();
    }
  }

  /**
   * @brief Ensure one hidden extraction root exists in the current document
   *
   * @returns Hidden DOM node that owns reusable extraction elements
   */
  private ensureExtractionRootElement(): HTMLDivElement {
    if (this.extractionRootElement !== null) {
      return this.extractionRootElement;
    }

    const extractionRootElement: HTMLDivElement = document.createElement("div");

    extractionRootElement.setAttribute("aria-hidden", "true");
    extractionRootElement.style.height = "1px";
    extractionRootElement.style.left = "-10000px";
    extractionRootElement.style.overflow = "hidden";
    extractionRootElement.style.pointerEvents = "none";
    extractionRootElement.style.position = "fixed";
    extractionRootElement.style.top = "0";
    extractionRootElement.style.width = "1px";
    extractionRootElement.style.opacity = "0";
    document.body.append(extractionRootElement);
    this.extractionRootElement = extractionRootElement;

    return extractionRootElement;
  }

  /**
   * @brief Ensure one reusable hidden video element exists for extraction work
   *
   * @returns Hidden video element used to decode still frames
   */
  private ensureExtractionVideoElement(): HTMLVideoElement {
    if (this.extractionVideoElement !== null) {
      return this.extractionVideoElement;
    }

    const videoElement: HTMLVideoElement = document.createElement("video");
    const extractionRootElement: HTMLDivElement =
      this.ensureExtractionRootElement();

    videoElement.autoplay = false;
    videoElement.controls = false;
    videoElement.crossOrigin = "anonymous";
    videoElement.defaultMuted = true;
    videoElement.disablePictureInPicture = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.preload = "auto";
    videoElement.setAttribute("aria-hidden", "true");
    videoElement.setAttribute("crossorigin", "anonymous");
    videoElement.setAttribute("muted", "");
    videoElement.setAttribute("playsinline", "");
    extractionRootElement.append(videoElement);
    this.extractionVideoElement = videoElement;

    return videoElement;
  }

  /**
   * @brief Ensure one reusable canvas exists for frame capture
   *
   * @returns Canvas element used to serialize still images
   */
  private ensureExtractionCanvasElement(): HTMLCanvasElement {
    if (this.extractionCanvasElement !== null) {
      return this.extractionCanvasElement;
    }

    const canvasElement: HTMLCanvasElement = document.createElement("canvas");

    this.extractionCanvasElement = canvasElement;

    return canvasElement;
  }

  /**
   * @brief Ensure one reusable analysis canvas exists for luma inspection
   *
   * @returns Canvas element used for bounded candidate-frame analysis
   */
  private ensureAnalysisCanvasElement(): HTMLCanvasElement {
    if (this.analysisCanvasElement !== null) {
      return this.analysisCanvasElement;
    }

    const analysisCanvasElement: HTMLCanvasElement =
      document.createElement("canvas");

    this.analysisCanvasElement = analysisCanvasElement;

    return analysisCanvasElement;
  }

  /**
   * @brief Load the request source through native playback or Shaka
   *
   * @param request - Shared request being loaded
   * @param videoElement - Hidden video element used for decoding
   */
  private async loadRequestSource(
    request: MediaThumbnailRequest,
    videoElement: HTMLVideoElement,
    extractionStartedAt: number,
  ): Promise<void> {
    const sourceDescriptor = request.sourceDescriptor;
    const playbackMimeType: string =
      sourceDescriptor.mimeType ?? "application/x-mpegURL";
    const canUseNativePlayback: boolean =
      videoElement.canPlayType(playbackMimeType) !== "";
    const loadPromise: Promise<void> = this.waitForLoadedData(videoElement);
    videoElement.poster = sourceDescriptor.posterUrl ?? "";

    if (canUseNativePlayback) {
      videoElement.src = sourceDescriptor.url;
      videoElement.load();
      await this.withRemainingTimeout(
        loadPromise,
        request.extractionPolicy.timeoutMs,
        extractionStartedAt,
      );
      return;
    }

    const shakaModule: { default: ShakaModule } =
      await import("shaka-player/dist/shaka-player.compiled.js");
    const shaka: ShakaModule = shakaModule.default;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      throw new Error("Shaka Player is not supported in this browser.");
    }

    const shakaPlayer: ShakaPlayer = new shaka.Player(videoElement);

    this.shakaPlayer = shakaPlayer;
    await this.withRemainingTimeout(
      shakaPlayer.load(sourceDescriptor.url),
      request.extractionPolicy.timeoutMs,
      extractionStartedAt,
    );
    await this.withRemainingTimeout(
      loadPromise,
      request.extractionPolicy.timeoutMs,
      extractionStartedAt,
    );
  }

  /**
   * @brief Inspect a bounded set of candidate frames for the current request
   *
   * @param request - Shared request emitted by the thumbnail controller
   * @param videoElement - Hidden video element used for decoding
   * @param analysisCanvasElement - Reusable canvas used for luma analysis
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Candidate frames prepared for shared selection logic
   */
  private async collectCandidateFrames(
    request: MediaThumbnailRequest,
    videoElement: HTMLVideoElement,
    analysisCanvasElement: HTMLCanvasElement,
    extractionStartedAt: number,
  ): Promise<MediaThumbnailCandidateFrame[]> {
    const candidateFrameTimesMs: number[] =
      MediaThumbnailFrameSelector.createCandidateFrameTimes(
        request.extractionPolicy,
        request.timeHintMs,
      );
    const boundedCandidateFrameTimesMs: number[] = candidateFrameTimesMs.slice(
      0,
      request.extractionPolicy.maxAttemptCount,
    );
    const candidateFrames: MediaThumbnailCandidateFrame[] = [];

    for (const [
      attemptIndex,
      candidateFrameTimeMs,
    ] of boundedCandidateFrameTimesMs.entries()) {
      const candidateFrame: MediaThumbnailCandidateFrame =
        await this.inspectCandidateFrame(
          request,
          videoElement,
          analysisCanvasElement,
          candidateFrameTimeMs,
          attemptIndex,
          extractionStartedAt,
        );

      candidateFrames.push(candidateFrame);

      if (candidateFrame.rejectionReason === "timeout") {
        break;
      }
    }

    return candidateFrames;
  }

  /**
   * @brief Inspect the bounded candidate set through the WebCodecs frame path
   *
   * @param request - Shared request emitted by the thumbnail controller
   * @param customDecodeSessionAdapter - Web custom decode adapter for the request
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Candidate frames prepared for shared selection logic
   */
  private async collectCandidateFramesWithCustomDecode(
    request: MediaThumbnailRequest,
    customDecodeSessionAdapter: WebCustomDecodeSessionAdapter,
    extractionStartedAt: number,
  ): Promise<MediaThumbnailCandidateFrame[]> {
    const candidateFrameTimesMs: number[] =
      MediaThumbnailFrameSelector.createCandidateFrameTimes(
        request.extractionPolicy,
        request.timeHintMs,
      );
    const boundedCandidateFrameTimesMs: number[] = candidateFrameTimesMs.slice(
      0,
      request.extractionPolicy.maxAttemptCount,
    );
    const candidateFrames: MediaThumbnailCandidateFrame[] = [];

    for (const [
      attemptIndex,
      candidateFrameTimeMs,
    ] of boundedCandidateFrameTimesMs.entries()) {
      try {
        const frameResult = await this.withRemainingTimeout(
          customDecodeSessionAdapter.captureFrameAtTimeMs(candidateFrameTimeMs),
          request.extractionPolicy.timeoutMs,
          extractionStartedAt,
        );

        candidateFrames.push({
          attemptIndex,
          stage: this.resolveCandidateStage(request, candidateFrameTimeMs),
          requestedFrameTimeMs: candidateFrameTimeMs,
          frameTimeMs: frameResult.actualFrameTimeMs,
          averageLuma: frameResult.analysis.averageLuma,
          darkestSampleLuma: frameResult.analysis.darkestSampleLuma,
          brightestSampleLuma: frameResult.analysis.brightestSampleLuma,
          darkPixelRatio: frameResult.analysis.darkPixelRatio,
          isDecodable: true,
          rejectionReason: null,
        });
      } catch (error: unknown) {
        const rejectionReason: MediaThumbnailCandidateFrame["rejectionReason"] =
          error instanceof Error && error.message.includes("timed out")
            ? "timeout"
            : "decode-failed";

        candidateFrames.push({
          attemptIndex,
          stage: this.resolveCandidateStage(request, candidateFrameTimeMs),
          requestedFrameTimeMs: candidateFrameTimeMs,
          frameTimeMs: candidateFrameTimeMs,
          averageLuma: null,
          darkestSampleLuma: null,
          brightestSampleLuma: null,
          darkPixelRatio: null,
          isDecodable: false,
          rejectionReason,
        });

        if (rejectionReason === "timeout") {
          break;
        }
      }
    }

    return candidateFrames;
  }

  /**
   * @brief Inspect one candidate frame at a requested time
   *
   * @param request - Shared request emitted by the thumbnail controller
   * @param videoElement - Hidden video element used for decoding
   * @param analysisCanvasElement - Reusable canvas used for luma analysis
   * @param candidateFrameTimeMs - Candidate frame time being inspected
   * @param attemptIndex - Stable attempt index within the bounded candidate set
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Shared candidate-frame description for selection logic
   */
  private async inspectCandidateFrame(
    request: MediaThumbnailRequest,
    videoElement: HTMLVideoElement,
    analysisCanvasElement: HTMLCanvasElement,
    candidateFrameTimeMs: number,
    attemptIndex: number,
    extractionStartedAt: number,
  ): Promise<MediaThumbnailCandidateFrame> {
    try {
      await this.seekToFrameTime(
        videoElement,
        candidateFrameTimeMs,
        request.extractionPolicy.timeoutMs,
        extractionStartedAt,
      );

      const frameAnalysis: WebFrameAnalysis = this.analyzeCurrentFrame(
        videoElement,
        analysisCanvasElement,
      );

      return {
        attemptIndex,
        stage: this.resolveCandidateStage(request, candidateFrameTimeMs),
        requestedFrameTimeMs: candidateFrameTimeMs,
        frameTimeMs: Math.round(videoElement.currentTime * 1000),
        averageLuma: frameAnalysis.averageLuma,
        darkestSampleLuma: frameAnalysis.darkestSampleLuma,
        brightestSampleLuma: frameAnalysis.brightestSampleLuma,
        darkPixelRatio: frameAnalysis.darkPixelRatio,
        isDecodable: true,
        rejectionReason: null,
      };
    } catch (error: unknown) {
      const rejectionReason: MediaThumbnailCandidateFrame["rejectionReason"] =
        error instanceof Error && error.message.includes("timed out")
          ? "timeout"
          : "decode-failed";

      return {
        attemptIndex,
        stage: this.resolveCandidateStage(request, candidateFrameTimeMs),
        requestedFrameTimeMs: candidateFrameTimeMs,
        frameTimeMs: candidateFrameTimeMs,
        averageLuma: null,
        darkestSampleLuma: null,
        brightestSampleLuma: null,
        darkPixelRatio: null,
        isDecodable: false,
        rejectionReason,
      };
    }
  }

  /**
   * @brief Resolve the logical evaluation stage associated with one candidate
   *
   * @param request - Shared thumbnail request being processed
   * @param candidateFrameTimeMs - Candidate frame time being inspected
   *
   * @returns Candidate stage used by the shared selector and debug output
   */
  private resolveCandidateStage(
    request: MediaThumbnailRequest,
    candidateFrameTimeMs: number,
  ): MediaThumbnailCandidateFrame["stage"] {
    if (request.extractionPolicy.strategy === "time-hint") {
      return "time-hint";
    }

    return candidateFrameTimeMs === 0 ? "first-frame" : "representative-search";
  }

  /**
   * @brief Seek the hidden extractor to one requested frame time
   *
   * @param videoElement - Hidden video element used for decoding
   * @param targetTimeMs - Requested frame time in milliseconds
   * @param timeoutMs - Optional request timeout
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   */
  private async seekToFrameTime(
    videoElement: HTMLVideoElement,
    targetTimeMs: number,
    timeoutMs: number | null,
    extractionStartedAt: number,
  ): Promise<void> {
    const normalizedTargetTimeSeconds: number = Math.max(
      0,
      targetTimeMs / 1000,
    );

    if (
      Math.abs(videoElement.currentTime - normalizedTargetTimeSeconds) <= 0.02
    ) {
      return;
    }

    const seekPromise: Promise<void> = this.waitForSeeked(videoElement);

    videoElement.currentTime = normalizedTargetTimeSeconds;
    await this.withRemainingTimeout(
      seekPromise,
      timeoutMs,
      extractionStartedAt,
    );
  }

  /**
   * @brief Capture the currently selected frame into the persisted still blob
   *
   * @param request - Shared thumbnail request
   * @param videoElement - Hidden video element used for decoding
   * @param canvasElement - Reusable canvas used for final serialization
   * @param selectionDecision - Shared selection decision produced by the selector
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Serialized thumbnail result with inspectable selection metadata
   */
  private async captureSelectedFrame(
    request: MediaThumbnailRequest,
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    selectionDecision: MediaThumbnailSelectionDecision,
    extractionStartedAt: number,
    customDecode: CustomDecodeSnapshot | null,
  ): Promise<MediaThumbnailExtractionResult> {
    const selectedFrameTimeMs: number | null =
      selectionDecision.selectedFrameTimeMs;

    if (selectedFrameTimeMs === null) {
      throw new Error(
        `Thumbnail extraction could not decode any usable frames for ${request.sourceId}.`,
      );
    }

    await this.seekToFrameTime(
      videoElement,
      selectedFrameTimeMs,
      request.extractionPolicy.timeoutMs,
      extractionStartedAt,
    );

    const targetSize: { width: number; height: number } =
      this.resolveTargetSize(request, videoElement);
    const routedRendererResult: {
      imagePayload: Blob | null;
      renderer: RendererSnapshot;
    } = await this.tryRouteFrameThroughRenderer(
      request,
      videoElement,
      {
        representation: "canvas-image-source",
        origin: "legacy-presentation",
        width: targetSize.width,
        height: targetSize.height,
        frameTimeMs: Math.round(videoElement.currentTime * 1000),
      },
      [
        "Thumbnail extraction attempted renderer routing from the hidden video extraction path.",
      ],
    );
    const imagePayload: Blob = await this.serializeNormalizedFrameSource(
      videoElement,
      canvasElement,
      targetSize,
      request.qualityHint,
    );
    const extractionAttempt: MediaThumbnailExtractionAttempt =
      this.createExtractionAttempt(
        request,
        selectionDecision,
        extractionStartedAt,
        customDecode,
      );

    return {
      sourceId: request.sourceId,
      imagePayload,
      imageContentType: imagePayload.type || "image/jpeg",
      width: targetSize.width,
      height: targetSize.height,
      frameTimeMs: Math.round(videoElement.currentTime * 1000),
      extractedAt: Date.now(),
      wasApproximate: selectionDecision.fallbackUsed,
      extractionAttempt,
      selectionDecision: {
        ...selectionDecision,
        resolvedReason: this.resolveSelectionReason(selectionDecision),
      },
      customDecode: this.cloneCustomDecodeSnapshot(customDecode),
      renderer: SharedRendererRouter.cloneSnapshot(
        routedRendererResult.renderer,
      ),
    };
  }

  /**
   * @brief Capture the selected frame through the WebCodecs bitmap handoff path
   *
   * @param request - Shared thumbnail request
   * @param customDecodeSessionAdapter - Web custom decode adapter for the request
   * @param selectionDecision - Shared selection decision produced by the selector
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   * @param customDecode - Current custom decode snapshot for the request
   *
   * @returns Serialized thumbnail result with inspectable selection metadata
   */
  private async captureSelectedFrameWithCustomDecode(
    request: MediaThumbnailRequest,
    customDecodeSessionAdapter: WebCustomDecodeSessionAdapter,
    selectionDecision: MediaThumbnailSelectionDecision,
    extractionStartedAt: number,
    customDecode: CustomDecodeSnapshot,
  ): Promise<MediaThumbnailExtractionResult> {
    const selectedFrameTimeMs: number | null =
      selectionDecision.selectedFrameTimeMs;

    if (selectedFrameTimeMs === null) {
      throw new Error(
        `Thumbnail extraction could not decode any usable frames for ${request.sourceId}.`,
      );
    }

    const frameResult = await this.withRemainingTimeout(
      customDecodeSessionAdapter.captureFrameAtTimeMs(selectedFrameTimeMs),
      request.extractionPolicy.timeoutMs,
      extractionStartedAt,
    );
    const targetSize: { width: number; height: number } =
      this.resolveTargetSize(request, frameResult.bitmap);
    const routedRendererResult: {
      imagePayload: Blob | null;
      renderer: RendererSnapshot;
    } = await this.tryRouteFrameThroughRenderer(
      request,
      frameResult.bitmap,
      {
        representation: frameResult.frameHandle.representation,
        origin: "custom-decode",
        width: targetSize.width,
        height: targetSize.height,
        frameTimeMs: frameResult.actualFrameTimeMs,
      },
      [
        "Thumbnail extraction attempted renderer routing from the custom decode frame handoff path.",
      ],
    );
    const canvasElement: HTMLCanvasElement =
      this.ensureExtractionCanvasElement();
    const imagePayload: Blob = await this.withRemainingTimeout(
      this.serializeNormalizedFrameSource(
        frameResult.bitmap,
        canvasElement,
        targetSize,
        request.qualityHint,
      ),
      request.extractionPolicy.timeoutMs,
      extractionStartedAt,
    );
    const nextCustomDecode: CustomDecodeSnapshot = {
      ...this.cloneCustomDecodeSnapshot(customDecode)!,
      selectedFrame: {
        representation: frameResult.frameHandle.representation,
        width: frameResult.frameHandle.width,
        height: frameResult.frameHandle.height,
        frameTimeMs: frameResult.actualFrameTimeMs,
      },
      renderer: SharedRendererRouter.cloneSnapshot(
        routedRendererResult.renderer,
      ),
      notes: [
        ...customDecode.notes,
        "Thumbnail extraction completed through the WebCodecs frame handoff path.",
      ],
    };
    const extractionAttempt: MediaThumbnailExtractionAttempt =
      this.createExtractionAttempt(
        request,
        selectionDecision,
        extractionStartedAt,
        nextCustomDecode,
      );

    return {
      sourceId: request.sourceId,
      imagePayload,
      imageContentType: imagePayload.type || "image/jpeg",
      width: targetSize.width,
      height: targetSize.height,
      frameTimeMs: frameResult.actualFrameTimeMs,
      extractedAt: Date.now(),
      wasApproximate: selectionDecision.fallbackUsed,
      extractionAttempt,
      selectionDecision: {
        ...selectionDecision,
        resolvedReason: this.resolveSelectionReason(selectionDecision),
      },
      customDecode: nextCustomDecode,
      renderer: SharedRendererRouter.cloneSnapshot(
        routedRendererResult.renderer,
      ),
    };
  }

  /**
   * @brief Normalize one frame source through the trusted 2D canvas path
   *
   * Renderer routing may still run for diagnostics and backend selection, but
   * the persisted thumbnail must come from this normalized canvas serialization
   * path so the final still uses stable browser 2D rasterization semantics.
   *
   * @param frameSource - Canvas-friendly source holding the selected frame
   * @param canvasElement - Reusable canvas used for normalization
   * @param targetSize - Resolved output size for the persisted thumbnail
   * @param qualityHint - Shared quality hint used for JPEG serialization
   *
   * @returns Encoded JPEG blob generated from the normalized 2D canvas
   */
  private async serializeNormalizedFrameSource(
    frameSource: CanvasImageSource,
    canvasElement: HTMLCanvasElement,
    targetSize: { width: number; height: number },
    qualityHint: MediaThumbnailRequest["qualityHint"],
  ): Promise<Blob> {
    const canvasContext: CanvasRenderingContext2D | null =
      canvasElement.getContext("2d");

    if (canvasContext === null) {
      throw new Error("The browser could not create a 2D canvas context.");
    }

    canvasElement.width = targetSize.width;
    canvasElement.height = targetSize.height;
    canvasContext.drawImage(
      frameSource,
      0,
      0,
      targetSize.width,
      targetSize.height,
    );

    return await this.serializeCanvas(canvasElement, qualityHint);
  }

  /**
   * @brief Attempt one routed renderer presentation before falling back to legacy serialization
   *
   * @param request - Shared thumbnail request being processed
   * @param frameSource - Frame source being handed to the renderer router
   * @param frameHandle - Shared frame metadata recorded for debug state
   * @param notes - Extra notes describing the current routing attempt
   *
   * @returns Renderer snapshot plus encoded image payload when a backend succeeded
   */
  private async tryRouteFrameThroughRenderer(
    request: MediaThumbnailRequest,
    frameSource: CanvasImageSource,
    frameHandle: RendererFrameHandle,
    notes: string[],
  ): Promise<{ imagePayload: Blob | null; renderer: RendererSnapshot }> {
    const webRendererRouter: WebRendererRouter = new WebRendererRouter();

    try {
      const rendererSnapshot: RendererSnapshot =
        await webRendererRouter.routeFrame({
          capability: request.rendererCapability,
          decision: request.rendererDecision,
          sessionId: `thumbnail:${request.sourceId}`,
          sessionRole: "thumbnail",
          variantRole: "thumbnail-extract",
          target: "extraction-surface",
          frameSource,
          frameHandle,
          hostElement: null,
          legacyFallbackReason:
            "Thumbnail extraction fell back to the legacy image serialization path.",
          notes,
        });

      if (rendererSnapshot.usedLegacyPath) {
        return {
          imagePayload: null,
          renderer: rendererSnapshot,
        };
      }

      const imagePayload: Blob | null = await webRendererRouter.captureBlob(
        "image/jpeg",
        this.resolveJpegQuality(request.qualityHint),
      );

      if (imagePayload !== null) {
        return {
          imagePayload,
          renderer: rendererSnapshot,
        };
      }

      return {
        imagePayload: null,
        renderer: SharedRendererRouter.createSnapshot({
          capability: request.rendererCapability,
          decision: request.rendererDecision,
          sessionId: `thumbnail:${request.sourceId}`,
          sessionRole: "thumbnail",
          variantRole: "thumbnail-extract",
          target: "extraction-surface",
          selectedBackend: rendererSnapshot.selectedBackend,
          activeBackend: null,
          usedLegacyPath: true,
          bypassedRendererRouter: false,
          fallbackReason:
            "Renderer serialization returned no image payload, so thumbnail extraction fell back to the legacy image path.",
          failureReason: "Renderer serialization returned no image payload.",
          frameHandle,
          reasons: ["runtime-fallback"],
          notes,
        }),
      };
    } finally {
      await webRendererRouter.destroy();
    }
  }

  /**
   * @brief Build one shared extraction-attempt summary for debug consumers
   *
   * @param request - Shared request currently being processed
   * @param selectionDecision - Shared selection decision produced for the request
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Shared extraction-attempt summary
   */
  private createExtractionAttempt(
    request: MediaThumbnailRequest,
    selectionDecision: MediaThumbnailSelectionDecision,
    extractionStartedAt: number,
    customDecode: CustomDecodeSnapshot | null,
  ): MediaThumbnailExtractionAttempt {
    const completedFrameCount: number =
      selectionDecision.candidateFrames.filter(
        (candidateFrame: MediaThumbnailCandidateFrame): boolean =>
          candidateFrame.isDecodable,
      ).length;

    return {
      requestedStrategy: request.extractionPolicy.strategy,
      strategyUsed: selectionDecision.strategyUsed,
      fallbackBehavior: request.extractionPolicy.fallbackBehavior,
      qualityIntent: request.extractionPolicy.qualityIntent,
      timeoutMs: request.extractionPolicy.timeoutMs,
      firstFrameFastPath: request.extractionPolicy.firstFrameFastPath,
      representativeSearchOnRejection:
        request.extractionPolicy.representativeSearchOnRejection,
      targetTimeSeconds: request.extractionPolicy.targetTimeSeconds,
      searchWindowStartSeconds:
        request.extractionPolicy.searchWindowStartSeconds,
      searchWindowEndSeconds: request.extractionPolicy.searchWindowEndSeconds,
      candidateWindowMs: request.extractionPolicy.candidateWindowMs,
      candidateFrameStepMs: request.extractionPolicy.candidateFrameStepMs,
      maxCandidateFrames: request.extractionPolicy.maxCandidateFrames,
      maxAttemptCount: request.extractionPolicy.maxAttemptCount,
      attemptedFrameCount: selectionDecision.attemptedFrameCount,
      completedFrameCount,
      timedOut: selectionDecision.rejectionReasons.includes("timeout"),
      unsupported: false,
      customDecode: this.cloneCustomDecodeSnapshot(customDecode),
      startedAt: extractionStartedAt,
      finishedAt: Date.now(),
    };
  }

  /**
   * @brief Resolve the surfaced selection reason for one extraction result
   *
   * @param selectionDecision - Shared selection decision chosen by the selector
   *
   * @returns Selection reason surfaced by the runtime result
   */
  private resolveSelectionReason(
    selectionDecision: MediaThumbnailSelectionDecision,
  ): MediaThumbnailSelectionReason {
    return selectionDecision.selectionReason;
  }

  /**
   * @brief Create a conservative fallback snapshot for the current request
   *
   * @param request - Shared thumbnail request being processed
   * @param fallbackReason - Human-readable reason for using the fallback path
   *
   * @returns Shared custom decode snapshot describing the fallback state
   */
  private createFallbackCustomDecodeSnapshot(
    request: MediaThumbnailRequest,
    fallbackReason: string,
  ): CustomDecodeSnapshot | null {
    if (request.customDecodeDecision.lane === null) {
      return null;
    }

    return {
      lane: request.customDecodeDecision.lane,
      state: request.customDecodeDecision.shouldAttempt
        ? "failed"
        : "unsupported",
      usedCustomDecode: false,
      usedFallback: true,
      fallbackReason,
      failureReason: request.customDecodeDecision.shouldAttempt
        ? fallbackReason
        : null,
      selectedFrame: null,
      renderer: null,
      capability: {
        lane: request.customDecodeCapability.lane,
        allowedByRole: request.customDecodeCapability.allowedByRole,
        supportLevel: request.customDecodeCapability.supportLevel,
        webCodecsSupportLevel:
          request.customDecodeCapability.webCodecsSupportLevel,
        reasons: [...request.customDecodeCapability.reasons],
        notes: [...request.customDecodeCapability.notes],
      },
      decision: {
        lane: request.customDecodeDecision.lane,
        shouldAttempt: request.customDecodeDecision.shouldAttempt,
        preferred: request.customDecodeDecision.preferred,
        fallbackRequired: request.customDecodeDecision.fallbackRequired,
        fallbackReason: request.customDecodeDecision.fallbackReason,
        reasons: [...request.customDecodeDecision.reasons],
        notes: [...request.customDecodeDecision.notes],
      },
      notes: [fallbackReason],
    };
  }

  /**
   * @brief Clone one custom decode snapshot for result payloads
   *
   * @param customDecode - Custom decode snapshot being cloned
   *
   * @returns Cloned snapshot, or `null` when absent
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
   * @brief Convert the shared thumbnail quality tier into a browser JPEG hint
   *
   * @param qualityHint - Shared quality tier selected for the request
   *
   * @returns JPEG quality value passed to browser serialization
   */
  private resolveJpegQuality(
    qualityHint: MediaThumbnailRequest["qualityHint"],
  ): number {
    switch (qualityHint) {
      case "low":
        return 0.72;
      case "medium":
        return 0.82;
      case "high":
        return 0.9;
      case "premium-attempt":
        return 0.94;
    }
  }

  /**
   * @brief Analyze the current decoded frame using a small off-screen canvas
   *
   * @param videoElement - Hidden video element holding the current decoded frame
   * @param analysisCanvasElement - Reusable canvas used for luma analysis
   *
   * @returns Simple bounded brightness analysis for shared selection logic
   */
  private analyzeCurrentFrame(
    videoElement: HTMLVideoElement,
    analysisCanvasElement: HTMLCanvasElement,
  ): WebFrameAnalysis {
    const intrinsicWidth: number = Math.max(1, videoElement.videoWidth || 1);
    const intrinsicHeight: number = Math.max(1, videoElement.videoHeight || 1);
    const analysisWidth: number = Math.min(64, intrinsicWidth);
    const analysisHeight: number = Math.max(
      1,
      Math.round((intrinsicHeight / intrinsicWidth) * analysisWidth),
    );
    const canvasContext: CanvasRenderingContext2D | null =
      analysisCanvasElement.getContext("2d");

    if (canvasContext === null) {
      throw new Error("The browser could not create a 2D canvas context.");
    }

    analysisCanvasElement.width = analysisWidth;
    analysisCanvasElement.height = analysisHeight;
    canvasContext.drawImage(videoElement, 0, 0, analysisWidth, analysisHeight);
    const imageData: ImageData = canvasContext.getImageData(
      0,
      0,
      analysisWidth,
      analysisHeight,
    );
    const pixelData: Uint8ClampedArray = imageData.data;
    let totalLuma: number = 0;
    let darkestSampleLuma: number = 255;
    let brightestSampleLuma: number = 0;
    let darkPixelCount: number = 0;
    const pixelCount: number = Math.max(1, pixelData.length / 4);

    for (
      let pixelOffset: number = 0;
      pixelOffset < pixelData.length;
      pixelOffset += 4
    ) {
      const redChannel: number = pixelData[pixelOffset] ?? 0;
      const greenChannel: number = pixelData[pixelOffset + 1] ?? 0;
      const blueChannel: number = pixelData[pixelOffset + 2] ?? 0;
      const sampleLuma: number = Math.round(
        redChannel * 0.2126 + greenChannel * 0.7152 + blueChannel * 0.0722,
      );

      totalLuma += sampleLuma;
      darkestSampleLuma = Math.min(darkestSampleLuma, sampleLuma);
      brightestSampleLuma = Math.max(brightestSampleLuma, sampleLuma);

      if (sampleLuma <= 24) {
        darkPixelCount += 1;
      }
    }

    return {
      averageLuma: totalLuma / pixelCount,
      darkestSampleLuma,
      brightestSampleLuma,
      darkPixelRatio: darkPixelCount / pixelCount,
    };
  }

  /**
   * @brief Determine the captured output size while preserving aspect ratio
   *
   * @param request - Shared request that may constrain output size
   * @param videoElement - Hidden video element holding intrinsic media size
   *
   * @returns Width and height used for canvas capture
   */
  private resolveTargetSize(
    request: MediaThumbnailRequest,
    frameSource:
      | { height: number; width: number }
      | { videoHeight: number; videoWidth: number },
  ): { width: number; height: number } {
    const intrinsicWidth: number = Math.max(
      1,
      "videoWidth" in frameSource
        ? frameSource.videoWidth || 1
        : frameSource.width || 1,
    );
    const intrinsicHeight: number = Math.max(
      1,
      "videoHeight" in frameSource
        ? frameSource.videoHeight || 1
        : frameSource.height || 1,
    );
    const targetWidthHint: number | null =
      request.targetWidth ?? request.extractionPolicy.targetWidth;
    const targetHeightHint: number | null =
      request.targetHeight ?? request.extractionPolicy.targetHeight;

    if (targetWidthHint !== null && targetHeightHint !== null) {
      return {
        width: Math.max(1, Math.round(targetWidthHint)),
        height: Math.max(1, Math.round(targetHeightHint)),
      };
    }

    if (targetWidthHint !== null) {
      return {
        width: Math.max(1, Math.round(targetWidthHint)),
        height: Math.max(
          1,
          Math.round((intrinsicHeight / intrinsicWidth) * targetWidthHint),
        ),
      };
    }

    if (targetHeightHint !== null) {
      return {
        width: Math.max(
          1,
          Math.round((intrinsicWidth / intrinsicHeight) * targetHeightHint),
        ),
        height: Math.max(1, Math.round(targetHeightHint)),
      };
    }

    return {
      width: intrinsicWidth,
      height: intrinsicHeight,
    };
  }

  /**
   * @brief Serialize the current canvas content into a reusable image blob
   *
   * @param canvasElement - Canvas containing the captured frame
   * @param qualityHint - Shared quality hint used to tune JPEG serialization
   *
   * @returns JPEG blob ready for VFS-managed persistence
   */
  private async serializeCanvas(
    canvasElement: HTMLCanvasElement,
    qualityHint: MediaThumbnailRequest["qualityHint"],
  ): Promise<Blob> {
    const jpegQuality: number = this.getJpegQuality(qualityHint);
    const encodedBlob: Blob | null = await new Promise<Blob | null>(
      (resolve: (blob: Blob | null) => void): void => {
        canvasElement.toBlob(
          (blob: Blob | null): void => {
            resolve(blob);
          },
          "image/jpeg",
          jpegQuality,
        );
      },
    );

    if (encodedBlob === null) {
      const fallbackDataUrl: string = canvasElement.toDataURL(
        "image/jpeg",
        jpegQuality,
      );

      return this.createBlobFromDataUrl(fallbackDataUrl, "image/jpeg");
    }

    return encodedBlob;
  }

  /**
   * @brief Convert one shared quality hint into a JPEG encoder quality
   *
   * @param qualityHint - Shared thumbnail quality label
   *
   * @returns Browser JPEG quality value
   */
  private getJpegQuality(
    qualityHint: MediaThumbnailRequest["qualityHint"],
  ): number {
    switch (qualityHint) {
      case "premium-attempt":
        return 0.92;
      case "high":
        return 0.86;
      case "medium":
        return 0.72;
      case "low":
        return 0.56;
    }
  }

  /**
   * @brief Convert a data URL fallback into a blob for VFS-managed storage
   *
   * @param dataUrl - Data URL emitted by the canvas fallback path
   * @param contentType - Content type associated with the payload
   *
   * @returns Blob rebuilt from the data URL payload
   */
  private createBlobFromDataUrl(dataUrl: string, contentType: string): Blob {
    const encodedPayload: string = dataUrl.split(",")[1] ?? "";
    const binaryPayload: string = window.atob(encodedPayload);
    const byteNumbers: number[] = Array.from(
      binaryPayload,
      (character: string): number => character.charCodeAt(0),
    );
    const byteArray: Uint8Array = new Uint8Array(byteNumbers);
    const blobBuffer: ArrayBuffer = byteArray.buffer.slice(
      byteArray.byteOffset,
      byteArray.byteOffset + byteArray.byteLength,
    ) as ArrayBuffer;

    return new Blob([blobBuffer], {
      type: contentType,
    });
  }

  /**
   * @brief Reset the hidden extraction path after one request finishes
   */
  private async resetExtractionPath(): Promise<void> {
    await this.destroyShakaPlayer();

    if (this.extractionVideoElement === null) {
      return;
    }

    this.extractionVideoElement.pause();
    this.extractionVideoElement.removeAttribute("src");
    this.extractionVideoElement.load();
    this.extractionVideoElement.currentTime = 0;
    this.extractionVideoElement.poster = "";
  }

  /**
   * @brief Destroy any transient Shaka player used by the hidden extractor
   */
  private async destroyShakaPlayer(): Promise<void> {
    if (this.shakaPlayer === null) {
      return;
    }

    const shakaPlayer: ShakaPlayer = this.shakaPlayer;

    this.shakaPlayer = null;
    await shakaPlayer.destroy();
  }

  /**
   * @brief Wait until a hidden video element reports its first decodable frame
   *
   * @param videoElement - Hidden video element being loaded
   *
   * @returns Promise resolved after `loadeddata` fires
   */
  private waitForLoadedData(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        const handleLoadedData = (): void => {
          cleanup();
          resolve();
        };
        const handleError = (): void => {
          cleanup();
          reject(new Error("The browser failed to load thumbnail media data."));
        };
        const cleanup = (): void => {
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
   * @brief Wait until the browser reports that a requested seek completed
   *
   * @param videoElement - Hidden video element being seeked
   *
   * @returns Promise resolved after `seeked` fires
   */
  private waitForSeeked(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        const handleSeeked = (): void => {
          cleanup();
          resolve();
        };
        const handleError = (): void => {
          cleanup();
          reject(
            new Error("The browser failed while seeking thumbnail media."),
          );
        };
        const cleanup = (): void => {
          videoElement.removeEventListener("seeked", handleSeeked);
          videoElement.removeEventListener("error", handleError);
        };

        videoElement.addEventListener("seeked", handleSeeked, {
          once: true,
        });
        videoElement.addEventListener("error", handleError, {
          once: true,
        });
      },
    );
  }

  /**
   * @brief Wrap an async operation in the request's optional timeout
   *
   * @param promise - Async operation being awaited
   * @param totalTimeoutMs - Optional timeout duration for the whole extraction
   * @param extractionStartedAt - Wall-clock timestamp when extraction began
   *
   * @returns Original promise result when it finishes before the remaining timeout
   */
  private async withRemainingTimeout<TValue>(
    promise: Promise<TValue>,
    totalTimeoutMs: number | null,
    extractionStartedAt: number,
  ): Promise<TValue> {
    if (totalTimeoutMs === null || totalTimeoutMs <= 0) {
      return promise;
    }

    const elapsedMs: number = Date.now() - extractionStartedAt;
    const remainingTimeoutMs: number = totalTimeoutMs - elapsedMs;

    if (remainingTimeoutMs <= 0) {
      throw new Error(
        `Thumbnail extraction timed out after ${totalTimeoutMs}ms.`,
      );
    }

    return await this.withOptionalTimeout(promise, remainingTimeoutMs);
  }

  /**
   * @brief Wrap an async operation in the request's optional timeout
   *
   * @param promise - Async operation being awaited
   * @param timeoutMs - Optional timeout duration
   *
   * @returns Original promise result when it finishes in time
   */
  private async withOptionalTimeout<TValue>(
    promise: Promise<TValue>,
    timeoutMs: number | null,
  ): Promise<TValue> {
    if (timeoutMs === null || timeoutMs <= 0) {
      return promise;
    }

    return await new Promise<TValue>(
      (
        resolve: (value: TValue | PromiseLike<TValue>) => void,
        reject: (reason?: unknown) => void,
      ): void => {
        const timeoutHandle: number = window.setTimeout((): void => {
          reject(
            new Error(`Thumbnail extraction timed out after ${timeoutMs}ms.`),
          );
        }, timeoutMs);

        promise.then(
          (value: TValue): void => {
            window.clearTimeout(timeoutHandle);
            resolve(value);
          },
          (reason: unknown): void => {
            window.clearTimeout(timeoutHandle);
            reject(reason);
          },
        );
      },
    );
  }

  /**
   * @brief Ask VFS to prewarm the highest-value startup bytes for extraction
   *
   * @param request - Shared thumbnail request being prepared
   */
  private async warmStartupArtifacts(
    request: MediaThumbnailRequest,
  ): Promise<void> {
    if (this.vfsController === null) {
      return;
    }

    await this.vfsController.warmStartupArtifacts({
      source: request.sourceDescriptor,
      variantKey: null,
      useCase: "thumbnail-extract",
      cachePolicy: this.vfsController.getDefaultCachePolicy(),
      allowServiceWorkerLookup: true,
      startupWindowByteLength: 131072,
      hotRangeByteLength: 262144,
    });
  }
}
