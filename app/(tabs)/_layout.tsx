import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2878ff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.78)',
        tabBarStyle: {
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 18,
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.24)',
          borderRadius: 36,
          backgroundColor: 'rgba(40,40,44,0.72)',
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        tabBarItemStyle: { borderRadius: 28, marginHorizontal: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <SymbolView name="photo.on.rectangle.angled" tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <SymbolView name="gearshape.fill" tintColor={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
