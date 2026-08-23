import { SymbolView } from 'expo-symbols';
import { Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLibrary } from '@/library/LibraryProvider';

export function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const { assets, authorization, connection, progress, refresh, cancelScan } = useLibrary();
  const textColor = dark ? '#fff' : '#111216';
  const cardColor = dark ? '#1b1c1f' : '#f2f3f5';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: dark ? '#000' : '#fff' }]}>
      <Text style={[styles.title, { color: textColor }]}>Settings</Text>
      <Text style={styles.sectionTitle}>ICLOUD PHOTOS</Text>
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <Row icon="eye.slash.fill" label="Album" value="Hidden" />
        <Divider dark={dark} />
        <Row
          icon="photo.on.rectangle.angled"
          label="Photos access"
          value={authorization === 'authorized' ? 'Full Access' : authorization}
          onPress={authorization === 'authorized' ? undefined : () => void Linking.openSettings()}
        />
        <Divider dark={dark} />
        <Row
          icon="icloud.fill"
          label="Source"
          value={connection === 'connected' ? 'iCloud Photos' : 'Unavailable'}
        />
        <Divider dark={dark} />
        <Row
          icon="arrow.clockwise"
          label={progress.phase === 'enumerating' ? 'Cancel refresh' : 'Refresh library'}
          onPress={progress.phase === 'enumerating' ? cancelScan : () => void refresh()}
        />
      </View>
      <Text style={styles.sectionTitle}>LIBRARY</Text>
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <Row icon="photo.stack.fill" label="Hidden items" value={assets.length.toLocaleString()} />
        <Divider dark={dark} />
        <Row icon="lock.iphone" label="Originals" value="Managed by Photos" />
      </View>
      <Text style={styles.footnote}>
        OnlyFotos reads the Hidden album without changing, unhiding, moving, or deleting your photos. iCloud-only originals download on demand.
      </Text>
      <Text style={styles.footnote}>
        Apple must have Use Face ID for Hidden turned off. Free-account builds must be rebuilt and reinstalled every seven days.
      </Text>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <SymbolView name={icon} tintColor="#2878ff" size={20} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <SymbolView name="chevron.right" tintColor="#8e9299" size={13} /> : null}
    </Pressable>
  );
}

function Divider({ dark }: { dark: boolean }) {
  return <View style={[styles.divider, { backgroundColor: dark ? '#34363a' : '#dfe1e5' }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  title: { fontSize: 36, fontWeight: '700', letterSpacing: -1, marginTop: 10, marginBottom: 28 },
  sectionTitle: { color: '#747982', fontSize: 12, fontWeight: '600', marginLeft: 14, marginBottom: 7, marginTop: 14 },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
  rowLabel: { flex: 1, color: '#2878ff', fontSize: 16 },
  rowValue: { color: '#747982', fontSize: 15, maxWidth: '45%' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 47 },
  footnote: { color: '#747982', fontSize: 13, lineHeight: 18, marginHorizontal: 14, marginTop: 10 },
});
