import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { LibraryAsset, LibraryConnectionState, PhotoAuthorizationStatus, ScanProgress } from '@/library/types';
import HiddenPhotoLibrary, { HiddenPhotoAsset } from '@/native/HiddenPhotoLibrary';

type LibraryContextValue = {
  assets: LibraryAsset[];
  authorization: PhotoAuthorizationStatus;
  connection: LibraryConnectionState;
  progress: ScanProgress;
  authorize: () => Promise<void>;
  refresh: () => Promise<void>;
  cancelScan: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function normalizedAssets(assets: HiddenPhotoAsset[]): LibraryAsset[] {
  const generation = Date.now();
  return assets.map((asset) => ({
    ...asset,
    relativePath: asset.id,
    fileSize: 0,
    thumbnailUri: asset.uri,
    scanGeneration: generation,
    missing: false,
  }));
}

export function LibraryProvider({ children }: PropsWithChildren) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [authorization, setAuthorization] = useState<PhotoAuthorizationStatus>('notDetermined');
  const [connection, setConnection] = useState<LibraryConnectionState>('notConfigured');
  const [progress, setProgress] = useState<ScanProgress>({ phase: 'idle', discovered: 0, indexed: 0 });
  const cancelled = useRef(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    cancelled.current = false;
    setProgress({ phase: 'enumerating', discovered: 0, indexed: 0 });
    try {
      const values = normalizedAssets(await HiddenPhotoLibrary.getHiddenAssets());
      if (cancelled.current) {
        setProgress({ phase: 'cancelled', discovered: values.length, indexed: 0 });
        return;
      }
      setAssets(values);
      setConnection('connected');
      setProgress({ phase: 'complete', discovered: values.length, indexed: values.length });
    } catch (error) {
      setConnection('unavailable');
      setProgress({
        phase: 'failed',
        discovered: 0,
        indexed: 0,
        message: error instanceof Error ? error.message : 'Unable to read the Hidden album',
      });
    } finally {
      refreshing.current = false;
    }
  }, []);

  const authorize = useCallback(async () => {
    const status = await HiddenPhotoLibrary.requestAuthorization();
    setAuthorization(status);
    if (status !== 'authorized') {
      setConnection(status === 'notDetermined' ? 'notConfigured' : 'permissionRevoked');
      throw new Error(status === 'limited'
        ? 'Choose Allow Full Access. Limited Photos access cannot open the Hidden album.'
        : 'Full Photos access is required to open the Hidden album.');
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const status = HiddenPhotoLibrary.getAuthorizationStatus();
    setAuthorization(status);
    if (status === 'authorized') void refresh();
    else setConnection(status === 'notDetermined' ? 'notConfigured' : 'permissionRevoked');
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const status = HiddenPhotoLibrary.getAuthorizationStatus();
      setAuthorization(status);
      if (status === 'authorized') void refresh();
      else setConnection(status === 'notDetermined' ? 'notConfigured' : 'permissionRevoked');
    });
    return () => subscription.remove();
  }, [refresh]);

  return (
    <LibraryContext.Provider
      value={{
        assets,
        authorization,
        connection,
        progress,
        authorize,
        refresh,
        cancelScan: () => {
          cancelled.current = true;
        },
      }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}
