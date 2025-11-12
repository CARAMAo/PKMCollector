//
//  ImagePerspectiveNormalization.m
//  pokemontcgdetector
//
//  Created by Pasquale  on 27/10/25.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ImageRectangleNormalizer, NSObject)
RCT_EXTERN_METHOD(normalize:(NSString *)imagePath
                  withDetections:(NSArray *)detections
                  withOptions:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end

