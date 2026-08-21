/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type {
  CustomDecodeCapability,
  CustomDecodeDecision,
  CustomDecodeFrameHandle,
  CustomDecodeSessionAdapter,
  CustomDecodeSnapshot,
  MediaSourceDescriptor,
  MediaThumbnailQuality,
} from "@meditation-surf/core";
import { VfsController } from "@meditation-surf/vfs";

type ShakaModule =
  (typeof import("shaka-player/dist/shaka-player.compiled.js"))["default"];
type ShakaPlayer = InstanceType<ShakaModule["Player"]>;
type WebCustomDecodeFrameAnalysis = {
  averageLuma: number;
  darkestSampleLuma: number;
  brightestSampleLuma: number;
  darkPixelRatio: number;
};
type WebCustomDecodeFrameResult = {
  bitmap: ImageBitmap;
  frameHandle: CustomDecodeFrameHandle;
  analysis: WebCustomDecodeFrameAnalysis;
  actualFrameTimeMs: number;
};

/**
 * @brief Conservative web custom decode adapter for extraction and preview prep
 *
 * This adapter keeps the first custom decode lane intentionally small. It
 * reuses the browser's trusted media loading path, then hands decoded frames
 * through a WebCodecs `VideoFrame` to `ImageBitmap` bridge when supported.
 */
export class WebCustomDecodeSessionAdapter implements CustomDecodeSessionAdapter {
  private analysisCanvasElement: HTMLCanvasElement | null;
  private readonly captureCanvasElement: HTMLCanvasElement;
  private currentBitmap: ImageBitmap | null;
  private extractionRootElement: HTMLDivElement | null;
  private readonly vfsController: VfsController | null;
  private videoElement: HTMLVideoElement | null;
  private shakaPlayer: ShakaPlayer | null;

  /**
   * @brief Build one reusable web custom decode adapter
   *
   * @param vfsController - Optional VFS controller used for startup warming
   */
  public constructor(vfsController: VfsController | null = null) {
    this.analysisCanvasElement = null;
    this.captureCanvasElement = document.createElement("canvas");
    this.currentBitmap = null;
    this.extractionRootElement = null;
    this.vfsController = vfsController;
    this.videoElement = null;
    this.shakaPlayer = null;
  }

  /**
   * @brief Report whether the current browser exposes the needed WebCodecs APIs
   *
   * @returns `true` when the WebCodecs-backed frame handoff is available
   */
  public static isSupported(): boolean {
    const globalScope: typeof globalThis = globalThis;

    return (
      "VideoFrame" in globalScope &&
      typeof globalScope.createImageBitmap === "function"
    );
  }

  /**
   * @brief Open one role-scoped custom decode session and capture its first frame
   *
   * @param sourceDescriptor - Shared source descriptor being decoded
   * @param decision - Shared custom decode decision for the session role
   *
   * @returns Inspectable custom decode snapshot
   */
  public async open(
    sourceDescriptor: MediaSourceDescriptor,
    capability: CustomDecodeCapability,
    decision: CustomDecodeDecision,
  ): Promise<CustomDecodeSnapshot> {
    if (!decision.shouldAttempt || decision.lane === null) {
      return this.createSnapshot(
        capability,
        decision,
        "unsupported",
        false,
        true,
        decision.fallbackReason,
        null,
        null,
        decision.fallbackReason,
      );
    }

    if (!WebCustomDecodeSessionAdapter.isSupported()) {
      return this.createSnapshot(
        capability,
        decision,
        "unsupported",
        false,
        true,
        "WebCodecs is unavailable in this browser.",
        null,
        null,
        "WebCodecs is unavailable in this browser.",
      );
    }

    try {
      await this.warmStartupArtifacts(sourceDescriptor, decision);
      await this.loadSource(sourceDescriptor);
      const firstFrameResult: WebCustomDecodeFrameResult =
        await this.captureFrameAtTimeMs(0);

      return this.createSnapshot(
        capability,
        decision,
        "first-frame-ready",
        true,
        decision.fallbackRequired,
        decision.fallbackReason,
        null,
        firstFrameResult.frameHandle,
        null,
      );
    } catch (error: unknown) {
      const failureReason: string =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Custom decode failed while preparing the first frame.";

      return this.createSnapshot(
        capability,
        decision,
        "failed",
        false,
        true,
        failureReason,
        failureReason,
        null,
        failureReason,
      );
    }
  }

  /**
   * @brief Capture one decoded frame into an `ImageBitmap`
   *
   * @param targetTimeMs - Requested frame time in milliseconds
   *
   * @returns Decoded frame plus bounded brightness analysis
   */
  public async captureFrameAtTimeMs(
    targetTimeMs: number,
  ): Promise<WebCustomDecodeFrameResult> {
    const videoElement: HTMLVideoElement = this.ensureVideoElement();
    const normalizedTargetTimeMs: number = Math.max(
      0,
      Math.round(targetTimeMs),
    );

    await this.seekToFrameTime(videoElement, normalizedTargetTimeMs);
    this.disposeCurrentBitmap();
    const bitmap: ImageBitmap =
      await this.createImageBitmapFromVideo(videoElement);

    this.currentBitmap = bitmap;
    const frameHandle: CustomDecodeFrameHandle = {
      representation: "image-bitmap",
      width: bitmap.width,
      height: bitmap.height,
      frameTimeMs: Math.round(videoElement.currentTime * 1000),
    };

    return {
      bitmap,
      frameHandle,
      analysis: this.analyzeBitmap(bitmap),
      actualFrameTimeMs: Math.round(videoElement.currentTime * 1000),
    };
  }

  /**
   * @brief Serialize the supplied bitmap into one JPEG still payload
   *
   * @param bitmap - Bitmap being serialized
   * @param targetWidth - Optional target width constraint
   * @param targetHeight - Optional target height constraint
   * @param qualityHint - Shared thumbnail quality hint
   *
   * @returns Encoded JPEG blob plus resolved capture size
   */
  public async serializeBitmap(
    bitmap: ImageBitmap,
    targetWidth: number | null,
    targetHeight: number | null,
    qualityHint: MediaThumbnailQuality,
  ): Promise<{ imagePayload: Blob; width: number; height: number }> {
    const targetSize: { width: number; height: number } =
      this.resolveTargetSize(
        bitmap.width,
        bitmap.height,
        targetWidth,
        targetHeight,
      );
    const canvasContext: CanvasRenderingContext2D | null =
      this.captureCanvasElement.getContext("2d");

    if (canvasContext === null) {
      throw new Error("The browser could not create a 2D canvas context.");
    }

    this.captureCanvasElement.width = targetSize.width;
    this.captureCanvasElement.height = targetSize.height;
    canvasContext.drawImage(bitmap, 0, 0, targetSize.width, targetSize.height);
    const imagePayload: Blob = await this.serializeCanvas(
      this.captureCanvasElement,
      qualityHint,
    );

    return {
      imagePayload,
      width: targetSize.width,
      height: targetSize.height,
    };
  }

  /**
   * @brief Release the active session and any transient decode resources
   */
  public async close(): Promise<void> {
    this.disposeCurrentBitmap();
    await this.destroyShakaPlayer();

    if (this.videoElement === null) {
      return;
    }

    this.videoElement.pause();
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
    this.videoElement.currentTime = 0;
    this.videoElement.poster = "";
  }

  /**
   * @brief Ensure one hidden extraction root exists in the document
   *
   * @returns Hidden root element used for internal decode helpers
   */
  private ensureExtractionRootElement(): HTMLDivElement {
    if (this.extractionRootElement !== null) {
      return this.extractionRootElement;
    }

    const extractionRootElement: HTMLDivElement = document.createElement("div");

    extractionRootElement.setAttribute("aria-hidden", "true");
    extractionRootElement.style.height = "1px";
    extractionRootElement.style.left = "-10000px";
    extractionRootElement.style.opacity = "0";
    extractionRootElement.style.overflow = "hidden";
    extractionRootElement.style.pointerEvents = "none";
    extractionRootElement.style.position = "fixed";
    extractionRootElement.style.top = "0";
    extractionRootElement.style.width = "1px";
    document.body.append(extractionRootElement);
    this.extractionRootElement = extractionRootElement;

    return extractionRootElement;
  }

  /**
   * @brief Ensure one hidden video element exists for source loading
   *
   * @returns Hidden video element used for decode preparation
   */
  private ensureVideoElement(): HTMLVideoElement {
    if (this.videoElement !== null) {
      return this.videoElement;
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
    this.videoElement = videoElement;

    return videoElement;
  }

  /**
   * @brief Ensure one reusable analysis canvas exists
   *
   * @returns Canvas used for bounded luma inspection
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
   * @brief Warm the startup bytes most likely to help the current lane
   *
   * @param sourceDescriptor - Shared source being prepared
   * @param decision - Shared decision for the current custom decode lane
   */
  private async warmStartupArtifacts(
    sourceDescriptor: MediaSourceDescriptor,
    decision: CustomDecodeDecision,
  ): Promise<void> {
    if (this.vfsController === null || decision.lane === null) {
      return;
    }

    await this.vfsController.warmStartupArtifacts({
      source: sourceDescriptor,
      variantKey: null,
      useCase:
        decision.lane === "thumbnail-extraction"
          ? "thumbnail-extract"
          : "preview-warm",
      cachePolicy: this.vfsController.getDefaultCachePolicy(),
      allowServiceWorkerLookup: true,
      startupWindowByteLength: 131072,
      hotRangeByteLength: 262144,
    });
  }

  /**
   * @brief Load one source through native playback or Shaka
   *
   * @param sourceDescriptor - Shared source descriptor being prepared
   */
  private async loadSource(
    sourceDescriptor: MediaSourceDescriptor,
  ): Promise<void> {
    const videoElement: HTMLVideoElement = this.ensureVideoElement();
    const playbackMimeType: string =
      sourceDescriptor.mimeType ?? "application/x-mpegURL";
    const canUseNativePlayback: boolean =
      videoElement.canPlayType(playbackMimeType) !== "";
    const readyForFirstFramePromise: Promise<void> =
      this.waitForLoadedData(videoElement);

    videoElement.poster = sourceDescriptor.posterUrl ?? "";

    if (canUseNativePlayback) {
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
      throw new Error(
        "The current browser does not support the fallback container path.",
      );
    }

    const shakaPlayer: ShakaPlayer = new shaka.Player(videoElement);

    this.shakaPlayer = shakaPlayer;
    await shakaPlayer.load(sourceDescriptor.url);
    await readyForFirstFramePromise;
  }

  /**
   * @brief Seek the hidden video element to one requested frame time
   *
   * @param videoElement - Hidden video element being seeked
   * @param targetTimeMs - Requested frame time in milliseconds
   */
  private async seekToFrameTime(
    videoElement: HTMLVideoElement,
    targetTimeMs: number,
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
    await seekPromise;
  }

  /**
   * @brief Convert the current video frame into an `ImageBitmap`
   *
   * @param videoElement - Hidden video element holding the decoded frame
   *
   * @returns WebCodecs-backed bitmap for later analysis or capture
   */
  private async createImageBitmapFromVideo(
    videoElement: HTMLVideoElement,
  ): Promise<ImageBitmap> {
    const VideoFrameConstructor: typeof VideoFrame =
      globalThis.VideoFrame as typeof VideoFrame;
    const videoFrame: VideoFrame = new VideoFrameConstructor(videoElement, {
      timestamp: Math.round(videoElement.currentTime * 1000),
    });

    try {
      return await globalThis.createImageBitmap(videoFrame);
    } finally {
      videoFrame.close();
    }
  }

  /**
   * @brief Analyze one bitmap with a small luma pass
   *
   * @param bitmap - Bitmap being inspected
   *
   * @returns Small bounded brightness analysis
   */
  private analyzeBitmap(bitmap: ImageBitmap): WebCustomDecodeFrameAnalysis {
    const analysisCanvasElement: HTMLCanvasElement =
      this.ensureAnalysisCanvasElement();
    const analysisWidth: number = Math.min(64, Math.max(1, bitmap.width));
    const analysisHeight: number = Math.max(
      1,
      Math.round(
        (Math.max(1, bitmap.height) / Math.max(1, bitmap.width)) *
          analysisWidth,
      ),
    );
    const canvasContext: CanvasRenderingContext2D | null =
      analysisCanvasElement.getContext("2d");

    if (canvasContext === null) {
      throw new Error("The browser could not create a 2D canvas context.");
    }

    analysisCanvasElement.width = analysisWidth;
    analysisCanvasElement.height = analysisHeight;
    canvasContext.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
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
   * @brief Determine one output size while preserving aspect ratio
   *
   * @param intrinsicWidth - Intrinsic source width
   * @param intrinsicHeight - Intrinsic source height
   * @param targetWidth - Optional target width constraint
   * @param targetHeight - Optional target height constraint
   *
   * @returns Capture size used for final still serialization
   */
  private resolveTargetSize(
    intrinsicWidth: number,
    intrinsicHeight: number,
    targetWidth: number | null,
    targetHeight: number | null,
  ): { width: number; height: number } {
    if (targetWidth !== null && targetHeight !== null) {
      return {
        width: Math.max(1, Math.round(targetWidth)),
        height: Math.max(1, Math.round(targetHeight)),
      };
    }

    if (targetWidth !== null) {
      return {
        width: Math.max(1, Math.round(targetWidth)),
        height: Math.max(
          1,
          Math.round(
            (intrinsicHeight / Math.max(1, intrinsicWidth)) * targetWidth,
          ),
        ),
      };
    }

    if (targetHeight !== null) {
      return {
        width: Math.max(
          1,
          Math.round(
            (intrinsicWidth / Math.max(1, intrinsicHeight)) * targetHeight,
          ),
        ),
        height: Math.max(1, Math.round(targetHeight)),
      };
    }

    return {
      width: Math.max(1, intrinsicWidth),
      height: Math.max(1, intrinsicHeight),
    };
  }

  /**
   * @brief Serialize one capture canvas into a reusable JPEG blob
   *
   * @param canvasElement - Canvas containing the selected frame
   * @param qualityHint - Shared thumbnail quality hint
   *
   * @returns JPEG blob ready for VFS-managed persistence
   */
  private async serializeCanvas(
    canvasElement: HTMLCanvasElement,
    qualityHint: MediaThumbnailQuality,
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

    if (encodedBlob !== null) {
      return encodedBlob;
    }

    const fallbackDataUrl: string = canvasElement.toDataURL(
      "image/jpeg",
      jpegQuality,
    );

    return this.createBlobFromDataUrl(fallbackDataUrl, "image/jpeg");
  }

  /**
   * @brief Convert one quality hint into a stable JPEG quality value
   *
   * @param qualityHint - Shared thumbnail quality hint
   *
   * @returns Browser JPEG quality value
   */
  private getJpegQuality(qualityHint: MediaThumbnailQuality): number {
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
   * @brief Convert one data URL fallback into a blob payload
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
   * @brief Wait until a hidden video element exposes its first displayable frame
   *
   * @param videoElement - Hidden video element being loaded
   *
   * @returns Promise resolved after `loadeddata`
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
          reject(
            new Error("The browser failed to load custom decode media data."),
          );
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
   * @brief Wait until the browser reports one seek completion
   *
   * @param videoElement - Hidden video element being seeked
   *
   * @returns Promise resolved after `seeked`
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
            new Error("The browser failed while seeking custom decode media."),
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
   * @brief Destroy any transient Shaka player owned by this adapter
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
   * @brief Release the currently retained bitmap, when one exists
   */
  private disposeCurrentBitmap(): void {
    if (this.currentBitmap === null) {
      return;
    }

    this.currentBitmap.close();
    this.currentBitmap = null;
  }

  /**
   * @brief Create one stable custom decode snapshot for shared debug state
   *
   * @param decision - Shared decision associated with the attempted lane
   * @param state - Session state being reported
   * @param usedCustomDecode - Whether the adapter successfully used custom decode
   * @param usedFallback - Whether the established runtime path is still required
   * @param fallbackReason - Optional fallback reason
   * @param failureReason - Optional failure reason
   * @param selectedFrame - Optional selected frame metadata
   * @param note - Optional note appended to the snapshot
   *
   * @returns Shared custom decode snapshot
   */
  private createSnapshot(
    capability: CustomDecodeCapability,
    decision: CustomDecodeDecision,
    state: CustomDecodeSnapshot["state"],
    usedCustomDecode: boolean,
    usedFallback: boolean,
    fallbackReason: string | null,
    failureReason: string | null,
    selectedFrame: CustomDecodeFrameHandle | null,
    note: string | null,
  ): CustomDecodeSnapshot {
    return {
      lane: decision.lane,
      state,
      usedCustomDecode,
      usedFallback,
      fallbackReason,
      failureReason,
      selectedFrame,
      renderer: null,
      capability: {
        lane: capability.lane,
        allowedByRole: capability.allowedByRole,
        supportLevel: capability.supportLevel,
        webCodecsSupportLevel: capability.webCodecsSupportLevel,
        reasons: [...capability.reasons],
        notes: [...capability.notes],
      },
      decision: {
        lane: decision.lane,
        shouldAttempt: decision.shouldAttempt,
        preferred: decision.preferred,
        fallbackRequired: decision.fallbackRequired,
        fallbackReason: decision.fallbackReason,
        reasons: [...decision.reasons],
        notes: [...decision.notes],
      },
      notes: note === null ? [...decision.notes] : [...decision.notes, note],
    };
  }
}
