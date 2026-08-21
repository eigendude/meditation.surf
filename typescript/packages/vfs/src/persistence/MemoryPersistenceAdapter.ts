/*
 * Copyright (C) 2026 Garrett Brown
 * This file is part of meditation.surf - https://github.com/SwellPatrol/meditation.surf
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the file LICENSE.txt for more information.
 */

import type { CacheKey } from "../cache/CacheTypes";
import type {
  PersistenceAdapter,
  PersistenceRecord,
  PersistenceWriteRequest,
} from "./PersistenceTypes";

/**
 * @brief Small in-memory persistence adapter used as a safe universal fallback
 */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly recordsByKey: Map<CacheKey, PersistenceRecord>;

  /**
   * @brief Build the in-memory persistence adapter
   */
  public constructor() {
    this.recordsByKey = new Map<CacheKey, PersistenceRecord>();
  }

  /**
   * @inheritdoc
   */
  public async get(key: CacheKey): Promise<PersistenceRecord | null> {
    const existingRecord: PersistenceRecord | undefined =
      this.recordsByKey.get(key);

    if (existingRecord === undefined) {
      return null;
    }

    const touchedRecord: PersistenceRecord = {
      ...existingRecord,
      lastAccessedAt: Date.now(),
    };

    this.recordsByKey.set(key, touchedRecord);

    return this.cloneRecord(touchedRecord);
  }

  /**
   * @inheritdoc
   */
  public async put(
    record: PersistenceWriteRequest,
  ): Promise<PersistenceRecord> {
    const storedRecord: PersistenceRecord = {
      ...record,
    };

    this.recordsByKey.set(record.key, storedRecord);

    return this.cloneRecord(storedRecord);
  }

  /**
   * @inheritdoc
   */
  public async delete(key: CacheKey): Promise<void> {
    this.recordsByKey.delete(key);
  }

  /**
   * @inheritdoc
   */
  public async list(keyPrefix?: string): Promise<PersistenceRecord[]> {
    const prefix: string = keyPrefix ?? "";
    const matchingRecords: PersistenceRecord[] = [
      ...this.recordsByKey.values(),
    ].filter((record: PersistenceRecord): boolean =>
      record.key.startsWith(prefix),
    );

    return matchingRecords.map(
      (record: PersistenceRecord): PersistenceRecord =>
        this.cloneRecord(record),
    );
  }

  /**
   * @inheritdoc
   */
  public async clear(keyPrefix?: string): Promise<void> {
    const prefix: string = keyPrefix ?? "";

    if (prefix.length === 0) {
      this.recordsByKey.clear();
      return;
    }

    for (const key of this.recordsByKey.keys()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      this.recordsByKey.delete(key);
    }
  }

  /**
   * @brief Clone one stored record for immutable callers
   *
   * @param record - Stored record being cloned
   *
   * @returns Cloned persistence record
   */
  private cloneRecord(record: PersistenceRecord): PersistenceRecord {
    return {
      ...record,
      metadata: {
        ...record.metadata,
      },
    };
  }
}
