/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey, CacheTier } from "../cache/CacheTypes";
import type {
  PersistenceRecord,
  PersistenceWriteRequest,
} from "../persistence/PersistenceTypes";

const SERVICE_WORKER_CACHE_NAME: string = "meditation-surf-vfs-startup-v1";
/**
 * @brief Debug event emitted by the generic VFS service-worker coordinator
 */
export type VfsServiceWorkerEvent = {
  requestUrl: string;
  cacheKey: CacheKey;
  eventType: "lookup" | "miss" | "write-through" | "bypass";
  tier: CacheTier;
  recordedAt: number;
  detail: string | null;
};

/**
 * @brief Immutable debug snapshot exposed by the service-worker coordinator
 */
export type VfsServiceWorkerSnapshot = {
  cacheName: string;
  hasActiveController: boolean;
  supportsCacheStorage: boolean;
  supportsNavigatorServiceWorker: boolean;
  registrationScope: string | null;
  events: VfsServiceWorkerEvent[];
  generatedAt: number;
};

/**
 * @brief Generic coordinator that records storage lookups and write-through work
 */
export class VfsServiceWorkerCoordinator {
  private readonly events: VfsServiceWorkerEvent[];

  /**
   * @brief Build the generic service-worker coordinator
   */
  public constructor() {
    this.events = [];
  }

  /**
   * @brief Return the shared CacheStorage namespace used for startup artifacts
   *
   * @returns Stable CacheStorage namespace
   */
  public getCacheName(): string {
    return SERVICE_WORKER_CACHE_NAME;
  }

  /**
   * @brief Register the default VFS service worker when the browser supports it
   *
   * @param workerUrl - Service worker URL to register
   *
   * @returns Registration, or `null` when registration was unavailable
   */
  public async registerDefaultWorker(
    workerUrl: string = "/vfs-service-worker.js",
  ): Promise<ServiceWorkerRegistration | null> {
    if (!this.supportsNavigatorServiceWorker()) {
      return null;
    }

    try {
      const serviceWorkerContainer: ServiceWorkerContainer =
        globalThis.navigator.serviceWorker;
      const registration: ServiceWorkerRegistration =
        await serviceWorkerContainer.register(workerUrl);

      await serviceWorkerContainer.ready;

      return registration;
    } catch (error: unknown) {
      this.recordEvent(
        workerUrl,
        "service-worker-registration",
        "unsupported",
        "bypass",
        error instanceof Error
          ? error.message
          : "Service worker registration failed.",
      );

      return null;
    }
  }

  /**
   * @brief Resolve one record from service-worker-owned CacheStorage
   *
   * @param cacheKey - Stable cache key being resolved
   * @param requestUrl - Debug URL associated with the lookup
   *
   * @returns Stored record, or `null` when absent
   */
  public async getRecord(
    cacheKey: CacheKey,
    requestUrl: string,
  ): Promise<PersistenceRecord | null> {
    const cacheStorage: Cache | null = await this.tryOpenCacheStorage();

    if (cacheStorage === null) {
      this.recordEvent(
        requestUrl,
        cacheKey,
        "unsupported",
        "bypass",
        "CacheStorage was unavailable, so the service-worker layer was bypassed.",
      );
      return null;
    }

    const cacheRequest: Request = this.createSyntheticRequest(cacheKey);
    const cachedResponse: Response | null =
      (await cacheStorage.match(cacheRequest)) ?? null;

    if (cachedResponse === null) {
      this.recordEvent(
        requestUrl,
        cacheKey,
        "persistent",
        "miss",
        "Service worker cache did not contain this VFS artifact.",
      );
      return null;
    }

    const persistenceRecord: PersistenceRecord = await this.deserializeResponse(
      cacheKey,
      cachedResponse,
    );

    this.recordEvent(
      requestUrl,
      cacheKey,
      persistenceRecord.tier,
      "lookup",
      "Service worker cache returned a VFS-backed artifact.",
    );

    return persistenceRecord;
  }

  /**
   * @brief Store one VFS record into service-worker-owned CacheStorage
   *
   * @param record - Record being written through into CacheStorage
   * @param requestUrl - Debug URL associated with the write
   */
  public async putRecord(
    record: PersistenceWriteRequest,
    requestUrl: string,
  ): Promise<void> {
    const cacheStorage: Cache | null = await this.tryOpenCacheStorage();

    if (cacheStorage === null) {
      this.recordEvent(
        requestUrl,
        record.key,
        "unsupported",
        "bypass",
        "CacheStorage was unavailable, so the service-worker layer was bypassed.",
      );
      return;
    }

    const response: Response = await this.serializeRecord(record);
    const cacheRequest: Request = this.createSyntheticRequest(record.key);

    await cacheStorage.put(cacheRequest, response);

    this.recordEvent(
      requestUrl,
      record.key,
      record.tier,
      "write-through",
      "VFS wrote this artifact through into service-worker CacheStorage.",
    );
  }

  /**
   * @brief Delete one VFS record from service-worker-owned CacheStorage
   *
   * @param cacheKey - Stable cache key being removed
   */
  public async deleteRecord(cacheKey: CacheKey): Promise<void> {
    const cacheStorage: Cache | null = await this.tryOpenCacheStorage();

    if (cacheStorage === null) {
      return;
    }

    const cacheRequest: Request = this.createSyntheticRequest(cacheKey);

    await cacheStorage.delete(cacheRequest);
  }

  /**
   * @brief Record one service-worker storage lookup
   *
   * @param requestUrl - Request URL observed by the runtime
   * @param cacheKey - Stable storage key consulted by VFS
   * @param tier - Tier consulted for the request
   * @param eventType - Lookup outcome that was observed
   * @param detail - Optional human-readable detail
   */
  public recordEvent(
    requestUrl: string,
    cacheKey: CacheKey,
    tier: CacheTier,
    eventType: VfsServiceWorkerEvent["eventType"],
    detail: string | null = null,
  ): void {
    this.events.push({
      requestUrl,
      cacheKey,
      eventType,
      tier,
      recordedAt: Date.now(),
      detail,
    });
  }

  /**
   * @brief Return the immutable service-worker debug snapshot
   *
   * @returns Snapshot of recorded storage events
   */
  public getSnapshot(): VfsServiceWorkerSnapshot {
    return {
      cacheName: this.getCacheName(),
      hasActiveController: this.hasActiveController(),
      supportsCacheStorage: this.supportsCacheStorage(),
      supportsNavigatorServiceWorker: this.supportsNavigatorServiceWorker(),
      registrationScope: this.resolveRegistrationScope(),
      events: this.events.map(
        (event: VfsServiceWorkerEvent): VfsServiceWorkerEvent => ({
          ...event,
        }),
      ),
      generatedAt: Date.now(),
    };
  }

  /**
   * @brief Clear every recorded debug event
   */
  public reset(): void {
    this.events.length = 0;
  }

  /**
   * @brief Return whether CacheStorage is available in the current runtime
   *
   * @returns `true` when CacheStorage can be used
   */
  private supportsCacheStorage(): boolean {
    return typeof globalThis.caches !== "undefined";
  }

  /**
   * @brief Return whether navigator.serviceWorker is available in this runtime
   *
   * @returns `true` when service workers are supported
   */
  private supportsNavigatorServiceWorker(): boolean {
    return (
      typeof globalThis.navigator !== "undefined" &&
      "serviceWorker" in globalThis.navigator &&
      globalThis.navigator.serviceWorker !== undefined
    );
  }

  /**
   * @brief Return whether the current page is controlled by a service worker
   *
   * @returns `true` when a service worker controller is active
   */
  private hasActiveController(): boolean {
    return this.supportsNavigatorServiceWorker()
      ? globalThis.navigator.serviceWorker.controller !== null
      : false;
  }

  /**
   * @brief Resolve the current registration scope when a controller exists
   *
   * @returns Registration scope, or `null` when unknown
   */
  private resolveRegistrationScope(): string | null {
    if (!this.hasActiveController()) {
      return null;
    }

    return globalThis.navigator.serviceWorker.controller?.scriptURL ?? null;
  }

  /**
   * @brief Open the shared CacheStorage namespace when the runtime supports it
   *
   * @returns Open CacheStorage handle, or `null` when unsupported
   */
  private async tryOpenCacheStorage(): Promise<Cache | null> {
    if (!this.supportsCacheStorage()) {
      return null;
    }

    return await globalThis.caches.open(this.getCacheName());
  }

  /**
   * @brief Build one synthetic request used for service-worker cache entries
   *
   * @param cacheKey - Stable VFS cache key being addressed
   *
   * @returns Synthetic request used as the CacheStorage lookup key
   */
  private createSyntheticRequest(cacheKey: CacheKey): Request {
    const baseUrl: string =
      typeof globalThis.location !== "undefined"
        ? globalThis.location.origin
        : "https://meditation.surf";
    const syntheticUrl: string = `${baseUrl}/__meditation_surf_vfs__/${encodeURIComponent(cacheKey)}`;

    return new Request(syntheticUrl, {
      method: "GET",
    });
  }

  /**
   * @brief Serialize one persistence record into a CacheStorage response
   *
   * @param record - Persisted record being stored
   *
   * @returns Serializable response body
   */
  private async serializeRecord(
    record: PersistenceWriteRequest,
  ): Promise<Response> {
    const bodyBlob: Blob =
      record.body instanceof Blob
        ? record.body
        : new Blob([record.body], {
            type: record.contentType ?? "text/plain",
          });
    const responseHeaders: Headers = new Headers({
      "content-type": record.contentType ?? "application/octet-stream",
      "x-ms-vfs-body-kind": record.bodyKind,
      "x-ms-vfs-byte-length": `${record.byteLength ?? bodyBlob.size}`,
      "x-ms-vfs-content-type": record.contentType ?? "",
      "x-ms-vfs-created-at": `${record.createdAt}`,
      "x-ms-vfs-last-accessed-at": `${record.lastAccessedAt}`,
      "x-ms-vfs-metadata": JSON.stringify(record.metadata),
      "x-ms-vfs-tier": record.tier,
      "x-ms-vfs-updated-at": `${record.updatedAt}`,
    });

    return new Response(bodyBlob, {
      headers: responseHeaders,
    });
  }

  /**
   * @brief Deserialize one CacheStorage response into a persistence record
   *
   * @param cacheKey - Stable cache key associated with the response
   * @param response - Cached response being rehydrated
   *
   * @returns Persistence record rebuilt from cached response headers and body
   */
  private async deserializeResponse(
    cacheKey: CacheKey,
    response: Response,
  ): Promise<PersistenceRecord> {
    const bodyKind: "blob" | "text" =
      response.headers.get("x-ms-vfs-body-kind") === "text" ? "text" : "blob";
    const responseBlob: Blob = await response.blob();
    const body: Blob | string =
      bodyKind === "text" ? await responseBlob.text() : responseBlob;
    const metadataRaw: string =
      response.headers.get("x-ms-vfs-metadata") ?? "{}";
    const metadataValue: unknown = JSON.parse(metadataRaw);
    const metadata: Record<string, boolean | number | string | null> =
      typeof metadataValue === "object" && metadataValue !== null
        ? (metadataValue as Record<string, boolean | number | string | null>)
        : {};

    return {
      key: cacheKey,
      tier:
        (response.headers.get("x-ms-vfs-tier") as CacheTier | null) ??
        "persistent",
      contentType: response.headers.get("x-ms-vfs-content-type"),
      metadata,
      body,
      bodyKind,
      createdAt: Number(
        response.headers.get("x-ms-vfs-created-at") ?? Date.now(),
      ),
      updatedAt: Number(
        response.headers.get("x-ms-vfs-updated-at") ?? Date.now(),
      ),
      lastAccessedAt: Number(
        response.headers.get("x-ms-vfs-last-accessed-at") ?? Date.now(),
      ),
      byteLength: Number(
        response.headers.get("x-ms-vfs-byte-length") ?? responseBlob.size,
      ),
    };
  }
}
