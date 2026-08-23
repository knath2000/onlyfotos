import AVFoundation
import ExpoModulesCore
import ImageIO
import UniformTypeIdentifiers
import UIKit

private let bookmarkKey = "RemoteLibrary.folderBookmark"
private let supportedExtensions = Set(["jpg", "jpeg", "png", "heic", "heif", "mov", "mp4", "m4v"])

public final class FolderAccessModule: Module {
  private var rootURL: URL?
  private var enumeratedEntries: [[String: Any?]] = []

  public func definition() -> ModuleDefinition {
    Name("FolderAccess")

    AsyncFunction("pickFolder") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let presenter = Self.topViewController() else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "Unable to present the folder picker")
          return
        }
        let delegate = FolderPickerDelegate { [weak self] result in
          switch result {
          case .success(let url):
            do {
              let bookmark = try url.bookmarkData(
                options: [.minimalBookmark],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
              )
              UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
              try self?.activate(url)
              promise.resolve(["name": url.lastPathComponent, "state": "connected"])
            } catch {
              promise.reject(error)
            }
          case .failure(let error):
            promise.reject(error)
          }
          objc_setAssociatedObject(presenter, &FolderPickerDelegate.associationKey, nil, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
        picker.allowsMultipleSelection = false
        picker.delegate = delegate
        objc_setAssociatedObject(presenter, &FolderPickerDelegate.associationKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        presenter.present(picker, animated: true)
      }
    }

    AsyncFunction("restoreFolderAccess") {
      guard let bookmark = UserDefaults.standard.data(forKey: bookmarkKey) else {
        throw Exception(name: "ERR_NOT_CONFIGURED", description: "No library folder has been selected")
      }
      var stale = false
      let url = try URL(
        resolvingBookmarkData: bookmark,
        options: [.withoutUI],
        relativeTo: nil,
        bookmarkDataIsStale: &stale
      )
      if stale {
        return ["name": url.lastPathComponent, "state": "staleBookmark"]
      }
      do {
        try self.activate(url)
        return ["name": url.lastPathComponent, "state": "connected"]
      } catch {
        return ["name": url.lastPathComponent, "state": "unavailable"]
      }
    }

    AsyncFunction("listMediaPage") { (cursor: String?, pageSize: Int) -> [String: Any?] in
      guard let root = self.rootURL else {
        throw Exception(name: "ERR_UNAVAILABLE", description: "The selected folder is unavailable")
      }
      let offset = Int(cursor ?? "0") ?? 0
      if offset == 0 {
        self.enumeratedEntries = try self.enumerate(root: root)
      }
      let end = min(offset + max(1, min(pageSize, 1000)), self.enumeratedEntries.count)
      let items = offset < end ? Array(self.enumeratedEntries[offset..<end]) : []
      return [
        "items": items,
        "nextCursor": end < self.enumeratedEntries.count ? String(end) : nil,
      ]
    }

    AsyncFunction("readMediaMetadata") { (relativePath: String) -> [String: Any?] in
      let url = try self.resolvedURL(for: relativePath)
      return try self.metadata(for: url)
    }

    AsyncFunction("materializeReadableFile") { (relativePath: String) -> String in
      let url = try self.resolvedURL(for: relativePath)
      guard FileManager.default.fileExists(atPath: url.path) else {
        throw Exception(name: "ERR_UNAVAILABLE", description: "The original file is unavailable")
      }
      return url.absoluteString
    }

    AsyncFunction("releaseFolderAccess") {
      self.rootURL?.stopAccessingSecurityScopedResource()
      self.rootURL = nil
      self.enumeratedEntries = []
      UserDefaults.standard.removeObject(forKey: bookmarkKey)
    }
  }

  private func activate(_ url: URL) throws {
    rootURL?.stopAccessingSecurityScopedResource()
    guard url.startAccessingSecurityScopedResource() else {
      throw Exception(name: "ERR_PERMISSION_REVOKED", description: "Folder permission was revoked")
    }
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else {
      url.stopAccessingSecurityScopedResource()
      throw Exception(name: "ERR_UNAVAILABLE", description: "The selected folder is unavailable")
    }
    rootURL = url.standardizedFileURL
    enumeratedEntries = []
  }

  private func enumerate(root: URL) throws -> [[String: Any?]] {
    let keys: [URLResourceKey] = [.isRegularFileKey, .contentModificationDateKey, .fileSizeKey, .nameKey]
    guard let enumerator = FileManager.default.enumerator(
      at: root,
      includingPropertiesForKeys: keys,
      options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
      throw Exception(name: "ERR_UNAVAILABLE", description: "The folder could not be enumerated")
    }

    var entries: [[String: Any?]] = []
    for case let fileURL as URL in enumerator {
      let ext = fileURL.pathExtension.lowercased()
      guard supportedExtensions.contains(ext) else { continue }
      let values = try fileURL.resourceValues(forKeys: Set(keys))
      guard values.isRegularFile == true else { continue }
      let relativePath = String(fileURL.standardizedFileURL.path.dropFirst(root.path.count + 1))
      entries.append([
        "path": relativePath,
        "filename": values.name ?? fileURL.lastPathComponent,
        "mediaKind": ["mov", "mp4", "m4v"].contains(ext) ? "video" : "image",
        "modifiedAt": (values.contentModificationDate ?? .distantPast).timeIntervalSince1970 * 1000,
        "fileSize": values.fileSize ?? 0,
      ])
    }
    return entries.sorted {
      (($0["modifiedAt"] as? Double) ?? 0) > (($1["modifiedAt"] as? Double) ?? 0)
    }
  }

  private func resolvedURL(for relativePath: String) throws -> URL {
    guard let root = rootURL else {
      throw Exception(name: "ERR_UNAVAILABLE", description: "The selected folder is unavailable")
    }
    let candidate = root.appendingPathComponent(relativePath).standardizedFileURL
    guard candidate.path.hasPrefix(root.path + "/") else {
      throw Exception(name: "ERR_INVALID_PATH", description: "The path is outside the selected folder")
    }
    return candidate
  }

  private func metadata(for url: URL) throws -> [String: Any?] {
    let ext = url.pathExtension.lowercased()
    if ["mov", "mp4", "m4v"].contains(ext) {
      let asset = AVURLAsset(url: url)
      let dimensions = asset.tracks(withMediaType: .video).first?.naturalSize
      return [
        "width": dimensions?.width,
        "height": dimensions?.height,
        "duration": asset.duration.seconds.isFinite ? asset.duration.seconds : nil,
        "capturedAt": nil,
      ]
    }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else {
      return ["width": nil, "height": nil, "duration": nil, "capturedAt": nil]
    }
    return [
      "width": properties[kCGImagePropertyPixelWidth],
      "height": properties[kCGImagePropertyPixelHeight],
      "duration": nil,
      "capturedAt": nil,
    ]
  }

  private static func topViewController() -> UIViewController? {
    let root = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)?
      .rootViewController
    var current = root
    while let presented = current?.presentedViewController {
      current = presented
    }
    return current
  }
}

private final class FolderPickerDelegate: NSObject, UIDocumentPickerDelegate {
  static var associationKey: UInt8 = 0
  private let completion: (Result<URL, Error>) -> Void

  init(completion: @escaping (Result<URL, Error>) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      completion(.failure(PickerError.cancelled))
      return
    }
    completion(.success(url))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(.failure(PickerError.cancelled))
  }
}

private enum PickerError: LocalizedError {
  case cancelled
  var errorDescription: String? { "Folder selection was cancelled" }
}
