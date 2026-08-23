import { requireNativeModule } from 'expo-modules-core';

import { LibraryConnectionState, NativeMediaEntry } from '@/library/types';

type FolderSelection = { name: string; state: LibraryConnectionState };
type MediaPage = { items: NativeMediaEntry[]; nextCursor: string | null };

type FolderAccessModule = {
  pickFolder(): Promise<FolderSelection>;
  restoreFolderAccess(): Promise<FolderSelection>;
  listMediaPage(cursor: string | null, pageSize: number): Promise<MediaPage>;
  readMediaMetadata(relativePath: string): Promise<Record<string, number | string | null>>;
  materializeReadableFile(relativePath: string): Promise<string>;
  releaseFolderAccess(): Promise<void>;
};

export default requireNativeModule<FolderAccessModule>('FolderAccess');
