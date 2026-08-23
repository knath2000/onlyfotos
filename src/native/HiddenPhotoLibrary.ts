import { requireNativeModule } from 'expo-modules-core';

import { MediaKind, PhotoAuthorizationStatus } from '@/library/types';

export type HiddenPhotoAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaKind: MediaKind;
  capturedAt: number;
  modifiedAt: number;
  width: number;
  height: number;
  duration: number | null;
};

type HiddenPhotoLibraryModule = {
  getAuthorizationStatus(): PhotoAuthorizationStatus;
  requestAuthorization(): Promise<PhotoAuthorizationStatus>;
  getHiddenAssets(): Promise<HiddenPhotoAsset[]>;
};

export default requireNativeModule<HiddenPhotoLibraryModule>('HiddenPhotoLibrary');
