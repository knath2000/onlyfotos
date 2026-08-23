# OnlyFotos project state

Last updated: 2026-08-23

## Current handoff status

- The native iOS app has been signed and installed on the connected iPhone. The installed development client works with the local Metro workflow below.
- The iOS 26.2 (23C54) simulator runtime is installed and verified in Xcode.
- TypeScript, Expo lint, and Expo dependency checks pass.
- A standalone Release install still requires Xcode to successfully create the Personal Team provisioning profile; the development-client install is the current working path.

## Current architecture

OnlyFotos is a custom native Expo development build for one personal iPhone:

```text
Hidden smart album
  -> Apple PhotoKit on the iPhone
  -> HiddenPhotoLibrary Expo module
  -> React Native gallery and viewer
  -> iCloud originals downloaded by PhotoKit on demand
```

The previous Expo Go and Mac LAN-server architecture was replaced because Expo Go's SDK 54 media-library implementation forces `includeHiddenAssets = false`. A local native module is required to fetch the Hidden smart album automatically.

## Native module

Entry point: `modules/hidden-photo-library/ios/HiddenPhotoLibraryModule.swift`

- Requests PhotoKit `.readWrite` authorization.
- Requires full authorization; limited access is rejected.
- Fetches `.smartAlbumAllHidden` directly rather than relying on a localized album title.
- Uses `PHFetchOptions.includeHiddenAssets = true`.
- Restricts results to user-library images and videos.
- Returns newest-first identifiers, `ph://` URIs, filenames, timestamps, dimensions, and video durations.
- Defines no PhotoKit mutation operations.

`expo-image` requests iCloud images with network access enabled. `expo-video` resolves PhotoKit video assets asynchronously with network access enabled.

## Application behavior

- Full Photos permission onboarding and Settings recovery
- Automatic refresh when the app returns to the foreground
- Newest-first adaptive FlashList grid
- Video duration badges
- Horizontal viewer paging
- Double-tap, pinch-to-zoom, and zoomed panning
- Muted video autoplay with off-screen pause
- Play All and Shuffle All video playlists
- Read-only iCloud Photos status and item count

The app does not need the Mac server, external media drive, LAN address, SQLite catalog, or Expo Go.

## Build environment

- Expo SDK 54
- React Native 0.81.5
- Xcode 26.3 at `/Volumes/WD/Applications/Xcode.app`
- Bundle identifier `com.kalyannath.onlyfotos`
- Apple Personal Team `GM6P45R4QX`
- iOS deployment target 17.0
- Native build cache `/Volumes/WD/BuildCache/onlyfotos`

The free provisioning profile expires after seven days. Rebuild and reinstall from the Mac after expiration.

## Commands

```bash
npm run typecheck
npm run lint
npx expo install --check

npm run start:metro

DEVELOPER_DIR=/Volumes/WD/Applications/Xcode.app/Contents/Developer \
  npx expo prebuild --clean --platform ios

DEVELOPER_DIR=/Volumes/WD/Applications/Xcode.app/Contents/Developer \
  npm run build:ios:device
```

## Known boundaries

- Apple returns an empty Hidden album while **Use Face ID for Hidden** is enabled.
- Full Photos access is required; limited selection is intentionally rejected.
- iCloud-only originals need internet access and may take time to download.
- A free Personal Team build must be reinstalled every seven days.
- Native dependency, app configuration, or Expo SDK changes require a new native build.
- JavaScript-only changes can use the installed development client and Metro.
- `npm run start:metro` prints the Mac LAN URL (for example `http://192.168.1.3:8081`) and starts Expo Metro for the installed development client. The iPhone and Mac must be on the same network.
- The simulator cannot contain the personal iCloud Photos library, so final Hidden-album verification must occur on the physical iPhone.

## Navigation UI

The tab bar is a floating translucent pill with rounded corners and a subtle border/shadow. It provides Library and Settings tabs and replaces the previous opaque bottom bar. The implementation lives in `app/(tabs)/_layout.tsx`.
