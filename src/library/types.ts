export type MediaKind = 'image' | 'video';

export type LibraryConnectionState =
  | 'notConfigured'
  | 'connected'
  | 'unavailable'
  | 'permissionRevoked';

export type PhotoAuthorizationStatus =
  | 'authorized'
  | 'limited'
  | 'denied'
  | 'restricted'
  | 'notDetermined';

export type LibraryAsset = {
  id: string;
  uri: string;
  relativePath: string;
  filename: string;
  mediaKind: MediaKind;
  capturedAt: number;
  modifiedAt: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number;
  thumbnailUri: string | null;
  scanGeneration: number;
  missing: boolean;
};

export type NativeMediaEntry = Omit<
  LibraryAsset,
  'id' | 'uri' | 'capturedAt' | 'thumbnailUri' | 'scanGeneration' | 'missing'
> & {
  path: string;
};

export type ScanProgress = {
  phase: 'idle' | 'enumerating' | 'reconciling' | 'complete' | 'cancelled' | 'failed';
  discovered: number;
  indexed: number;
  message?: string;
};

export type ThumbnailRecord = {
  assetId: string;
  uri: string;
  bytes: number;
  lastAccessedAt: number;
};
