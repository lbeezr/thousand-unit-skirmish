import AppKit
import Foundation

let cursorNames = [
    "select",
    "box-select",
    "move",
    "attack-move",
    "gather",
    "build-valid",
    "build-blocked",
]

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let cursorDirectory = root.appendingPathComponent("assets/ui/cursors", isDirectory: true)
let targetSize = NSSize(width: 32, height: 32)

for name in cursorNames {
    let sourceURL = cursorDirectory.appendingPathComponent("\(name).svg")
    let targetURL = cursorDirectory.appendingPathComponent("\(name).png")

    guard let image = NSImage(contentsOf: sourceURL) else {
        fatalError("Unable to load cursor source: \(sourceURL.path)")
    }

    image.size = targetSize
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        bitmap.pixelsWide == 32,
        bitmap.pixelsHigh == 32,
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        fatalError("Unable to render \(name).svg as a 32 × 32 PNG")
    }

    do {
        try png.write(to: targetURL, options: .atomic)
        print("Exported \(targetURL.path) (\(bitmap.pixelsWide) × \(bitmap.pixelsHigh))")
    } catch {
        fatalError("Unable to write \(targetURL.path): \(error)")
    }
}
