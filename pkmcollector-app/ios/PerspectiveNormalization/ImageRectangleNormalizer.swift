import Foundation
import React
import UIKit
import CoreImage
import ImageIO

@objc(ImageRectangleNormalizer)
class ImageRectangleNormalizer: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(normalize:withDetections:withOptions:resolver:rejecter:)
  func normalize(
    _ imagePath: NSString,
    withDetections detections: NSArray,
    withOptions options: NSDictionary?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      guard let url = URL(string: imagePath as String) else {
        print("no img")
        return
      }

      guard let data = try? Data(contentsOf: url),
            let source = CGImageSourceCreateWithData(data as CFData,nil),
            let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
      else {
        reject("E_LOAD", "Could not load image", nil)
        return
      }
      
      var orientation: CGImagePropertyOrientation = .right
            if let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
               let exifOrientation = props[kCGImagePropertyOrientation] as? UInt32 {
              orientation = CGImagePropertyOrientation(rawValue: exifOrientation) ?? .right
            }

      
      let ciImage = CIImage(cgImage: cgImage).oriented(orientation)
      let imgWidth = ciImage.extent.width
      let imgHeight = ciImage.extent.height

      // dimensione carta in pxl
      let dpi = (options?["dpi"] as? NSNumber)?.doubleValue ?? 300.0
      let mmToInches = 0.0393700787
      let cardWidthPx = CGFloat(round(63.0 * mmToInches * dpi))
      let cardHeightPx = CGFloat(round(88.0 * mmToInches * dpi))
      
      print(imgWidth,imgHeight)
      print(cardWidthPx,cardHeightPx)
      var results: [String] = []

      for (index, item) in detections.enumerated() {
        guard let det = item as? NSDictionary,
              let tl = det["topLeft"] as? NSDictionary,
              let tr = det["topRight"] as? NSDictionary,
              let bl = det["bottomLeft"] as? NSDictionary,
              let br = det["bottomRight"] as? NSDictionary,
              let tlx = tl["x"] as? NSNumber, let tly = tl["y"] as? NSNumber,
              let trx = tr["x"] as? NSNumber, let try_ = tr["y"] as? NSNumber,
              let blx = bl["x"] as? NSNumber, let bly = bl["y"] as? NSNumber,
              let brx = br["x"] as? NSNumber, let bry = br["y"] as? NSNumber
        else { continue }

        // calcolo coordinate
        let topLeft = CGPoint(x: tlx.doubleValue * Double(imgWidth),
                              y: (tly.doubleValue) * Double(imgHeight))
        let topRight = CGPoint(x: trx.doubleValue * Double(imgWidth),
                               y: (try_.doubleValue) * Double(imgHeight))
        let bottomLeft = CGPoint(x: blx.doubleValue * Double(imgWidth),
                                 y: (bly.doubleValue) * Double(imgHeight))
        let bottomRight = CGPoint(x: brx.doubleValue * Double(imgWidth),
                                  y: (bry.doubleValue) * Double(imgHeight))

        // filtro correzione
        guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { continue }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(CIVector(cgPoint: topLeft), forKey: "inputTopLeft")
        filter.setValue(CIVector(cgPoint: topRight), forKey: "inputTopRight")
        filter.setValue(CIVector(cgPoint: bottomRight), forKey: "inputBottomRight")
        filter.setValue(CIVector(cgPoint: bottomLeft), forKey: "inputBottomLeft")

        guard let corrected = filter.outputImage else {
          print("nada");
          continue }

        // scala
        let scaleX = cardWidthPx / corrected.extent.width
        let scaleY = cardHeightPx / corrected.extent.height
        let scaled = corrected.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

        
        let context = CIContext()
        guard let cgOut = context.createCGImage(scaled, from: CGRect(x: 0, y: 0, width: cardWidthPx, height: cardHeightPx)) else { continue }
        let finalUIImage = UIImage(cgImage: cgOut, scale: 1.0, orientation: .up)

        // file
        let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory())
          .appendingPathComponent("normalized_\(UUID().uuidString)_\(index).png")

        do {
          try finalUIImage.pngData()?.write(to: tmpURL)
          results.append(tmpURL.path)
        } catch { continue }
      }

      DispatchQueue.main.async {
        resolve(results)
      }
    }
  }
}
