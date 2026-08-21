/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import {
  type BrowseFocusState,
  type BrowseHeroContent,
  type BrowseInputMode,
  type BrowseMetadataEntry,
  type BrowseRowContent,
  type BrowseScreenContent,
  type BrowseThumbnailContent,
} from "@meditation-surf/browse";
import {
  MediaInventoryCloner,
  type MediaThumbnailCacheEntry,
  type MediaThumbnailSnapshot,
} from "@meditation-surf/core";

import { WebAppLayoutController } from "../layout/WebAppLayoutController";
import {
  type WebPreviewSurfaceEntry,
  WebPreviewSurfaceRegistry,
} from "../media/WebPreviewSurfaceRegistry";

type WebThumbnailCardBinding = {
  itemId: string;
  cardElement: HTMLElement;
  artworkElement: HTMLDivElement;
  stillImageElement: HTMLImageElement;
  previewHostElement: HTMLDivElement;
};

/**
 * @brief Own the DOM shell used by the web demo surface
 *
 * The shell is intentionally runtime-specific. It knows how to assemble the
 * DOM nodes that the web app needs, while the shared experience model stays
 * outside the shell itself.
 */
export class WebAppShell {
  public readonly backgroundVideoElement: HTMLVideoElement;
  public readonly fullscreenInteractionElement: HTMLButtonElement;
  public readonly loadingOverlayElement: HTMLImageElement;
  public readonly overlayUiElement: HTMLDivElement;
  public readonly mountElement: HTMLDivElement;

  private browseFocusState: BrowseFocusState;
  private readonly previewSurfaceRegistry: WebPreviewSurfaceRegistry;
  private previewSurfaceEntries: WebPreviewSurfaceEntry[];
  private thumbnailCardBindingsByItemId: Map<string, WebThumbnailCardBinding[]>;
  private thumbnailCardElements: HTMLElement[][];
  private thumbnailSnapshot: MediaThumbnailSnapshot;

  /**
   * @brief Build the DOM shell for the web app
   *
   * @param appLayoutController - Runtime adapter for the shared app layout
   * @param browseContent - Shared browse content rendered in the overlay UI plane
   */
  public constructor(
    appLayoutController: WebAppLayoutController,
    browseContent: BrowseScreenContent,
    previewSurfaceRegistry: WebPreviewSurfaceRegistry,
    thumbnailSnapshot: MediaThumbnailSnapshot,
  ) {
    this.browseFocusState = {
      activeRowIndex: 0,
      activeItemIndexByRow: [],
      hasFocusedItem: false,
    };
    this.previewSurfaceRegistry = previewSurfaceRegistry;
    this.previewSurfaceEntries = [];
    this.thumbnailCardBindingsByItemId = new Map<
      string,
      WebThumbnailCardBinding[]
    >();
    this.thumbnailCardElements = [];
    this.thumbnailSnapshot = thumbnailSnapshot;
    this.mountElement = this.getMountElement();
    this.backgroundVideoElement = document.createElement("video");
    this.fullscreenInteractionElement = document.createElement("button");
    this.loadingOverlayElement =
      appLayoutController.createCenteredOverlayElement();
    this.overlayUiElement = this.createOverlayUiElement();
    const loadingPlaneElement: HTMLDivElement = this.createOverlayPlaneElement(
      "loading-plane",
      false,
    );
    const overlayUiPlaneElement: HTMLDivElement =
      this.createOverlayPlaneElement("overlay-ui-plane", true);

    this.backgroundVideoElement.className = "background-video";
    this.fullscreenInteractionElement.className = "interaction-surface";
    this.fullscreenInteractionElement.type = "button";
    this.fullscreenInteractionElement.setAttribute(
      "aria-label",
      "Show overlay controls",
    );
    this.loadingOverlayElement.classList.add("loading-icon");

    /**
     * @brief Prime both overlay planes with the shared centered sizing
     *
     * The loading plane is visible immediately, so its icon must receive its
     * initial width and height before the first paint. The overlay UI plane is
     * independent text, so only the loading plane consumes the shared overlay
     * sizing guidance.
     */
    appLayoutController.applyCenteredOverlayLayout(this.loadingOverlayElement);
    this.renderBrowseContent(browseContent);
    loadingPlaneElement.append(this.loadingOverlayElement);
    overlayUiPlaneElement.append(this.overlayUiElement);
    this.mountElement.append(
      this.backgroundVideoElement,
      this.fullscreenInteractionElement,
      loadingPlaneElement,
      overlayUiPlaneElement,
    );
  }

  /**
   * @brief Resolve the root mount element used by the Vite app
   *
   * @returns DOM mount element used for the entire surface
   */
  private getMountElement(): HTMLDivElement {
    const appRootElement: HTMLDivElement | null =
      document.querySelector("#app");

    if (appRootElement === null) {
      throw new Error("Expected the #app root element to exist.");
    }

    return appRootElement;
  }

  /**
   * @brief Render the shared browse content into the overlay UI plane
   *
   * @param browseContent - Shared browse content prepared by the core adapter
   */
  public renderBrowseContent(browseContent: BrowseScreenContent): void {
    this.thumbnailCardElements = [];
    this.previewSurfaceEntries = [];
    this.thumbnailCardBindingsByItemId.clear();
    this.overlayUiElement.replaceChildren(
      this.createBrowseOverlayElement(browseContent),
    );
    this.renderBrowseFocusState(this.browseFocusState);
    this.renderThumbnailSnapshot(this.thumbnailSnapshot);
  }

  /**
   * @brief Apply the shared browse focus state to the currently rendered cards
   *
   * @param browseFocusState - Shared browse focus snapshot
   */
  public renderBrowseFocusState(browseFocusState: BrowseFocusState): void {
    this.browseFocusState = {
      activeRowIndex: browseFocusState.activeRowIndex,
      activeItemIndexByRow: [...browseFocusState.activeItemIndexByRow],
      hasFocusedItem: browseFocusState.hasFocusedItem,
    };

    for (const [
      rowIndex,
      rowCardElements,
    ] of this.thumbnailCardElements.entries()) {
      const activeItemIndex: number =
        this.browseFocusState.activeItemIndexByRow[rowIndex] ?? 0;

      for (const [
        itemIndex,
        thumbnailCardElement,
      ] of rowCardElements.entries()) {
        const isFocused: boolean =
          this.browseFocusState.hasFocusedItem &&
          rowIndex === this.browseFocusState.activeRowIndex &&
          itemIndex === activeItemIndex;

        thumbnailCardElement.classList.toggle("is-focused", isFocused);
      }
    }

    this.previewSurfaceRegistry.replaceEntries(this.previewSurfaceEntries);
  }

  /**
   * @brief Apply browse input-mode styling to the web app shell
   *
   * @param inputMode - Surface-local browse input mode
   */
  public renderInputMode(inputMode: BrowseInputMode): void {
    this.mountElement.classList.toggle(
      "is-keyboard-mode",
      inputMode === "directional",
    );
  }

  /**
   * @brief Expose the currently rendered thumbnail cards to input adapters
   *
   * @returns Matrix of rendered thumbnail card elements
   */
  public getThumbnailCardElements(): readonly (readonly HTMLElement[])[] {
    return this.thumbnailCardElements;
  }

  /**
   * @brief Apply the latest shared thumbnail snapshot to the rendered cards
   *
   * @param thumbnailSnapshot - Shared thumbnail state published by the media controller
   */
  public renderThumbnailSnapshot(
    thumbnailSnapshot: MediaThumbnailSnapshot,
  ): void {
    this.thumbnailSnapshot = {
      entries: thumbnailSnapshot.entries.map(
        (
          thumbnailEntry: MediaThumbnailCacheEntry,
        ): MediaThumbnailCacheEntry => ({
          descriptor: {
            itemIds: [...thumbnailEntry.descriptor.itemIds],
            sourceId: thumbnailEntry.descriptor.sourceId,
            sourceDescriptor: {
              sourceId: thumbnailEntry.descriptor.sourceDescriptor.sourceId,
              kind: thumbnailEntry.descriptor.sourceDescriptor.kind,
              originType: thumbnailEntry.descriptor.sourceDescriptor.originType,
              url: thumbnailEntry.descriptor.sourceDescriptor.url,
              mimeType: thumbnailEntry.descriptor.sourceDescriptor.mimeType,
              posterUrl: thumbnailEntry.descriptor.sourceDescriptor.posterUrl,
            },
          },
          state: thumbnailEntry.state,
          request:
            thumbnailEntry.request === null
              ? null
              : {
                  descriptor: {
                    itemIds: [...thumbnailEntry.request.descriptor.itemIds],
                    sourceId: thumbnailEntry.request.descriptor.sourceId,
                    sourceDescriptor: {
                      sourceId:
                        thumbnailEntry.request.descriptor.sourceDescriptor
                          .sourceId,
                      kind: thumbnailEntry.request.descriptor.sourceDescriptor
                        .kind,
                      originType:
                        thumbnailEntry.request.descriptor.sourceDescriptor
                          .originType,
                      url: thumbnailEntry.request.descriptor.sourceDescriptor
                        .url,
                      mimeType:
                        thumbnailEntry.request.descriptor.sourceDescriptor
                          .mimeType,
                      posterUrl:
                        thumbnailEntry.request.descriptor.sourceDescriptor
                          .posterUrl,
                    },
                  },
                  sourceDescriptor: {
                    sourceId: thumbnailEntry.request.sourceDescriptor.sourceId,
                    kind: thumbnailEntry.request.sourceDescriptor.kind,
                    originType:
                      thumbnailEntry.request.sourceDescriptor.originType,
                    url: thumbnailEntry.request.sourceDescriptor.url,
                    mimeType: thumbnailEntry.request.sourceDescriptor.mimeType,
                    posterUrl:
                      thumbnailEntry.request.sourceDescriptor.posterUrl,
                  },
                  sourceId: thumbnailEntry.request.sourceId,
                  priorityHint: thumbnailEntry.request.priorityHint,
                  qualityHint: thumbnailEntry.request.qualityHint,
                  targetWidth: thumbnailEntry.request.targetWidth,
                  targetHeight: thumbnailEntry.request.targetHeight,
                  timeHintMs: thumbnailEntry.request.timeHintMs,
                  variantSelection: {
                    role: thumbnailEntry.request.variantSelection.role,
                    desiredQualityTier:
                      thumbnailEntry.request.variantSelection
                        .desiredQualityTier,
                    preferStartupLatency:
                      thumbnailEntry.request.variantSelection
                        .preferStartupLatency,
                    preferImageQuality:
                      thumbnailEntry.request.variantSelection
                        .preferImageQuality,
                    preferPremiumPlayback:
                      thumbnailEntry.request.variantSelection
                        .preferPremiumPlayback,
                    maxWidth: thumbnailEntry.request.variantSelection.maxWidth,
                    maxHeight:
                      thumbnailEntry.request.variantSelection.maxHeight,
                    maxBandwidth:
                      thumbnailEntry.request.variantSelection.maxBandwidth,
                    inventorySelectionReason:
                      thumbnailEntry.request.variantSelection
                        .inventorySelectionReason,
                    inventorySnapshot:
                      thumbnailEntry.request.variantSelection
                        .inventorySnapshot === null
                        ? null
                        : MediaInventoryCloner.cloneSnapshot(
                            thumbnailEntry.request.variantSelection
                              .inventorySnapshot,
                          ),
                    premiumCandidateAvailable:
                      thumbnailEntry.request.variantSelection
                        .premiumCandidateAvailable,
                    selectedVariant: MediaInventoryCloner.cloneVariantInfo(
                      thumbnailEntry.request.variantSelection.selectedVariant,
                    ),
                    matchedAvailableVariant:
                      thumbnailEntry.request.variantSelection
                        .matchedAvailableVariant,
                    matchedDesiredVariantIntent:
                      thumbnailEntry.request.variantSelection
                        .matchedDesiredVariantIntent,
                    reasons: [
                      ...thumbnailEntry.request.variantSelection.reasons,
                    ],
                    notes: [...thumbnailEntry.request.variantSelection.notes],
                  },
                  extractionPolicy: {
                    strategy: thumbnailEntry.request.extractionPolicy.strategy,
                    fallbackBehavior:
                      thumbnailEntry.request.extractionPolicy.fallbackBehavior,
                    firstFrameFastPath:
                      thumbnailEntry.request.extractionPolicy
                        .firstFrameFastPath,
                    representativeSearchOnRejection:
                      thumbnailEntry.request.extractionPolicy
                        .representativeSearchOnRejection,
                    qualityIntent:
                      thumbnailEntry.request.extractionPolicy.qualityIntent,
                    timeoutMs:
                      thumbnailEntry.request.extractionPolicy.timeoutMs,
                    targetWidth:
                      thumbnailEntry.request.extractionPolicy.targetWidth,
                    targetHeight:
                      thumbnailEntry.request.extractionPolicy.targetHeight,
                    targetTimeSeconds:
                      thumbnailEntry.request.extractionPolicy.targetTimeSeconds,
                    searchWindowStartSeconds:
                      thumbnailEntry.request.extractionPolicy
                        .searchWindowStartSeconds,
                    searchWindowEndSeconds:
                      thumbnailEntry.request.extractionPolicy
                        .searchWindowEndSeconds,
                    candidateWindowMs:
                      thumbnailEntry.request.extractionPolicy.candidateWindowMs,
                    candidateFrameStepMs:
                      thumbnailEntry.request.extractionPolicy
                        .candidateFrameStepMs,
                    maxCandidateFrames:
                      thumbnailEntry.request.extractionPolicy
                        .maxCandidateFrames,
                    maxAttemptCount:
                      thumbnailEntry.request.extractionPolicy.maxAttemptCount,
                    blackFrameThreshold:
                      thumbnailEntry.request.extractionPolicy
                        .blackFrameThreshold,
                    nearBlackFrameThreshold:
                      thumbnailEntry.request.extractionPolicy
                        .nearBlackFrameThreshold,
                    fadeInFrameThreshold:
                      thumbnailEntry.request.extractionPolicy
                        .fadeInFrameThreshold,
                  },
                  audioPolicyDecision: {
                    audioMode:
                      thumbnailEntry.request.audioPolicyDecision.audioMode,
                    fallbackMode:
                      thumbnailEntry.request.audioPolicyDecision.fallbackMode,
                    requestedPremiumAttempt:
                      thumbnailEntry.request.audioPolicyDecision
                        .requestedPremiumAttempt,
                    usedFallback:
                      thumbnailEntry.request.audioPolicyDecision.usedFallback,
                    trackPolicy: {
                      preferPremiumAudio:
                        thumbnailEntry.request.audioPolicyDecision.trackPolicy
                          .preferPremiumAudio,
                      preferDefaultTrack:
                        thumbnailEntry.request.audioPolicyDecision.trackPolicy
                          .preferDefaultTrack,
                      preferredLanguage:
                        thumbnailEntry.request.audioPolicyDecision.trackPolicy
                          .preferredLanguage,
                      preferredChannelLayout:
                        thumbnailEntry.request.audioPolicyDecision.trackPolicy
                          .preferredChannelLayout,
                      allowFallbackStereo:
                        thumbnailEntry.request.audioPolicyDecision.trackPolicy
                          .allowFallbackStereo,
                    },
                    inventorySelectionReason:
                      thumbnailEntry.request.audioPolicyDecision
                        .inventorySelectionReason,
                    inventorySnapshot:
                      thumbnailEntry.request.audioPolicyDecision
                        .inventorySnapshot === null
                        ? null
                        : MediaInventoryCloner.cloneSnapshot(
                            thumbnailEntry.request.audioPolicyDecision
                              .inventorySnapshot,
                          ),
                    premiumCandidateAvailable:
                      thumbnailEntry.request.audioPolicyDecision
                        .premiumCandidateAvailable,
                    selectedAudioTrack:
                      MediaInventoryCloner.cloneAudioTrackInfo(
                        thumbnailEntry.request.audioPolicyDecision
                          .selectedAudioTrack,
                      ),
                    selectedTrackStrategy:
                      thumbnailEntry.request.audioPolicyDecision
                        .selectedTrackStrategy,
                    capabilityProfile:
                      thumbnailEntry.request.audioPolicyDecision
                        .capabilityProfile === null
                        ? null
                        : {
                            canPlayCommittedAudio:
                              thumbnailEntry.request.audioPolicyDecision
                                .capabilityProfile.canPlayCommittedAudio,
                            canAttemptPremiumAudio:
                              thumbnailEntry.request.audioPolicyDecision
                                .capabilityProfile.canAttemptPremiumAudio,
                            canFallbackStereo:
                              thumbnailEntry.request.audioPolicyDecision
                                .capabilityProfile.canFallbackStereo,
                            canKeepPreviewMuted:
                              thumbnailEntry.request.audioPolicyDecision
                                .capabilityProfile.canKeepPreviewMuted,
                            canKeepExtractionSilent:
                              thumbnailEntry.request.audioPolicyDecision
                                .capabilityProfile.canKeepExtractionSilent,
                          },
                    committedPlaybackLane:
                      thumbnailEntry.request.audioPolicyDecision
                        .committedPlaybackLane,
                    reasons: [
                      ...thumbnailEntry.request.audioPolicyDecision.reasons,
                    ],
                    reasonDetails: [
                      ...thumbnailEntry.request.audioPolicyDecision
                        .reasonDetails,
                    ],
                  },
                  customDecodeCapability: {
                    lane: thumbnailEntry.request.customDecodeCapability.lane,
                    allowedByRole:
                      thumbnailEntry.request.customDecodeCapability
                        .allowedByRole,
                    supportLevel:
                      thumbnailEntry.request.customDecodeCapability
                        .supportLevel,
                    webCodecsSupportLevel:
                      thumbnailEntry.request.customDecodeCapability
                        .webCodecsSupportLevel,
                    reasons: [
                      ...thumbnailEntry.request.customDecodeCapability.reasons,
                    ],
                    notes: [
                      ...thumbnailEntry.request.customDecodeCapability.notes,
                    ],
                  },
                  customDecodeDecision: {
                    lane: thumbnailEntry.request.customDecodeDecision.lane,
                    shouldAttempt:
                      thumbnailEntry.request.customDecodeDecision.shouldAttempt,
                    preferred:
                      thumbnailEntry.request.customDecodeDecision.preferred,
                    fallbackRequired:
                      thumbnailEntry.request.customDecodeDecision
                        .fallbackRequired,
                    fallbackReason:
                      thumbnailEntry.request.customDecodeDecision
                        .fallbackReason,
                    reasons: [
                      ...thumbnailEntry.request.customDecodeDecision.reasons,
                    ],
                    notes: [
                      ...thumbnailEntry.request.customDecodeDecision.notes,
                    ],
                  },
                  rendererCapability: {
                    role: thumbnailEntry.request.rendererCapability.role,
                    webgpuSupportLevel:
                      thumbnailEntry.request.rendererCapability
                        .webgpuSupportLevel,
                    webglSupportLevel:
                      thumbnailEntry.request.rendererCapability
                        .webglSupportLevel,
                    rendererRoutingSupportLevel:
                      thumbnailEntry.request.rendererCapability
                        .rendererRoutingSupportLevel,
                    rendererRoutingAllowed:
                      thumbnailEntry.request.rendererCapability
                        .rendererRoutingAllowed,
                    committedPlaybackBypassesRendererRouter:
                      thumbnailEntry.request.rendererCapability
                        .committedPlaybackBypassesRendererRouter,
                    reasons: [
                      ...thumbnailEntry.request.rendererCapability.reasons,
                    ],
                    notes: [...thumbnailEntry.request.rendererCapability.notes],
                  },
                  rendererDecision: {
                    role: thumbnailEntry.request.rendererDecision.role,
                    shouldRouteThroughRenderer:
                      thumbnailEntry.request.rendererDecision
                        .shouldRouteThroughRenderer,
                    bypassesRendererRouter:
                      thumbnailEntry.request.rendererDecision
                        .bypassesRendererRouter,
                    preferredBackendOrder: [
                      ...thumbnailEntry.request.rendererDecision
                        .preferredBackendOrder,
                    ],
                    fallbackBackendOrder: [
                      ...thumbnailEntry.request.rendererDecision
                        .fallbackBackendOrder,
                    ],
                    selectedBackend:
                      thumbnailEntry.request.rendererDecision.selectedBackend,
                    fallbackRequired:
                      thumbnailEntry.request.rendererDecision.fallbackRequired,
                    fallbackReason:
                      thumbnailEntry.request.rendererDecision.fallbackReason,
                    reasons: [
                      ...thumbnailEntry.request.rendererDecision.reasons,
                    ],
                    notes: [...thumbnailEntry.request.rendererDecision.notes],
                  },
                },
          result:
            thumbnailEntry.result === null
              ? null
              : {
                  sourceId: thumbnailEntry.result.sourceId,
                  artifactKey: {
                    cacheKey: thumbnailEntry.result.artifactKey.cacheKey,
                    identityKey: thumbnailEntry.result.artifactKey.identityKey,
                    artifactKind:
                      thumbnailEntry.result.artifactKey.artifactKind,
                    variantKey: thumbnailEntry.result.artifactKey.variantKey,
                    sourceId: thumbnailEntry.result.artifactKey.sourceId,
                  },
                  imageUrl: thumbnailEntry.result.imageUrl,
                  width: thumbnailEntry.result.width,
                  height: thumbnailEntry.result.height,
                  frameTimeMs: thumbnailEntry.result.frameTimeMs,
                  extractedAt: thumbnailEntry.result.extractedAt,
                  wasApproximate: thumbnailEntry.result.wasApproximate,
                  debug: {
                    resolvedLayer: thumbnailEntry.result.debug.resolvedLayer,
                    lookupSteps: thumbnailEntry.result.debug.lookupSteps.map(
                      (
                        lookupStep: (typeof thumbnailEntry.result.debug.lookupSteps)[number],
                      ): (typeof thumbnailEntry.result.debug.lookupSteps)[number] => ({
                        ...lookupStep,
                      }),
                    ),
                    reusedFromVfs: thumbnailEntry.result.debug.reusedFromVfs,
                    fallbackReason: thumbnailEntry.result.debug.fallbackReason,
                    audioPolicyDecision: {
                      audioMode:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .audioMode,
                      fallbackMode:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .fallbackMode,
                      requestedPremiumAttempt:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .requestedPremiumAttempt,
                      usedFallback:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .usedFallback,
                      trackPolicy: {
                        preferPremiumAudio:
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .trackPolicy.preferPremiumAudio,
                        preferDefaultTrack:
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .trackPolicy.preferDefaultTrack,
                        preferredLanguage:
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .trackPolicy.preferredLanguage,
                        preferredChannelLayout:
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .trackPolicy.preferredChannelLayout,
                        allowFallbackStereo:
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .trackPolicy.allowFallbackStereo,
                      },
                      inventorySelectionReason:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .inventorySelectionReason,
                      inventorySnapshot:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .inventorySnapshot === null
                          ? null
                          : MediaInventoryCloner.cloneSnapshot(
                              thumbnailEntry.result.debug.audioPolicyDecision
                                .inventorySnapshot,
                            ),
                      premiumCandidateAvailable:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .premiumCandidateAvailable,
                      selectedAudioTrack:
                        MediaInventoryCloner.cloneAudioTrackInfo(
                          thumbnailEntry.result.debug.audioPolicyDecision
                            .selectedAudioTrack,
                        ),
                      selectedTrackStrategy:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .selectedTrackStrategy,
                      capabilityProfile:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .capabilityProfile === null
                          ? null
                          : {
                              canPlayCommittedAudio:
                                thumbnailEntry.result.debug.audioPolicyDecision
                                  .capabilityProfile.canPlayCommittedAudio,
                              canAttemptPremiumAudio:
                                thumbnailEntry.result.debug.audioPolicyDecision
                                  .capabilityProfile.canAttemptPremiumAudio,
                              canFallbackStereo:
                                thumbnailEntry.result.debug.audioPolicyDecision
                                  .capabilityProfile.canFallbackStereo,
                              canKeepPreviewMuted:
                                thumbnailEntry.result.debug.audioPolicyDecision
                                  .capabilityProfile.canKeepPreviewMuted,
                              canKeepExtractionSilent:
                                thumbnailEntry.result.debug.audioPolicyDecision
                                  .capabilityProfile.canKeepExtractionSilent,
                            },
                      committedPlaybackLane:
                        thumbnailEntry.result.debug.audioPolicyDecision
                          .committedPlaybackLane,
                      reasons: [
                        ...thumbnailEntry.result.debug.audioPolicyDecision
                          .reasons,
                      ],
                      reasonDetails: [
                        ...thumbnailEntry.result.debug.audioPolicyDecision
                          .reasonDetails,
                      ],
                    },
                    extractionAttempt: {
                      requestedStrategy:
                        thumbnailEntry.result.debug.extractionAttempt
                          .requestedStrategy,
                      strategyUsed:
                        thumbnailEntry.result.debug.extractionAttempt
                          .strategyUsed,
                      fallbackBehavior:
                        thumbnailEntry.result.debug.extractionAttempt
                          .fallbackBehavior,
                      qualityIntent:
                        thumbnailEntry.result.debug.extractionAttempt
                          .qualityIntent,
                      timeoutMs:
                        thumbnailEntry.result.debug.extractionAttempt.timeoutMs,
                      firstFrameFastPath:
                        thumbnailEntry.result.debug.extractionAttempt
                          .firstFrameFastPath,
                      representativeSearchOnRejection:
                        thumbnailEntry.result.debug.extractionAttempt
                          .representativeSearchOnRejection,
                      targetTimeSeconds:
                        thumbnailEntry.result.debug.extractionAttempt
                          .targetTimeSeconds,
                      searchWindowStartSeconds:
                        thumbnailEntry.result.debug.extractionAttempt
                          .searchWindowStartSeconds,
                      searchWindowEndSeconds:
                        thumbnailEntry.result.debug.extractionAttempt
                          .searchWindowEndSeconds,
                      candidateWindowMs:
                        thumbnailEntry.result.debug.extractionAttempt
                          .candidateWindowMs,
                      candidateFrameStepMs:
                        thumbnailEntry.result.debug.extractionAttempt
                          .candidateFrameStepMs,
                      maxCandidateFrames:
                        thumbnailEntry.result.debug.extractionAttempt
                          .maxCandidateFrames,
                      maxAttemptCount:
                        thumbnailEntry.result.debug.extractionAttempt
                          .maxAttemptCount,
                      attemptedFrameCount:
                        thumbnailEntry.result.debug.extractionAttempt
                          .attemptedFrameCount,
                      completedFrameCount:
                        thumbnailEntry.result.debug.extractionAttempt
                          .completedFrameCount,
                      timedOut:
                        thumbnailEntry.result.debug.extractionAttempt.timedOut,
                      unsupported:
                        thumbnailEntry.result.debug.extractionAttempt
                          .unsupported,
                      startedAt:
                        thumbnailEntry.result.debug.extractionAttempt.startedAt,
                      finishedAt:
                        thumbnailEntry.result.debug.extractionAttempt
                          .finishedAt,
                      customDecode:
                        thumbnailEntry.result.debug.extractionAttempt
                          .customDecode === null
                          ? null
                          : {
                              ...thumbnailEntry.result.debug.extractionAttempt
                                .customDecode,
                              renderer:
                                thumbnailEntry.result.debug.extractionAttempt
                                  .customDecode.renderer === null
                                  ? null
                                  : {
                                      ...thumbnailEntry.result.debug
                                        .extractionAttempt.customDecode
                                        .renderer,
                                      reasons: [
                                        ...thumbnailEntry.result.debug
                                          .extractionAttempt.customDecode
                                          .renderer.reasons,
                                      ],
                                      notes: [
                                        ...thumbnailEntry.result.debug
                                          .extractionAttempt.customDecode
                                          .renderer.notes,
                                      ],
                                    },
                              notes: [
                                ...thumbnailEntry.result.debug.extractionAttempt
                                  .customDecode.notes,
                              ],
                            },
                    },
                    selectionDecision: {
                      requestedStrategy:
                        thumbnailEntry.result.debug.selectionDecision
                          .requestedStrategy,
                      strategyUsed:
                        thumbnailEntry.result.debug.selectionDecision
                          .strategyUsed,
                      qualityIntent:
                        thumbnailEntry.result.debug.selectionDecision
                          .qualityIntent,
                      fallbackBehavior:
                        thumbnailEntry.result.debug.selectionDecision
                          .fallbackBehavior,
                      selectionReason:
                        thumbnailEntry.result.debug.selectionDecision
                          .selectionReason,
                      resolvedReason:
                        thumbnailEntry.result.debug.selectionDecision
                          .resolvedReason,
                      firstFrameAccepted:
                        thumbnailEntry.result.debug.selectionDecision
                          .firstFrameAccepted,
                      firstFrameRejected:
                        thumbnailEntry.result.debug.selectionDecision
                          .firstFrameRejected,
                      firstFrameRejectionReason:
                        thumbnailEntry.result.debug.selectionDecision
                          .firstFrameRejectionReason,
                      representativeSearchUsed:
                        thumbnailEntry.result.debug.selectionDecision
                          .representativeSearchUsed,
                      representativeTargetTimeMs:
                        thumbnailEntry.result.debug.selectionDecision
                          .representativeTargetTimeMs,
                      representativeWindowStartMs:
                        thumbnailEntry.result.debug.selectionDecision
                          .representativeWindowStartMs,
                      representativeWindowEndMs:
                        thumbnailEntry.result.debug.selectionDecision
                          .representativeWindowEndMs,
                      selectedFrameTimeMs:
                        thumbnailEntry.result.debug.selectionDecision
                          .selectedFrameTimeMs,
                      selectedCandidateIndex:
                        thumbnailEntry.result.debug.selectionDecision
                          .selectedCandidateIndex,
                      attemptedFrameCount:
                        thumbnailEntry.result.debug.selectionDecision
                          .attemptedFrameCount,
                      rejectedFrameCount:
                        thumbnailEntry.result.debug.selectionDecision
                          .rejectedFrameCount,
                      fallbackUsed:
                        thumbnailEntry.result.debug.selectionDecision
                          .fallbackUsed,
                      cachedArtifactReused:
                        thumbnailEntry.result.debug.selectionDecision
                          .cachedArtifactReused,
                      rejectionReasons: [
                        ...thumbnailEntry.result.debug.selectionDecision
                          .rejectionReasons,
                      ],
                      candidateFrames:
                        thumbnailEntry.result.debug.selectionDecision.candidateFrames.map(
                          (
                            candidateFrame: (typeof thumbnailEntry.result.debug.selectionDecision.candidateFrames)[number],
                          ): (typeof thumbnailEntry.result.debug.selectionDecision.candidateFrames)[number] => ({
                            attemptIndex: candidateFrame.attemptIndex,
                            stage: candidateFrame.stage,
                            requestedFrameTimeMs:
                              candidateFrame.requestedFrameTimeMs,
                            frameTimeMs: candidateFrame.frameTimeMs,
                            averageLuma: candidateFrame.averageLuma,
                            darkestSampleLuma: candidateFrame.darkestSampleLuma,
                            brightestSampleLuma:
                              candidateFrame.brightestSampleLuma,
                            darkPixelRatio: candidateFrame.darkPixelRatio,
                            isDecodable: candidateFrame.isDecodable,
                            rejectionReason: candidateFrame.rejectionReason,
                          }),
                        ),
                    },
                    customDecode:
                      thumbnailEntry.result.debug.customDecode === null
                        ? null
                        : {
                            lane: thumbnailEntry.result.debug.customDecode.lane,
                            state:
                              thumbnailEntry.result.debug.customDecode.state,
                            usedCustomDecode:
                              thumbnailEntry.result.debug.customDecode
                                .usedCustomDecode,
                            usedFallback:
                              thumbnailEntry.result.debug.customDecode
                                .usedFallback,
                            fallbackReason:
                              thumbnailEntry.result.debug.customDecode
                                .fallbackReason,
                            failureReason:
                              thumbnailEntry.result.debug.customDecode
                                .failureReason,
                            selectedFrame:
                              thumbnailEntry.result.debug.customDecode
                                .selectedFrame === null
                                ? null
                                : {
                                    ...thumbnailEntry.result.debug.customDecode
                                      .selectedFrame,
                                  },
                            capability:
                              thumbnailEntry.result.debug.customDecode
                                .capability === null
                                ? null
                                : {
                                    ...thumbnailEntry.result.debug.customDecode
                                      .capability,
                                    reasons: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.capability.reasons,
                                    ],
                                    notes: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.capability.notes,
                                    ],
                                  },
                            decision:
                              thumbnailEntry.result.debug.customDecode
                                .decision === null
                                ? null
                                : {
                                    ...thumbnailEntry.result.debug.customDecode
                                      .decision,
                                    reasons: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.decision.reasons,
                                    ],
                                    notes: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.decision.notes,
                                    ],
                                  },
                            renderer:
                              thumbnailEntry.result.debug.customDecode
                                .renderer === null
                                ? null
                                : {
                                    ...thumbnailEntry.result.debug.customDecode
                                      .renderer,
                                    reasons: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.renderer.reasons,
                                    ],
                                    notes: [
                                      ...thumbnailEntry.result.debug
                                        .customDecode.renderer.notes,
                                    ],
                                  },
                            notes: [
                              ...thumbnailEntry.result.debug.customDecode.notes,
                            ],
                          },
                    renderer:
                      thumbnailEntry.result.debug.renderer === null
                        ? null
                        : {
                            capability:
                              thumbnailEntry.result.debug.renderer
                                .capability === null
                                ? null
                                : {
                                    role: thumbnailEntry.result.debug.renderer
                                      .capability.role,
                                    webgpuSupportLevel:
                                      thumbnailEntry.result.debug.renderer
                                        .capability.webgpuSupportLevel,
                                    webglSupportLevel:
                                      thumbnailEntry.result.debug.renderer
                                        .capability.webglSupportLevel,
                                    rendererRoutingSupportLevel:
                                      thumbnailEntry.result.debug.renderer
                                        .capability.rendererRoutingSupportLevel,
                                    rendererRoutingAllowed:
                                      thumbnailEntry.result.debug.renderer
                                        .capability.rendererRoutingAllowed,
                                    committedPlaybackBypassesRendererRouter:
                                      thumbnailEntry.result.debug.renderer
                                        .capability
                                        .committedPlaybackBypassesRendererRouter,
                                    reasons: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .capability.reasons,
                                    ],
                                    notes: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .capability.notes,
                                    ],
                                  },
                            decision:
                              thumbnailEntry.result.debug.renderer.decision ===
                              null
                                ? null
                                : {
                                    role: thumbnailEntry.result.debug.renderer
                                      .decision.role,
                                    shouldRouteThroughRenderer:
                                      thumbnailEntry.result.debug.renderer
                                        .decision.shouldRouteThroughRenderer,
                                    bypassesRendererRouter:
                                      thumbnailEntry.result.debug.renderer
                                        .decision.bypassesRendererRouter,
                                    preferredBackendOrder: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .decision.preferredBackendOrder,
                                    ],
                                    fallbackBackendOrder: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .decision.fallbackBackendOrder,
                                    ],
                                    selectedBackend:
                                      thumbnailEntry.result.debug.renderer
                                        .decision.selectedBackend,
                                    fallbackRequired:
                                      thumbnailEntry.result.debug.renderer
                                        .decision.fallbackRequired,
                                    fallbackReason:
                                      thumbnailEntry.result.debug.renderer
                                        .decision.fallbackReason,
                                    reasons: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .decision.reasons,
                                    ],
                                    notes: [
                                      ...thumbnailEntry.result.debug.renderer
                                        .decision.notes,
                                    ],
                                  },
                            binding:
                              thumbnailEntry.result.debug.renderer.binding ===
                              null
                                ? null
                                : {
                                    sessionId:
                                      thumbnailEntry.result.debug.renderer
                                        .binding.sessionId,
                                    sessionRole:
                                      thumbnailEntry.result.debug.renderer
                                        .binding.sessionRole,
                                    variantRole:
                                      thumbnailEntry.result.debug.renderer
                                        .binding.variantRole,
                                    backendKind:
                                      thumbnailEntry.result.debug.renderer
                                        .binding.backendKind,
                                    target:
                                      thumbnailEntry.result.debug.renderer
                                        .binding.target,
                                  },
                            selectedBackend:
                              thumbnailEntry.result.debug.renderer
                                .selectedBackend,
                            activeBackend:
                              thumbnailEntry.result.debug.renderer
                                .activeBackend,
                            usedLegacyPath:
                              thumbnailEntry.result.debug.renderer
                                .usedLegacyPath,
                            bypassedRendererRouter:
                              thumbnailEntry.result.debug.renderer
                                .bypassedRendererRouter,
                            fallbackReason:
                              thumbnailEntry.result.debug.renderer
                                .fallbackReason,
                            failureReason:
                              thumbnailEntry.result.debug.renderer
                                .failureReason,
                            frameHandle:
                              thumbnailEntry.result.debug.renderer
                                .frameHandle === null
                                ? null
                                : {
                                    representation:
                                      thumbnailEntry.result.debug.renderer
                                        .frameHandle.representation,
                                    origin:
                                      thumbnailEntry.result.debug.renderer
                                        .frameHandle.origin,
                                    width:
                                      thumbnailEntry.result.debug.renderer
                                        .frameHandle.width,
                                    height:
                                      thumbnailEntry.result.debug.renderer
                                        .frameHandle.height,
                                    frameTimeMs:
                                      thumbnailEntry.result.debug.renderer
                                        .frameHandle.frameTimeMs,
                                  },
                            reasons: [
                              ...thumbnailEntry.result.debug.renderer.reasons,
                            ],
                            notes: [
                              ...thumbnailEntry.result.debug.renderer.notes,
                            ],
                          },
                  },
                },
          failureReason: thumbnailEntry.failureReason,
          isRelevant: thumbnailEntry.isRelevant,
          lastRequestedAt: thumbnailEntry.lastRequestedAt,
          lastUpdatedAt: thumbnailEntry.lastUpdatedAt,
        }),
      ),
      requestedSourceIds: [...thumbnailSnapshot.requestedSourceIds],
      cachedSourceIds: [...thumbnailSnapshot.cachedSourceIds],
      readySourceIds: [...thumbnailSnapshot.readySourceIds],
      failedSourceIds: [...thumbnailSnapshot.failedSourceIds],
      unsupportedSourceIds: [...thumbnailSnapshot.unsupportedSourceIds],
    };

    for (const [itemId, thumbnailBindings] of this
      .thumbnailCardBindingsByItemId) {
      const thumbnailEntry: MediaThumbnailCacheEntry | null =
        this.findThumbnailEntryForItemId(itemId);

      for (const thumbnailBinding of thumbnailBindings) {
        this.applyThumbnailEntry(thumbnailBinding, thumbnailEntry);
      }
    }
  }

  /**
   * @brief Create the overlay UI root element
   *
   * @returns DOM element used as the overlay UI root
   */
  private createOverlayUiElement(): HTMLDivElement {
    const overlayUiElement: HTMLDivElement = document.createElement("div");

    overlayUiElement.className = "browse-overlay";

    return overlayUiElement;
  }

  /**
   * @brief Create the full browse overlay DOM tree from shared content
   *
   * @param browseContent - Shared browse content prepared by the core adapter
   *
   * @returns DOM subtree rendered inside the overlay UI plane
   */
  private createBrowseOverlayElement(
    browseContent: BrowseScreenContent,
  ): HTMLDivElement {
    const browseOverlayRootElement: HTMLDivElement =
      document.createElement("div");
    const heroContent: BrowseHeroContent | null = browseContent.hero;
    const browseRowsElement: HTMLDivElement = document.createElement("div");

    browseOverlayRootElement.className = "browse-overlay-root";
    browseRowsElement.className = "browse-rows";

    if (heroContent !== null) {
      browseOverlayRootElement.append(
        this.createHeroSectionElement(heroContent),
      );
    }

    for (const [rowIndex, browseRow] of browseContent.rows.entries()) {
      browseRowsElement.append(
        this.createBrowseRowElement(browseRow, rowIndex),
      );
    }

    browseOverlayRootElement.append(browseRowsElement);

    return browseOverlayRootElement;
  }

  /**
   * @brief Create the hero section shown above the browse rows
   *
   * @param heroContent - Shared browse hero content
   *
   * @returns DOM element representing the hero area
   */
  private createHeroSectionElement(
    heroContent: BrowseHeroContent,
  ): HTMLElement {
    const heroSectionElement: HTMLElement = document.createElement("section");
    const heroTextColumnElement: HTMLDivElement = document.createElement("div");
    const titleElement: HTMLHeadingElement = document.createElement("h1");
    const viewCountElement: HTMLParagraphElement = document.createElement("p");
    const descriptionElement: HTMLParagraphElement =
      document.createElement("p");
    const metadataRowElement: HTMLDivElement = document.createElement("div");

    heroSectionElement.className = "browse-hero";
    heroTextColumnElement.className = "browse-hero-text";
    titleElement.className = "browse-hero-title";
    viewCountElement.className = "browse-hero-view-count";
    descriptionElement.className = "browse-hero-description";
    metadataRowElement.className = "browse-metadata-row";

    titleElement.textContent = heroContent.title;
    viewCountElement.textContent = heroContent.viewCount;
    descriptionElement.textContent = heroContent.description;

    for (const metadataEntry of heroContent.metadataEntries) {
      metadataRowElement.append(this.createMetadataEntryElement(metadataEntry));
    }

    heroTextColumnElement.append(
      titleElement,
      viewCountElement,
      descriptionElement,
      metadataRowElement,
    );
    heroSectionElement.append(heroTextColumnElement);

    return heroSectionElement;
  }

  /**
   * @brief Create a single ordered hero metadata element
   *
   * @param metadataEntry - Shared metadata entry already ordered by the core adapter
   *
   * @returns DOM element representing the created label or a boxed tag
   */
  private createMetadataEntryElement(
    metadataEntry: BrowseMetadataEntry,
  ): HTMLDivElement {
    if (metadataEntry.kind === "calendar") {
      const calendarItemElement: HTMLDivElement = document.createElement("div");
      const calendarIconElement: HTMLSpanElement =
        document.createElement("span");
      const calendarTextElement: HTMLSpanElement =
        document.createElement("span");

      calendarItemElement.className = "browse-calendar-item";
      calendarIconElement.className = "browse-calendar-icon";
      calendarTextElement.className = "browse-calendar-text";
      calendarTextElement.textContent = metadataEntry.value;
      calendarItemElement.append(calendarIconElement, calendarTextElement);

      return calendarItemElement;
    }

    const tagElement: HTMLDivElement = document.createElement("div");

    tagElement.className = "browse-metadata-tag";
    tagElement.textContent = metadataEntry.value;

    return tagElement;
  }

  /**
   * @brief Create one horizontal browse rail with thumbnail cards
   *
   * @param browseRow - Shared browse row content sourced from the catalog
   *
   * @returns DOM element representing one browse row
   */
  private createBrowseRowElement(
    browseRow: BrowseRowContent,
    rowIndex: number,
  ): HTMLElement {
    const browseRowElement: HTMLElement = document.createElement("section");
    const rowTitleElement: HTMLHeadingElement = document.createElement("h2");
    const rowTrackElement: HTMLDivElement = document.createElement("div");
    const thumbnailCardElements: HTMLElement[] = [];

    browseRowElement.className = "browse-row";
    rowTitleElement.className = "browse-row-title";
    rowTrackElement.className = "browse-row-track";
    rowTitleElement.textContent = browseRow.title;

    for (const [itemIndex, thumbnailContent] of browseRow.items.entries()) {
      const thumbnailCardElement: HTMLElement = this.createThumbnailCardElement(
        thumbnailContent,
        rowIndex,
        itemIndex,
      );

      thumbnailCardElements.push(thumbnailCardElement);
      rowTrackElement.append(thumbnailCardElement);
    }

    this.thumbnailCardElements[rowIndex] = thumbnailCardElements;
    browseRowElement.append(rowTitleElement, rowTrackElement);

    return browseRowElement;
  }

  /**
   * @brief Create one thumbnail card shown inside a browse rail
   *
   * @param thumbnailContent - Shared thumbnail content prepared by the core adapter
   *
   * @returns DOM element representing one thumbnail card
   */
  private createThumbnailCardElement(
    thumbnailContent: BrowseThumbnailContent,
    rowIndex: number,
    itemIndex: number,
  ): HTMLElement {
    const thumbnailCardElement: HTMLElement = document.createElement("article");
    const artworkElement: HTMLDivElement = document.createElement("div");
    const stillImageElement: HTMLImageElement = document.createElement("img");
    const previewHostElement: HTMLDivElement = document.createElement("div");
    const monogramElement: HTMLParagraphElement = document.createElement("p");
    const titleElement: HTMLParagraphElement = document.createElement("p");
    const metaElement: HTMLParagraphElement = document.createElement("p");
    const thumbnailBindings: WebThumbnailCardBinding[] =
      this.thumbnailCardBindingsByItemId.get(thumbnailContent.id) ?? [];

    thumbnailCardElement.className = "browse-thumbnail-card";
    artworkElement.className = "browse-thumbnail-artwork";
    stillImageElement.className = "browse-thumbnail-still";
    previewHostElement.className = "browse-thumbnail-preview-slot";
    titleElement.className = "browse-thumbnail-title";
    metaElement.className = "browse-thumbnail-meta";
    monogramElement.className = "browse-thumbnail-monogram";

    artworkElement.dataset.placeholderKey =
      thumbnailContent.artwork.placeholderKey;
    stillImageElement.alt = `${thumbnailContent.title} still`;
    previewHostElement.dataset.itemId = thumbnailContent.id;
    thumbnailCardElement.dataset.rowIndex = `${rowIndex}`;
    thumbnailCardElement.dataset.itemIndex = `${itemIndex}`;
    thumbnailCardElement.dataset.thumbnailItemId = thumbnailContent.id;
    thumbnailCardElement.dataset.thumbnailVisualState = "fallback";
    monogramElement.textContent = thumbnailContent.artwork.placeholderMonogram;
    titleElement.textContent = thumbnailContent.title;
    metaElement.textContent = thumbnailContent.secondaryText;
    artworkElement.append(
      stillImageElement,
      previewHostElement,
      monogramElement,
    );
    thumbnailCardElement.append(artworkElement, titleElement, metaElement);
    this.previewSurfaceEntries.push({
      itemId: thumbnailContent.id,
      hostElement: previewHostElement,
    });
    thumbnailBindings.push({
      itemId: thumbnailContent.id,
      cardElement: thumbnailCardElement,
      artworkElement,
      stillImageElement,
      previewHostElement,
    });
    this.thumbnailCardBindingsByItemId.set(
      thumbnailContent.id,
      thumbnailBindings,
    );
    this.applyThumbnailEntry(
      thumbnailBindings[thumbnailBindings.length - 1]!,
      this.findThumbnailEntryForItemId(thumbnailContent.id),
    );

    return thumbnailCardElement;
  }

  /**
   * @brief Resolve one thumbnail cache entry by browse item identifier
   *
   * @param itemId - Stable browse item identifier
   *
   * @returns Matching cache entry, or `null` when the item has no still yet
   */
  private findThumbnailEntryForItemId(
    itemId: string,
  ): MediaThumbnailCacheEntry | null {
    for (const thumbnailEntry of this.thumbnailSnapshot.entries) {
      if (thumbnailEntry.descriptor.itemIds.includes(itemId)) {
        return thumbnailEntry;
      }
    }

    return null;
  }

  /**
   * @brief Apply one thumbnail cache entry to a rendered card binding
   *
   * @param thumbnailBinding - Rendered card DOM binding
   * @param thumbnailEntry - Current shared thumbnail cache entry for the item
   */
  private applyThumbnailEntry(
    thumbnailBinding: WebThumbnailCardBinding,
    thumbnailEntry: MediaThumbnailCacheEntry | null,
  ): void {
    const availableThumbnailResult = thumbnailEntry?.result ?? null;
    const hasAvailableStill: boolean = availableThumbnailResult !== null;
    const isPreviewActive: boolean =
      thumbnailBinding.previewHostElement.classList.contains("is-active");

    thumbnailBinding.cardElement.dataset.thumbnailState =
      thumbnailEntry?.state ?? "idle";
    thumbnailBinding.cardElement.dataset.thumbnailSourceId =
      thumbnailEntry?.descriptor.sourceId ?? "";
    thumbnailBinding.cardElement.dataset.thumbnailStrategy =
      thumbnailEntry?.request?.extractionPolicy.strategy ??
      availableThumbnailResult?.debug.selectionDecision.strategyUsed ??
      "";
    thumbnailBinding.cardElement.dataset.thumbnailQualityIntent =
      thumbnailEntry?.request?.extractionPolicy.qualityIntent ??
      availableThumbnailResult?.debug.selectionDecision.qualityIntent ??
      "";
    thumbnailBinding.cardElement.dataset.thumbnailSelectionReason =
      availableThumbnailResult?.debug.selectionDecision.resolvedReason ?? "";
    thumbnailBinding.cardElement.dataset.thumbnailCandidateCount = `${availableThumbnailResult?.debug.selectionDecision.attemptedFrameCount ?? 0}`;
    thumbnailBinding.cardElement.dataset.thumbnailSelectedFrameTimeMs = `${availableThumbnailResult?.debug.selectionDecision.selectedFrameTimeMs ?? ""}`;
    thumbnailBinding.cardElement.dataset.thumbnailFallbackUsed = `${availableThumbnailResult?.debug.selectionDecision.fallbackUsed ?? false}`;

    if (hasAvailableStill && availableThumbnailResult !== null) {
      if (
        thumbnailBinding.stillImageElement.getAttribute("src") !==
        availableThumbnailResult.imageUrl
      ) {
        thumbnailBinding.stillImageElement.src =
          availableThumbnailResult.imageUrl;
      }

      thumbnailBinding.stillImageElement.classList.add("is-ready");
      thumbnailBinding.artworkElement.classList.add("has-still");
    } else {
      thumbnailBinding.stillImageElement.removeAttribute("src");
      thumbnailBinding.stillImageElement.classList.remove("is-ready");
      thumbnailBinding.artworkElement.classList.remove("has-still");
    }

    thumbnailBinding.cardElement.dataset.thumbnailVisualState = isPreviewActive
      ? "preview"
      : hasAvailableStill
        ? "still"
        : "fallback";
  }

  /**
   * @brief Create a fullscreen plane that centers a single overlay child
   *
   * @param className - Plane-specific CSS class name
   * @param isAccessible - Whether assistive technology should read this plane
   *
   * @returns DOM element that centers its child across the viewport
   */
  private createOverlayPlaneElement(
    className: string,
    isAccessible: boolean,
  ): HTMLDivElement {
    const overlayPlaneElement: HTMLDivElement = document.createElement("div");

    overlayPlaneElement.className = className;

    if (!isAccessible) {
      overlayPlaneElement.setAttribute("aria-hidden", "true");
    }

    return overlayPlaneElement;
  }
}
