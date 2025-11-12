import { VisionCameraProxy, Frame } from 'react-native-vision-camera'

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectRectangles', {}) as {
  call: (frame: Frame, options?: DetectRectanglesOptions) => unknown
}

export type RectangleDetection = {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export type DetectRectanglesOptions = {
  minAspect?: number
  maxAspect?: number
  minSize?: number
  maxObservations?: number
  aspectTarget?: number
  tolerance?: number
  detectEveryNFrames?: number
  debug?: boolean
}

export function detectRectangles(frame: Frame, options?: DetectRectanglesOptions): RectangleDetection[] {
  'worklet'
  if (plugin == null) {
    throw new Error('Failed to load Frame Processor Plugin!')
  }
  const args = options ?? {}

  const result = plugin.call(frame, args)
  return (result ?? []) as unknown as RectangleDetection[]
}
