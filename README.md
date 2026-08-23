# OnlyFotos

An iPhone-only, read-only browser for the Hidden album in Apple Photos and iCloud Photos.

## Requirements

- The iPhone must grant OnlyFotos **Full Photos Access**.
- In **Settings → Apps → Photos**, turn off **Use Face ID** for Hidden. Apple otherwise returns an empty Hidden smart album to third-party apps.
- A free Apple Personal Team build expires after seven days and must then be rebuilt and reinstalled.

OnlyFotos never asks for an Apple ID or password. PhotoKit handles access to local and iCloud-backed assets.

## Build and install

Xcode is installed at `/Volumes/WD/Applications/Xcode.app`.

```bash
npm install
DEVELOPER_DIR=/Volumes/WD/Applications/Xcode.app/Contents/Developer npx expo prebuild --clean --platform ios
DEVELOPER_DIR=/Volumes/WD/Applications/Xcode.app/Contents/Developer npm run build:ios:device
```

The iOS target uses the `Kalyan Nath (Personal Team)` free provisioning team. Reinstall with the same device-build command when the seven-day profile expires.

The native Debug build has been verified successfully. If signing reports missing account credentials or no provisioning profile, sign in under Xcode **Settings → Accounts**, reconnect and unlock the iPhone, and rerun the device command. The simulator runtime is installed, but it cannot contain the user's personal iCloud Photos library.

For JavaScript development after the native app is installed:

```bash
npm run start:metro
```

This prints the iPhone connection URL and starts Metro in LAN mode. Enter the printed `http://<mac-lan-ip>:8081` URL in OnlyFotos' manual development-server field.

## Behavior

- `HiddenPhotoLibraryModule.swift` fetches only `PHAssetCollectionSubtype.smartAlbumAllHidden`.
- Fetch requests explicitly enable `includeHiddenAssets`.
- The module exposes read operations only; it cannot delete, move, edit, or unhide assets.
- Images and videos use PhotoKit `ph://` URLs.
- Expo Image and Expo Video allow network access so iCloud-only originals download on demand.
- The existing grid, paging, zoom, autoplay, Play All, and Shuffle All interactions are preserved.
- The bottom navigation is a floating translucent pill with Library and Settings tabs.

The former LAN server remains in `server/` as historical fallback code but is not imported or used by the native application.

See [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for implementation and validation details.
