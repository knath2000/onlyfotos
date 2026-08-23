import Constants from 'expo-constants';

import { NativeMediaEntry } from '@/library/types';
import { getServerUrl } from '@/storage/database';

type MediaPage = { items: NativeMediaEntry[]; nextCursor: string | null };
type Health = { status: 'ready' | 'scanning' | 'error'; assets: number; root: string; error: string | null };

function normalize(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function developmentServerUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8787` : null;
}

export async function findServerUrl(savedUrl: string | null) {
  const candidates = [developmentServerUrl(), savedUrl]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const health = await checkServer(candidate);
      return { health, serverUrl: candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Media server is not configured');
}

async function request(path: string, init?: RequestInit) {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Media server is not configured');
  const response = await fetch(`${normalize(serverUrl)}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Media server returned ${response.status}`);
  }
  return response;
}

export function mediaUrl(serverUrl: string, relativePath: string) {
  return `${normalize(serverUrl)}/media?path=${encodeURIComponent(relativePath)}`;
}

export function thumbnailUrl(serverUrl: string, relativePath: string) {
  return `${normalize(serverUrl)}/thumbnail?path=${encodeURIComponent(relativePath)}`;
}

export async function checkServer(serverUrl: string) {
  const response = await fetch(`${normalize(serverUrl)}/health`);
  if (!response.ok) throw new Error(`Media server returned ${response.status}`);
  return response.json() as Promise<Health>;
}

export async function listMediaPage(cursor: string | null, pageSize: number) {
  const query = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) query.set('cursor', cursor);
  return (await request(`/api/assets?${query}`)).json() as Promise<MediaPage>;
}

export async function refreshServer() {
  return (await request('/api/refresh', { method: 'POST' })).json() as Promise<{
    assets: number;
    items: NativeMediaEntry[];
    removedPaths: string[];
  }>;
}
