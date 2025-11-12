#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#if __has_include("pkmCollector/pkmCollector-Swift.h")
#import "pkmCollector/pkmCollector-Swift.h"
#else
#import "pkmCollector-Swift.h"
#endif

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(RectangleDetectorFrameProcessorPlugin, detectRectangles)