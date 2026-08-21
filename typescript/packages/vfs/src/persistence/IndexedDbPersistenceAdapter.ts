/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey } from "../cache/CacheTypes";
import { MemoryPersistenceAdapter } from "./MemoryPersistenceAdapter";
import type {
  PersistenceAdapter,
  PersistenceRecord,
  PersistenceWriteRequest,
} from "./PersistenceTypes";

type IndexedDbStoredRecord = PersistenceRecord & {
  id: CacheKey;
};

/**
 * @brief IndexedDB-backed persistence adapter with a safe in-memory fallback
 */
export class IndexedDbPersistenceAdapter implements PersistenceAdapter {
  private static readonly DATABASE_VERSION: number = 1;
  private static readonly OBJECT_STORE_NAME: string = "entries";

  private readonly databaseName: string;
  private readonly fallbackAdapter: MemoryPersistenceAdapter;

  private databasePromise: Promise<IDBDatabase> | null;

  /**
   * @brief Build the IndexedDB-backed persistence adapter
   *
   * @param databaseName - Stable IndexedDB database name
   */
  public constructor(databaseName: string = "meditation-surf-vfs") {
    this.databaseName = databaseName;
    this.fallbackAdapter = new MemoryPersistenceAdapter();
    this.databasePromise = null;
  }

  /**
   * @inheritdoc
   */
  public async get(key: CacheKey): Promise<PersistenceRecord | null> {
    const database: IDBDatabase | null = await this.tryOpenDatabase();

    if (database === null) {
      return this.fallbackAdapter.get(key);
    }

    const storedRecord: IndexedDbStoredRecord | null =
      await new Promise<IndexedDbStoredRecord | null>(
        (
          resolve: (value: IndexedDbStoredRecord | null) => void,
          reject: (reason?: unknown) => void,
        ): void => {
          const transaction: IDBTransaction = database.transaction(
            IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
            "readonly",
          );
          const objectStore: IDBObjectStore = transaction.objectStore(
            IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
          );
          const request: IDBRequest = objectStore.get(key);

          request.addEventListener("success", (): void => {
            const result: IndexedDbStoredRecord | undefined = request.result as
              | IndexedDbStoredRecord
              | undefined;

            resolve(result ?? null);
          });
          request.addEventListener("error", (): void => {
            reject(request.error);
          });
        },
      );

    if (storedRecord === null) {
      return null;
    }

    const touchedRecord: PersistenceWriteRequest = {
      key: storedRecord.key,
      tier: storedRecord.tier,
      contentType: storedRecord.contentType,
      metadata: {
        ...storedRecord.metadata,
      },
      body: storedRecord.body,
      bodyKind: storedRecord.bodyKind,
      createdAt: storedRecord.createdAt,
      updatedAt: storedRecord.updatedAt,
      lastAccessedAt: Date.now(),
      byteLength: storedRecord.byteLength,
    };

    return this.put(touchedRecord);
  }

  /**
   * @inheritdoc
   */
  public async put(
    record: PersistenceWriteRequest,
  ): Promise<PersistenceRecord> {
    const database: IDBDatabase | null = await this.tryOpenDatabase();

    if (database === null) {
      return this.fallbackAdapter.put(record);
    }

    const storedRecord: IndexedDbStoredRecord = {
      ...record,
      id: record.key,
    };

    await new Promise<void>(
      (resolve: () => void, reject: (reason?: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
          "readwrite",
        );
        const objectStore: IDBObjectStore = transaction.objectStore(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
        );
        const request: IDBRequest = objectStore.put(storedRecord);

        request.addEventListener("success", (): void => {
          resolve();
        });
        request.addEventListener("error", (): void => {
          reject(request.error);
        });
      },
    );

    return {
      ...record,
      metadata: {
        ...record.metadata,
      },
    };
  }

  /**
   * @inheritdoc
   */
  public async delete(key: CacheKey): Promise<void> {
    const database: IDBDatabase | null = await this.tryOpenDatabase();

    if (database === null) {
      return this.fallbackAdapter.delete(key);
    }

    await new Promise<void>(
      (resolve: () => void, reject: (reason?: unknown) => void): void => {
        const transaction: IDBTransaction = database.transaction(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
          "readwrite",
        );
        const objectStore: IDBObjectStore = transaction.objectStore(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
        );
        const request: IDBRequest = objectStore.delete(key);

        request.addEventListener("success", (): void => {
          resolve();
        });
        request.addEventListener("error", (): void => {
          reject(request.error);
        });
      },
    );
  }

  /**
   * @inheritdoc
   */
  public async list(keyPrefix?: string): Promise<PersistenceRecord[]> {
    const database: IDBDatabase | null = await this.tryOpenDatabase();

    if (database === null) {
      return this.fallbackAdapter.list(keyPrefix);
    }

    const prefix: string = keyPrefix ?? "";
    const storedRecords: IndexedDbStoredRecord[] = await new Promise<
      IndexedDbStoredRecord[]
    >(
      (
        resolve: (value: IndexedDbStoredRecord[]) => void,
        reject: (reason?: unknown) => void,
      ): void => {
        const transaction: IDBTransaction = database.transaction(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
          "readonly",
        );
        const objectStore: IDBObjectStore = transaction.objectStore(
          IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
        );
        const request: IDBRequest = objectStore.getAll();

        request.addEventListener("success", (): void => {
          const result: IndexedDbStoredRecord[] =
            (request.result as IndexedDbStoredRecord[]) ?? [];

          resolve(result);
        });
        request.addEventListener("error", (): void => {
          reject(request.error);
        });
      },
    );

    return storedRecords
      .filter((record: IndexedDbStoredRecord): boolean =>
        record.key.startsWith(prefix),
      )
      .map(
        (record: IndexedDbStoredRecord): PersistenceRecord => ({
          ...record,
          metadata: {
            ...record.metadata,
          },
        }),
      );
  }

  /**
   * @inheritdoc
   */
  public async clear(keyPrefix?: string): Promise<void> {
    const prefix: string = keyPrefix ?? "";

    if (prefix.length === 0) {
      const database: IDBDatabase | null = await this.tryOpenDatabase();

      if (database === null) {
        return this.fallbackAdapter.clear();
      }

      await new Promise<void>(
        (resolve: () => void, reject: (reason?: unknown) => void): void => {
          const transaction: IDBTransaction = database.transaction(
            IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
            "readwrite",
          );
          const objectStore: IDBObjectStore = transaction.objectStore(
            IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
          );
          const request: IDBRequest = objectStore.clear();

          request.addEventListener("success", (): void => {
            resolve();
          });
          request.addEventListener("error", (): void => {
            reject(request.error);
          });
        },
      );
      return;
    }

    const matchingRecords: PersistenceRecord[] = await this.list(prefix);

    await Promise.all(
      matchingRecords.map(
        (record: PersistenceRecord): Promise<void> => this.delete(record.key),
      ),
    );
  }

  /**
   * @brief Open the IndexedDB database when the runtime supports it
   *
   * @returns Open database, or `null` when IndexedDB is unavailable
   */
  private async tryOpenDatabase(): Promise<IDBDatabase | null> {
    if (typeof globalThis.indexedDB === "undefined") {
      return null;
    }

    if (this.databasePromise === null) {
      this.databasePromise = new Promise<IDBDatabase>(
        (
          resolve: (value: IDBDatabase | PromiseLike<IDBDatabase>) => void,
          reject: (reason?: unknown) => void,
        ): void => {
          const openRequest: IDBOpenDBRequest = globalThis.indexedDB.open(
            this.databaseName,
            IndexedDbPersistenceAdapter.DATABASE_VERSION,
          );

          openRequest.addEventListener("upgradeneeded", (): void => {
            const database: IDBDatabase = openRequest.result;

            if (
              database.objectStoreNames.contains(
                IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
              )
            ) {
              return;
            }

            database.createObjectStore(
              IndexedDbPersistenceAdapter.OBJECT_STORE_NAME,
              {
                keyPath: "id",
              },
            );
          });
          openRequest.addEventListener("success", (): void => {
            resolve(openRequest.result);
          });
          openRequest.addEventListener("error", (): void => {
            reject(openRequest.error);
          });
        },
      );
    }

    try {
      return await this.databasePromise;
    } catch {
      this.databasePromise = null;
      return null;
    }
  }
}
