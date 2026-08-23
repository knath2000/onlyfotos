import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryAsset } from '@/library/types';
import { useLibrary } from '@/library/LibraryProvider';

function durationLabel(value: number | null) {
  if (value == null) return '';
  const minutes = Math.floor(value / 60);
  return `${minutes}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

function dateLabel(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function LibraryScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const { assets, authorization, authorize, connection, progress, refresh } = useLibrary();
  const [visibleDate, setVisibleDate] = useState(() => assets[0]?.capturedAt ?? Date.now());
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const scrollY = useRef(new Animated.Value(0)).current;
  const suppressAssetPressUntil = useRef(0);
  const columns = width > 700 ? 6 : width > 430 ? 5 : 4;
  const tileSize = Math.floor((width - 4) / columns);
  const headerHeight = insets.top + 168;
  const backgroundColor = dark ? '#000' : '#fff';
  const textColor = dark ? '#fff' : '#101114';
  const status = useMemo(() => {
    if (progress.phase === 'enumerating') return `Indexing ${progress.indexed.toLocaleString()} items…`;
    if (connection === 'unavailable') return 'Hidden album unavailable · Tap refresh to retry';
    if (connection === 'permissionRevoked') return 'Full Photos access required';
    return null;
  }, [connection, progress]);
  const videos = useMemo(() => assets.filter((asset) => asset.mediaKind === 'video'), [assets]);

  const playVideos = (shuffle: boolean) => {
    const first = videos[0];
    if (!first) return;
    router.push({
      pathname: '/viewer/[id]',
      params: { id: first.id, playlist: shuffle ? 'shuffle' : 'all' },
    });
  };

  const showLibraryMenu = () => {
    const options = ['Refresh Library', 'Play All', 'Shuffle All', 'Cancel'];
    suppressAssetPressUntil.current = Number.POSITIVE_INFINITY;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 3,
        disabledButtonIndices: videos.length ? [] : [1, 2],
        userInterfaceStyle: 'dark',
      },
      (index) => {
        suppressAssetPressUntil.current = Date.now() + 400;
        if (index === 0) void refresh();
        if (index === 1) playVideos(false);
        if (index === 2) playVideos(true);
      },
    );
  };

  const toggleSelecting = () => {
    setSelecting((current) => !current);
    setSelectedIds(new Set());
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<LibraryAsset>[] }) => {
      const first = viewableItems
        .filter((token) => token.isViewable && token.item)
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))[0]?.item;
      if (first) setVisibleDate(first.capturedAt);
    },
  ).current;

  if (!assets.length) {
    return (
      <SafeAreaView style={[styles.empty, { backgroundColor }]}>
        <View style={styles.emptyIcon}>
          <SymbolView name="eye.slash.fill" tintColor="#2878ff" size={48} />
        </View>
        <Text style={[styles.emptyTitle, { color: textColor }]}>Your Hidden album, beautifully</Text>
        <Text style={styles.emptyBody}>
          {authorization === 'authorized'
            ? 'No hidden items were returned. Make sure Use Face ID for Hidden is turned off in Photos settings.'
            : 'Allow full Photos access to browse your iCloud Hidden album directly on this iPhone.'}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void (authorization === 'notDetermined' ? authorize() : authorization === 'authorized' ? refresh() : Linking.openSettings()).catch((error) => {
            Alert.alert('Photos access required', error instanceof Error ? error.message : 'Allow full Photos access in Settings.');
          })}>
          <Text style={styles.primaryButtonText}>
            {authorization === 'notDetermined'
              ? 'Allow Photos Access'
              : authorization === 'authorized'
                ? 'Refresh Hidden Album'
                : 'Open Settings'}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: LibraryAsset }) => (
    <Pressable
      accessibilityLabel={item.filename}
      onPress={() => {
        if (Date.now() < suppressAssetPressUntil.current) return;
        if (!selecting) {
          router.push({ pathname: '/viewer/[id]', params: { id: item.id } });
          return;
        }
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      }}
      style={{ width: tileSize, height: tileSize, padding: 1 }}>
      {item.thumbnailUri ? (
        <Image source={item.thumbnailUri} style={styles.thumbnail} contentFit="cover" recyclingKey={item.id} />
      ) : (
        <View style={[styles.thumbnailPlaceholder, dark && styles.thumbnailPlaceholderDark]}>
          <SymbolView
            name={item.mediaKind === 'video' ? 'video.fill' : 'photo.fill'}
            tintColor={dark ? '#666' : '#a1a5ab'}
            size={23}
          />
        </View>
      )}
      {item.mediaKind === 'video' && (
        <View style={styles.duration}>
          <SymbolView name="play.fill" tintColor="#fff" size={9} />
          <Text style={styles.durationText}>{durationLabel(item.duration)}</Text>
        </View>
      )}
      {selecting && (
        <View style={[styles.selectionCircle, selectedIds.has(item.id) && styles.selectionCircleSelected]}>
          {selectedIds.has(item.id) && <SymbolView name="checkmark" tintColor="#fff" size={13} />}
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={assets}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        extraData={`${columns}-${selecting}-${[...selectedIds].join(',')}`}
        contentContainerStyle={{ paddingTop: headerHeight }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
      />
      <View pointerEvents="box-none" style={[styles.libraryHeader, { height: headerHeight }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(0,0,0,0.68)',
            'rgba(0,0,0,0.48)',
            'rgba(0,0,0,0.20)',
            'rgba(0,0,0,0)',
          ]}
          locations={[0, 0.4, 0.76, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.headerShade,
            {
              opacity: scrollY.interpolate({
                inputRange: [0, 72],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
        <View style={[styles.headerContent, { paddingTop: insets.top + 38 }]}>
          <View>
            <Text style={styles.title}>Library</Text>
            <Text style={styles.date}>
              {selecting
                ? `${selectedIds.size.toLocaleString()} Selected`
                : status ?? dateLabel(visibleDate)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Library actions"
              disabled={progress.phase === 'enumerating'}
              onPress={showLibraryMenu}
              style={({ pressed }) => [styles.menuButton, pressed && styles.headerButtonPressed]}>
              <SymbolView name="line.3.horizontal" tintColor="#fff" size={24} />
            </Pressable>
            <Pressable
              onPress={toggleSelecting}
              style={({ pressed }) => [styles.selectButton, pressed && styles.headerButtonPressed]}>
              <Text style={styles.selectButtonText}>{selecting ? 'Cancel' : 'Select'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  libraryHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden' },
  headerShade: { backgroundColor: '#000' },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: { color: '#fff', fontSize: 48, lineHeight: 52, fontWeight: '700', letterSpacing: -1.8 },
  date: { color: '#fff', fontSize: 20, lineHeight: 25, fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 1 },
  menuButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 94, 98, 0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  selectButton: {
    height: 54,
    minWidth: 98,
    borderRadius: 27,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 94, 98, 0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  selectButtonText: { color: '#fff', fontSize: 21, fontWeight: '500' },
  headerButtonPressed: { opacity: 0.68, transform: [{ scale: 0.97 }] },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { width: '100%', height: '100%', backgroundColor: '#e9eaed', alignItems: 'center', justifyContent: 'center' },
  thumbnailPlaceholderDark: { backgroundColor: '#17181a' },
  duration: { position: 'absolute', right: 6, bottom: 5, flexDirection: 'row', gap: 3, alignItems: 'center' },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  selectionCircle: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleSelected: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyIcon: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#e8f1ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 25, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  emptyBody: { color: '#747982', fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 330, marginBottom: 28 },
  primaryButton: { backgroundColor: '#2878ff', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
