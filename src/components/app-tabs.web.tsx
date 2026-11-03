import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="radar" href="/" asChild>
            <TabButton>Radar</TabButton>
          </TabTrigger>
          <TabTrigger name="chat" href="/chat" asChild>
            <TabButton>Chat</TabButton>
          </TabTrigger>
          <TabTrigger name="places" href="/places" asChild>
            <TabButton>Places</TabButton>
          </TabTrigger>
          <TabTrigger name="pair" href="/pair" asChild>
            <TabButton>Pairing</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.tabButtonView, isFocused && styles.tabButtonViewSelected]}>
        <Text style={[styles.tabButtonText, isFocused && styles.tabButtonTextSelected]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <Text style={styles.brandText}>PairSync</Text>
        <View style={styles.tabGroup}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 16,
    width: '100%',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    backgroundColor: '#151B26',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 600,
    borderWidth: 1,
    borderColor: '#232B3A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  brandText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  tabButton: {
    borderRadius: 16,
  },
  tabButtonView: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tabButtonViewSelected: {
    backgroundColor: '#1E293B',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  tabButtonTextSelected: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
