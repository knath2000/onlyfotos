import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';

const TAB_ICONS: Record<string, SFSymbol> = {
  index: 'photo.on.rectangle.angled',
  settings: 'gearshape.fill',
};

function VerticalTabBubble({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.bubble}>
      <BlurView intensity={42} tint="dark" style={styles.blur} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? '#2878ff' : 'rgba(255,255,255,0.78)';
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={route.name === 'index' ? 'Library' : 'Settings'}
            onPress={onPress}
            hitSlop={6}
            style={styles.tab}
          >
            <SymbolView name={TAB_ICONS[route.name] ?? 'circle'} tintColor={color} size={24} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <VerticalTabBubble {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Library' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 14,
    bottom: 32,
    width: 54,
    paddingTop: 14,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 18,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    backgroundColor: 'rgba(125,105,96,0.32)',
    overflow: 'hidden',
  },
  tab: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
