import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useSkiaFrameProcessor } from 'react-native-vision-camera';
import { Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-worklets-core';
import { detectRectangles, RectangleDetection } from '@/plugins/rectangleDetectorFrameProcessorPlugin';
import ImageRectangleNormalizer from '@/modules/normalizeRectangle';
import recognizeCard from '@/services/recognizeCard';
import { Ionicons } from '@expo/vector-icons';
import { CardResult } from '@/types/card';
import { useIsFocused } from '@react-navigation/native';

type Props = {
  style?: StyleProp<ViewStyle>;
  onCardsRecognized?: (cards: CardResult[]) => void;
  onError?: (err: unknown) => void;
};

export default function CardScanner({ style, onCardsRecognized, onError }: Props) {
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const rects = useSharedValue<Array<RectangleDetection>>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResultsMessage, setNoResultsMessage] = useState<string | null>(null);

        const paintRect = Skia.Paint();
      paintRect.setColor(Skia.Color('rgba(255,255,0,0.3)'));
  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet';
    frame.render();
    const detected = detectRectangles(frame, {
      minAspect: 0.7,
      maxAspect: 0.73,
      minSize: 0.15,
      detectEveryNFrames: 5,
    });
    const toSkiaPoint = (p: { x: number; y: number }, frameWidth: number, frameHeight: number) => ({
      x: (1 - p.y) * frameWidth,
      y: (1 - p.x) * frameHeight,
    });

    if (detected.length > 0) {
      rects.value = detected;

      detected.forEach((rect) => {
        const tl = toSkiaPoint(rect.topLeft, frame.width, frame.height);
        const tr = toSkiaPoint(rect.topRight, frame.width, frame.height);
        const br = toSkiaPoint(rect.bottomRight, frame.width, frame.height);
        const bl = toSkiaPoint(rect.bottomLeft, frame.width, frame.height);

        const path = Skia.Path.Make();
        path.moveTo(bl.x, bl.y);
        path.lineTo(br.x, br.y);
        path.lineTo(tr.x, tr.y);
        path.lineTo(tl.x, tl.y);
        path.close();
        frame.drawPath(path, paintRect);
      });
    } else {
      rects.value = [];
    }
    
  }, []);

  const focused = useIsFocused()
  useEffect(() => {
    setActive(device != null && focused && !loading);

  }, [device,focused]);

  const handleCapture = async () => {
    if (!cameraRef.current || rects.value.length === 0 || loading) return;

    try {
      setNoResultsMessage(null);
      setLoading(true);
      const photo = await cameraRef.current.takePhoto();
      const normalizedPaths = await ImageRectangleNormalizer.normalize(photo.path, [...rects.value], { dpi: 300 });
      const results: CardResult[] = [];

      for (const path of normalizedPaths) {
        const metadataList = await recognizeCard(path);
        if (metadataList.length) {
          results.push(...metadataList);
        }
      }

      if (results.length > 0) {
        onCardsRecognized?.(results);
      } else {
        setNoResultsMessage('No cards found. Try again.');
        setTimeout(() => setNoResultsMessage(null), 2500);
      }
    } catch (err) {
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  if (!device)
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );

  return (
    <View style={[styles.container, style]}>
      <SafeAreaProvider>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={active}
          photo={true}
          frameProcessor={frameProcessor}
          enableFpsGraph={false}
          outputOrientation="preview"
        />

        <TouchableOpacity
          style={[styles.captureButton, loading ? styles.captureDisabled : null]}
          onPress={handleCapture}
          disabled={loading}
        >
          <Ionicons name="scan-circle-sharp" size={64} color="white" />
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Searching cards…</Text>
          </View>
        )}

        {noResultsMessage && !loading && (
          <Text style={styles.message}>{noResultsMessage}</Text>
        )}
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  captureButton: {
    bottom: 40,
    display:'flex',
    position:'absolute',
    alignSelf: 'center',
    padding: 10,
  },
  captureDisabled: {
    opacity: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: 'white',
    fontSize: 16,
  },
  message: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    color: '#ffb84d',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
