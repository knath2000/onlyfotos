import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useLibrary } from '@/library/LibraryProvider';
import { LibraryAsset } from '@/library/types';

export function ViewerScreen() {
  const { id, playlist } = useLocalSearchParams<{ id: string; playlist?: 'all' | 'shuffle' }>();
  const { assets: libraryAssets } = useLibrary();
  const { width, height } = useWindowDimensions();
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const initialIndex = useRef(0);
  const list = useRef<FlatList<LibraryAsset>>(null);

  useEffect(() => {
    let values = libraryAssets;
      if (playlist) {
        values = values.filter((value) => value.mediaKind === 'video');
        if (playlist === 'shuffle') {
          values = [...values];
          for (let index = values.length - 1; index > 0; index -= 1) {
            const other = Math.floor(Math.random() * (index + 1));
            [values[index], values[other]] = [values[other], values[index]];
          }
          const selectedIndex = values.findIndex((value) => value.id === id);
          if (selectedIndex > 0) [values[0], values[selectedIndex]] = [values[selectedIndex], values[0]];
        }
      }
      const selectedIndex = Math.max(0, values.findIndex((value) => value.id === id));
      initialIndex.current = selectedIndex;
      setCurrentIndex(selectedIndex);
      setAssets(values);
  }, [id, libraryAssets, playlist]);

  const currentAsset = assets[currentIndex] ?? null;
  const itemLayout = useMemo(
    () => (_: ArrayLike<LibraryAsset> | null | undefined, index: number) => ({
      index,
      length: width,
      offset: width * index,
    }),
    [width],
  );

  const changePage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const advancePlaylist = () => {
    if (!playlist || currentIndex >= assets.length - 1) return;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    list.current?.scrollToIndex({ animated: true, index: nextIndex });
  };

  const moveToAdjacentItem = (direction: 'next' | 'previous') => {
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= assets.length) return;
    setCurrentIndex(nextIndex);
    list.current?.scrollToIndex({ animated: true, index: nextIndex });
  };

  return (
    <View style={styles.container}>
      {assets.length ? (
        <FlatList
          ref={list}
          data={assets}
          decelerationRate="fast"
          getItemLayout={itemLayout}
          horizontal
          initialScrollIndex={initialIndex.current}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={changePage}
          pagingEnabled
          renderItem={({ item, index }) => (
            <MediaPage
              active={index === currentIndex}
              asset={item}
              height={height}
              muted={muted}
              onEdgeSwipe={moveToAdjacentItem}
              onMutedChange={setMuted}
              onVideoEnd={index === currentIndex ? advancePlaylist : undefined}
              width={width}
            />
          )}
          showsHorizontalScrollIndicator={false}
          windowSize={3}
        />
      ) : (
        <ActivityIndicator color="#fff" size="large" />
      )}
      <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
        <SymbolView name="xmark" tintColor="#fff" size={19} />
      </Pressable>
      {currentAsset && (
        <View pointerEvents="none" style={styles.caption}>
          <Text style={styles.filename} numberOfLines={1}>{currentAsset.filename}</Text>
          <Text style={styles.date}>{new Date(currentAsset.capturedAt).toLocaleString()}</Text>
          {playlist && (
            <Text style={styles.playlistPosition}>
              {playlist === 'shuffle' ? 'Shuffle' : 'Play All'} · {currentIndex + 1} of {assets.length}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function MediaPage({
  active,
  asset,
  height,
  muted,
  onEdgeSwipe,
  onMutedChange,
  onVideoEnd,
  width,
}: {
  active: boolean;
  asset: LibraryAsset;
  height: number;
  muted: boolean;
  onEdgeSwipe: (direction: 'next' | 'previous') => void;
  onMutedChange: (muted: boolean) => void;
  onVideoEnd?: () => void;
  width: number;
}) {
  const uri = asset.uri;
  return (
    <View style={[styles.page, { width, height }]}>
      {asset.mediaKind === 'image' ? (
        <ZoomableImage
          height={height}
          onEdgeSwipe={onEdgeSwipe}
          uri={uri}
          width={width}
        />
      ) : (
        <PagedVideo
          active={active}
          height={height}
          muted={muted}
          onEdgeSwipe={onEdgeSwipe}
          onEnd={onVideoEnd}
          onMutedChange={onMutedChange}
          uri={uri}
          width={width}
        />
      )}
    </View>
  );
}

function ZoomableImage({
  height,
  onEdgeSwipe,
  uri,
  width,
}: {
  height: number;
  onEdgeSwipe: (direction: 'next' | 'previous') => void;
  uri: string;
  width: number;
}) {
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

  return (
    <ZoomableMedia
      active
      height={height}
      mediaHeight={mediaSize.height}
      mediaWidth={mediaSize.width}
      onEdgeSwipe={onEdgeSwipe}
      width={width}>
      <Image
        source={uri}
        style={styles.media}
        contentFit="contain"
        onLoad={({ source }) => setMediaSize({ width: source.width, height: source.height })}
        transition={150}
      />
    </ZoomableMedia>
  );
}

function ZoomableMedia({
  active,
  children,
  height,
  mediaHeight,
  mediaWidth,
  nativeControls,
  onEdgeSwipe,
  width,
}: PropsWithChildren<{
  active: boolean;
  height: number;
  mediaHeight: number;
  mediaWidth: number;
  nativeControls?: boolean;
  onEdgeSwipe?: (direction: 'next' | 'previous') => void;
  width: number;
}>) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);
  const rawTranslationX = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translationX.value = withSpring(0);
    translationY.value = withSpring(0);
    savedTranslationX.value = 0;
    savedTranslationY.value = 0;
    rawTranslationX.value = 0;
  };

  const clampTranslation = (value: number, dimension: number, currentScale: number) => {
    'worklet';
    const limit = dimension * (currentScale - 1) / 2;
    return Math.max(-limit, Math.min(limit, value));
  };

  const fillScale = () => {
    'worklet';
    if (!mediaWidth || !mediaHeight) return 2;
    const mediaAspect = mediaWidth / mediaHeight;
    const viewportAspect = width / height;
    const containedWidth = mediaAspect > viewportAspect ? width : height * mediaAspect;
    const containedHeight = mediaAspect > viewportAspect ? width / mediaAspect : height;
    return Math.max(
      1,
      Math.min(4, Math.max(width / containedWidth, height / containedHeight)),
    );
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((event, success) => {
      if (!success) return;
      if (scale.value > 1.01) {
        reset();
      } else {
        const targetScale = fillScale();
        const targetX = clampTranslation(
          (width / 2 - event.x) * (targetScale - 1),
          width,
          targetScale,
        );
        const targetY = clampTranslation(
          (height / 2 - event.y) * (targetScale - 1),
          height,
          targetScale,
        );
        scale.value = withSpring(targetScale);
        savedScale.value = targetScale;
        translationX.value = withSpring(targetX);
        translationY.value = withSpring(targetY);
        savedTranslationX.value = targetX;
        savedTranslationY.value = targetY;
        rawTranslationX.value = targetX;
      }
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) reset();
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_, manager) => {
      if (scale.value > 1.01) manager.activate();
      else manager.fail();
    })
    .onUpdate((event) => {
      rawTranslationX.value = savedTranslationX.value + event.translationX;
      translationX.value = clampTranslation(
        rawTranslationX.value,
        width,
        scale.value,
      );
      translationY.value = clampTranslation(
        savedTranslationY.value + event.translationY,
        height,
        scale.value,
      );
    })
    .onEnd(() => {
      const horizontalLimit = width * (scale.value - 1) / 2;
      if (onEdgeSwipe && rawTranslationX.value > horizontalLimit + 70) {
        runOnJS(onEdgeSwipe)('previous');
      } else if (onEdgeSwipe && rawTranslationX.value < -horizontalLimit - 70) {
        runOnJS(onEdgeSwipe)('next');
      }
      savedTranslationX.value = translationX.value;
      savedTranslationY.value = translationY.value;
      rawTranslationX.value = translationX.value;
    });

  const nativeGesture = Gesture.Native();
  doubleTap.simultaneousWithExternalGesture(nativeGesture);
  pinch.simultaneousWithExternalGesture(nativeGesture);
  pan.simultaneousWithExternalGesture(nativeGesture);
  const gesture = Gesture.Simultaneous(doubleTap, pinch, pan);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));

  useEffect(() => {
    if (active) return;
    scale.value = withSpring(1);
    savedScale.value = 1;
    translationX.value = withSpring(0);
    translationY.value = withSpring(0);
    savedTranslationX.value = 0;
    savedTranslationY.value = 0;
    rawTranslationX.value = 0;
  }, [
    active,
    savedScale,
    savedTranslationX,
    savedTranslationY,
    rawTranslationX,
    scale,
    translationX,
    translationY,
  ]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.media, animatedStyle]}>
        {nativeControls ? (
          <GestureDetector gesture={nativeGesture}>{children}</GestureDetector>
        ) : children}
      </Animated.View>
    </GestureDetector>
  );
}

function PagedVideo({
  active,
  height,
  muted,
  onEdgeSwipe,
  onEnd,
  onMutedChange,
  uri,
  width,
}: {
  active: boolean;
  height: number;
  muted: boolean;
  onEdgeSwipe: (direction: 'next' | 'previous') => void;
  onEnd?: () => void;
  onMutedChange: (muted: boolean) => void;
  uri: string;
  width: number;
}) {
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const player = useVideoPlayer(uri, (value) => {
    value.muted = muted;
    if (active) value.play();
  });

  useEffect(() => {
    player.muted = muted;
    if (active) player.play();
    else player.pause();
  }, [active, muted, player]);

  useEffect(() => {
    const subscription = player.addListener('mutedChange', ({ muted: value }) => {
      onMutedChange(value);
    });
    return () => subscription.remove();
  }, [onMutedChange, player]);

  useEffect(() => {
    const subscription = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
      const size = availableVideoTracks[0]?.size;
      if (size) setMediaSize(size);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!onEnd) return;
    const subscription = player.addListener('playToEnd', onEnd);
    return () => subscription.remove();
  }, [onEnd, player]);

  return (
    <ZoomableMedia
      active={active}
      height={height}
      mediaHeight={mediaSize.height}
      mediaWidth={mediaSize.width}
      nativeControls
      onEdgeSwipe={onEdgeSwipe}
      width={width}>
      <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />
    </ZoomableMedia>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  page: { alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
  close: { position: 'absolute', zIndex: 2, top: 56, left: 18, width: 36, height: 36, borderRadius: 18, backgroundColor: '#28282cbb', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: 34, left: 20, right: 20, alignItems: 'center' },
  filename: { color: '#fff', fontSize: 14, fontWeight: '600' },
  date: { color: '#c4c5c9', fontSize: 12, marginTop: 3 },
  playlistPosition: { color: '#8f9198', fontSize: 11, marginTop: 5 },
  unavailableTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 14 },
  unavailableBody: { color: '#c4c5c9', fontSize: 14, marginTop: 7 },
});
