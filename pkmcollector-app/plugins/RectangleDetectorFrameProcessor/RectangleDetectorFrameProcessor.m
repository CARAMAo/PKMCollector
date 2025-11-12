#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#if __has_include("pokemontcgdetector/pokemontcgdetector-Swift.h")
#import "pokemontcgdetector/pokemontcgdetector-Swift.h"
#else
#import "pokemontcgdetector-Swift.h"
#endif

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(RectangleDetectorFrameProcessorPlugin, detectRectangles)