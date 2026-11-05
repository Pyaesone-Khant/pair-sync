import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor="#0B0F17"
      indicatorColor="#1E293B"
      labelStyle={{ selected: { color: '#38BDF8' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Radar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'location.north', selected: 'location.north.fill' }}
          md={{ default: 'explore', selected: 'explore' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="places">
        <NativeTabs.Trigger.Label>Places</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'shield', selected: 'shield.fill' }}
          md={{ default: 'shield', selected: 'shield' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
          md={{ default: 'chat_bubble', selected: 'chat_bubble' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="pair">
        <NativeTabs.Trigger.Label>Pairing</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'qrcode', selected: 'qrcode' }}
          md={{ default: 'qr_code', selected: 'qr_code' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'person', selected: 'person' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="pinpoint" hidden />
      <NativeTabs.Trigger name="auth/callback" hidden />
    </NativeTabs>
  );
}
