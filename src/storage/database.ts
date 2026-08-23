import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { LibraryAsset, MediaKind, NativeMediaEntry } from '@/library/types';

let database: Promise<SQLite.SQLiteDatabase> | undefined;

async function db() {
  database ??= SQLite.openDatabaseAsync('remote-library.db');
  const value = await database;
  await value.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      relative_path TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      media_kind TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      modified_at INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      duration REAL,
      file_size INTEGER NOT NULL,
      thumbnail_uri TEXT,
      scan_generation INTEGER NOT NULL,
      missing INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS assets_timeline ON assets(missing, captured_at DESC, id);
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
  return value;
}

function rowToAsset(row: Record<string, string | number | null>): LibraryAsset {
  return {
    id: String(row.id),
    uri: row.thumbnail_uri == null ? '' : String(row.thumbnail_uri),
    relativePath: String(row.relative_path),
    filename: String(row.filename),
    mediaKind: String(row.media_kind) as MediaKind,
    capturedAt: Number(row.captured_at),
    modifiedAt: Number(row.modified_at),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    duration: row.duration == null ? null : Number(row.duration),
    fileSize: Number(row.file_size),
    thumbnailUri: row.thumbnail_uri == null ? null : String(row.thumbnail_uri),
    scanGeneration: Number(row.scan_generation),
    missing: Boolean(row.missing),
  };
}

export async function stableAssetId(relativePath: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, relativePath.normalize('NFC'));
}

export async function upsertEntries(entries: NativeMediaEntry[], generation: number) {
  const database = await db();
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Media server is not configured');
  await database.withTransactionAsync(async () => {
    for (const entry of entries) {
      const id = await stableAssetId(entry.path);
      await database.runAsync(
        `INSERT INTO assets (
          id, relative_path, filename, media_kind, captured_at, modified_at,
          width, height, duration, file_size, thumbnail_uri, scan_generation, missing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(relative_path) DO UPDATE SET
          filename = excluded.filename,
          media_kind = excluded.media_kind,
          captured_at = excluded.captured_at,
          modified_at = excluded.modified_at,
          width = excluded.width,
          height = excluded.height,
          duration = excluded.duration,
          file_size = excluded.file_size,
          thumbnail_uri = excluded.thumbnail_uri,
          scan_generation = excluded.scan_generation,
          missing = 0`,
        id,
        entry.path,
        entry.filename,
        entry.mediaKind,
        entry.modifiedAt,
        entry.modifiedAt,
        entry.width,
        entry.height,
        entry.duration,
        entry.fileSize,
        `${serverUrl}/thumbnail?path=${encodeURIComponent(entry.path)}`,
        generation,
      );
    }
  });
}

export async function getServerUrl() {
  const database = await db();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM state WHERE key = 'server_url'",
  );
  return row?.value ?? null;
}

export async function setServerUrl(value: string | null) {
  const database = await db();
  if (!value) {
    await database.runAsync("DELETE FROM state WHERE key = 'server_url'");
    return;
  }
  const normalized = value.trim().replace(/\/+$/, '');
  await database.runAsync(
    `INSERT INTO state(key, value) VALUES ('server_url', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    normalized,
  );
  await database.runAsync(
    `UPDATE assets
     SET thumbnail_uri = ? || substr(thumbnail_uri, instr(thumbnail_uri, '/thumbnail?path='))
     WHERE instr(thumbnail_uri, '/thumbnail?path=') > 0`,
    normalized,
  );
}

export async function finishScan(generation: number) {
  const database = await db();
  await database.runAsync('UPDATE assets SET missing = 1 WHERE scan_generation != ?', generation);
  await database.runAsync(
    `INSERT INTO state(key, value) VALUES ('last_scan', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(Date.now()),
  );
}

export async function applyIncrementalChanges(entries: NativeMediaEntry[], removedPaths: string[]) {
  if (entries.length) await upsertEntries(entries, Date.now());
  if (removedPaths.length) {
    const database = await db();
    await database.withTransactionAsync(async () => {
      for (const relativePath of removedPaths) {
        await database.runAsync(
          'UPDATE assets SET missing = 1 WHERE relative_path = ?',
          relativePath,
        );
      }
    });
  }
  const database = await db();
  await database.runAsync(
    `INSERT INTO state(key, value) VALUES ('last_scan', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(Date.now()),
  );
}

export async function getAssets(limit: number, offset = 0) {
  const database = await db();
  const rows = await database.getAllAsync<Record<string, string | number | null>>(
    'SELECT * FROM assets WHERE missing = 0 ORDER BY captured_at DESC, id LIMIT ? OFFSET ?',
    limit,
    offset,
  );
  return rows.map(rowToAsset);
}

export async function getAsset(id: string) {
  const database = await db();
  const row = await database.getFirstAsync<Record<string, string | number | null>>(
    'SELECT * FROM assets WHERE id = ?',
    id,
  );
  return row ? rowToAsset(row) : null;
}

export async function getStats() {
  const database = await db();
  const row = await database.getFirstAsync<{ count: number; bytes: number }>(
    'SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS bytes FROM assets WHERE missing = 0',
  );
  return row ?? { count: 0, bytes: 0 };
}

export async function clearIndex() {
  const database = await db();
  await database.execAsync("DELETE FROM assets; DELETE FROM state WHERE key != 'server_url';");
}
