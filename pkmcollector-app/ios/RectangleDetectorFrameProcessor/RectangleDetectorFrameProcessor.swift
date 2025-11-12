import Vision
import VisionCamera
import UIKit

@objc(RectangleDetectorFrameProcessorPlugin)
public class RectangleDetectorFrameProcessorPlugin: FrameProcessorPlugin {
    private var inputObservations: [UUID: VNRectangleObservation] = [:]
    private var frameCount = 0
    private var trackingRequests: [VNTrackRectangleRequest] = []

    private let maxTrackedRects = 5

    public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable : Any]?) -> Any? {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else { return nil }

        frameCount += 1
        let detectEveryNFrames = arguments?["detectEveryNFrames"] as? Int ?? 10
        let minAspect = Float(arguments?["minAspect"] as? Double ?? 0.65)
        let maxAspect = Float(arguments?["maxAspect"] as? Double ?? 0.8)
        let minSize = Float(arguments?["minSize"] as? Double ?? 0.1)

        
        if frameCount % detectEveryNFrames == 0 {
            let detectRequest = VNDetectRectanglesRequest()
            detectRequest.minimumAspectRatio = VNAspectRatio(minAspect)
            detectRequest.maximumAspectRatio = VNAspectRatio(maxAspect)
            detectRequest.minimumSize = minSize
            detectRequest.maximumObservations = maxTrackedRects
            detectRequest.minimumConfidence = 0.7
            
            do {
                let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right)
                try handler.perform([detectRequest])
                inputObservations = [:]

                if let detected = detectRequest.results as? [VNRectangleObservation], !detected.isEmpty {
                    for rect in detected.prefix(maxTrackedRects) {
                        inputObservations[rect.uuid] = rect
                        //trackingRequests.append(VNTrackRectangleRequest(rectangleObservation: rect))
                    }
                }
            } catch {
                print("Detection failed: \(error.localizedDescription)")
            }
        }
     
        // // mapping dinamico dei vertici
        // func mapVertices(_ rect: VNRectangleObservation) -> [String: [String: CGFloat]] {
        //     func transform(_ point: CGPoint) -> CGPoint {
        //             return CGPoint(x: point.x, y: point.y)
        //     }

        //     return [
        //         "topLeft": ["x": transform(rect.topLeft).x, "y": transform(rect.topLeft).y],
        //         "topRight": ["x": transform(rect.topRight).x, "y": transform(rect.topRight).y],
        //         "bottomLeft": ["x": transform(rect.bottomLeft).x, "y": transform(rect.bottomLeft).y],
        //         "bottomRight": ["x": transform(rect.bottomRight).x, "y": transform(rect.bottomRight).y],
        //     ]
        // }

        // output 
        return inputObservations.values.map { rect in
            return [
                "topLeft": ["x": rect.topLeft.x, "y": rect.topLeft.y],
                "topRight": ["x": rect.topRight.x, "y": rect.topRight.y],
                "bottomLeft": ["x": rect.bottomLeft.x, "y": rect.bottomLeft.y],
                "bottomRight": ["x": rect.bottomRight.x, "y": rect.bottomRight.y],
            ]
        }
    }
}
