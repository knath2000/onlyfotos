import ExpoModulesCore
import Photos

public final class HiddenPhotoLibraryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HiddenPhotoLibrary")

    Function("getAuthorizationStatus") {
      Self.authorizationStatus(PHPhotoLibrary.authorizationStatus(for: .readWrite))
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
        promise.resolve(Self.authorizationStatus(status))
      }
    }

    AsyncFunction("getHiddenAssets") { () -> [[String: Any?]] in
      guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
        throw Exception(
          name: "ERR_PHOTO_PERMISSION",
          description: "Full Photos access is required to read the Hidden album"
        )
      }

      let collections = PHAssetCollection.fetchAssetCollections(
        with: .smartAlbum,
        subtype: .smartAlbumAllHidden,
        options: nil
      )
      guard let hiddenAlbum = collections.firstObject else {
        return []
      }

      let options = PHFetchOptions()
      options.includeHiddenAssets = true
      options.includeAllBurstAssets = true
      options.includeAssetSourceTypes = .typeUserLibrary
      options.sortDescriptors = [
        NSSortDescriptor(key: "creationDate", ascending: false),
        NSSortDescriptor(key: "modificationDate", ascending: false),
      ]

      let result = PHAsset.fetchAssets(in: hiddenAlbum, options: options)
      var assets: [[String: Any?]] = []
      assets.reserveCapacity(result.count)
      result.enumerateObjects { asset, _, _ in
        guard asset.mediaType == .image || asset.mediaType == .video else {
          return
        }
        let createdAt = (asset.creationDate ?? asset.modificationDate ?? .distantPast).timeIntervalSince1970 * 1000
        let modifiedAt = (asset.modificationDate ?? asset.creationDate ?? .distantPast).timeIntervalSince1970 * 1000
        assets.append([
          "id": asset.localIdentifier,
          "uri": "ph://\(asset.localIdentifier)",
          "filename": asset.value(forKey: "filename") as? String ?? "Untitled",
          "mediaKind": asset.mediaType == .video ? "video" : "image",
          "capturedAt": createdAt,
          "modifiedAt": modifiedAt,
          "width": asset.pixelWidth,
          "height": asset.pixelHeight,
          "duration": asset.mediaType == .video ? asset.duration : nil,
        ])
      }
      return assets
    }
  }

  private static func authorizationStatus(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .authorized:
      return "authorized"
    case .limited:
      return "limited"
    case .denied:
      return "denied"
    case .restricted:
      return "restricted"
    case .notDetermined:
      return "notDetermined"
    @unknown default:
      return "restricted"
    }
  }
}
