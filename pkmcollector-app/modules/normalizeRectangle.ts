// ImageRectangleNormalizer.ts
import { NativeModules } from 'react-native';
import { RectangleDetection } from '@/plugins/rectangleDetectorFrameProcessorPlugin';

type NativeModuleType = {
  normalize(
    imagePath: string,
    detections: RectangleDetection[],
    options?: { dpi?: number }
  ): Promise<string[]>;
};

const { ImageRectangleNormalizer } = NativeModules as {
  ImageRectangleNormalizer: NativeModuleType;
};

export default ImageRectangleNormalizer;
