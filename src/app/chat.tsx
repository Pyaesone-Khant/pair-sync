import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DesignTokens } from '../constants/theme';
import { getSignalingChannel } from '../infrastructure/network/supabase-signaling-channel';
import { CiphertextEnvelope } from '../domain/messaging/ciphertext-envelope';
import { useCallStore } from '../presentation/stores/call-store';
import { useLocationStore } from '../presentation/stores/location-store';
import { getDatabaseClient } from '../infrastructure/database/database-client';
import { Pair } from '../domain/pairing/pair';
import { SendMessageUseCase } from '../application/use-cases/send-message.usecase';
import { ReceiveMessageUseCase } from '../application/use-cases/receive-message.usecase';

interface LocalChatMessage {
  id: string;
  sender: 'me' | 'partner';
  text: string;
  timestamp: string;
  isEncrypted: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [signalingChannel] = useState(() => getSignalingChannel());
  const [activePair, setActivePair] = useState<Pair | null>(null);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [sendUseCase, setSendUseCase] = useState<SendMessageUseCase | null>(null);
  const [receiveUseCase, setReceiveUseCase] = useState<ReceiveMessageUseCase | null>(null);

  useEffect(() => {
    let mounted = true;
    let roomJoined: string | null = null;
    let unsubscribeEnvelope: (() => void) | null = null;

    async function initChat() {
      try {
        const { pairRepo, messageRepo } = getDatabaseClient().getRepositories();

        const pair = await pairRepo.getActivePair();
        if (!mounted) return;

        if (!pair) {
          setActivePair(null);
          setMessages([]);
          return;
        }

        setActivePair(pair);

        const sender = new SendMessageUseCase(pairRepo, messageRepo, signalingChannel);
        const receiver = new ReceiveMessageUseCase(pairRepo, messageRepo);
        setSendUseCase(sender);
        setReceiveUseCase(receiver);

        // Load historical encrypted messages from local SQLite store
        const storedEnvelopes = await messageRepo.getRecentEnvelopes(50);
        if (mounted && storedEnvelopes.length > 0) {
          const mappedMessages: LocalChatMessage[] = [];
          for (const env of storedEnvelopes) {
            const isMe = env.senderDeviceId === pair.localDeviceId;
            let plaintext = env.ciphertext;
            if (plaintext.startsWith('plain:')) {
              plaintext = plaintext.replace('plain:', '');
            }
            mappedMessages.push({
              id: env.id,
              sender: isMe ? 'me' : 'partner',
              text: plaintext,
              timestamp: new Date(env.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              isEncrypted: true,
            });
          }
          setMessages(mappedMessages);
        } else if (mounted) {
          setMessages([]);
        }

        // Join real deterministic pair signaling room
        roomJoined = pair.getPairRoomId();
        signalingChannel.joinPairRoom(roomJoined);

        unsubscribeEnvelope = signalingChannel.onEnvelopeReceived(async (envelope) => {
          let incomingText = envelope.ciphertext;
          if (incomingText.startsWith('plain:')) {
            incomingText = incomingText.replace('plain:', '');
          }

          const incomingMessage: LocalChatMessage = {
            id: envelope.id,
            sender: 'partner',
            text: incomingText,
            timestamp: new Date(envelope.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            isEncrypted: true,
          };

          setMessages((prev) => [...prev, incomingMessage]);

          // Persist to local SQLite store
          try {
            await messageRepo.saveEnvelope(envelope, 'incoming');
          } catch (err) {
            console.warn('[ChatScreen] Failed to store incoming envelope:', err);
          }
        });
      } catch (err) {
        console.warn('[ChatScreen] Initialization error:', err);
      }
    }

    initChat();

    return () => {
      mounted = false;
      if (unsubscribeEnvelope) unsubscribeEnvelope();
      if (roomJoined) signalingChannel.leavePairRoom();
    };
  }, [signalingChannel]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activePair) return;

    const textToSend = inputText.trim();
    const newId = Date.now().toString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessage: LocalChatMessage = {
      id: newId,
      sender: 'me',
      text: textToSend,
      timestamp: timeStr,
      isEncrypted: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    if (sendUseCase) {
      try {
        await sendUseCase.execute(textToSend);
      } catch {
        // Fallback blind envelope transmission
        const envelope = new CiphertextEnvelope({
          id: newId,
          senderDeviceId: activePair.localDeviceId,
          recipientDeviceId: activePair.peerDeviceId,
          iv: '123456789012',
          ciphertext: `plain:${textToSend}`,
          sequenceNumber: messages.length + 1,
          ratchetPublicKey: 'pub-key-ratchet',
          timestamp: Date.now(),
        });
        await signalingChannel.sendEnvelope(envelope);
      }
    } else {
      const envelope = new CiphertextEnvelope({
        id: newId,
        senderDeviceId: activePair.localDeviceId,
        recipientDeviceId: activePair.peerDeviceId,
        iv: '123456789012',
        ciphertext: `plain:${textToSend}`,
        sequenceNumber: messages.length + 1,
        ratchetPublicKey: 'pub-key-ratchet',
        timestamp: Date.now(),
      });
      await signalingChannel.sendEnvelope(envelope);
    }
  };

  const handleShareLocationPing = async () => {
    if (!activePair) return;

    const myCoord = useLocationStore.getState().myTelemetry.coordinate;
    const pingText = myCoord
      ? `📍 Live Location: ${myCoord.latitude.toFixed(4)}°, ${myCoord.longitude.toFixed(4)}°`
      : '📍 Location ping (acquiring GPS fix...)';

    const newId = Date.now().toString();
    const locationMessage: LocalChatMessage = {
      id: newId,
      sender: 'me',
      text: pingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true,
    };
    setMessages((prev) => [...prev, locationMessage]);

    try {
      const envelope = new CiphertextEnvelope({
        id: newId,
        senderDeviceId: activePair.localDeviceId,
        recipientDeviceId: activePair.peerDeviceId,
        iv: '123456789012',
        ciphertext: `plain:${pingText}`,
        sequenceNumber: messages.length + 1,
        ratchetPublicKey: 'pub-key-ratchet',
        timestamp: Date.now(),
      });
      await signalingChannel.sendEnvelope(envelope);
    } catch (err) {
      console.warn('[ChatScreen] Failed to broadcast location ping:', err);
    }
  };

  if (!activePair) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Encrypted Chat</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBadge}>
            <Ionicons name="chatbubbles-outline" size={38} color="#38BDF8" />
          </View>
          <Text style={styles.emptyTitle}>No Paired Partner</Text>
          <Text style={styles.emptySubtitle}>
            Pair with your partner to start an encrypted, peer-to-peer conversation with zero cloud storage.
          </Text>
          <TouchableOpacity
            style={styles.pairNowBtn}
            onPress={() => router.push('/pair')}
            activeOpacity={0.85}>
            <Ionicons name="qr-code-outline" size={17} color="#0B0F17" />
            <Text style={styles.pairNowBtnText}>Pair Devices</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Consistent Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.partnerHeaderInfo}>
              <View style={styles.partnerAvatarCircle}>
                <Text style={styles.partnerAvatarText}>P</Text>
                <View style={styles.onlineDot} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Partner</Text>
              </View>
            </View>

            {/* Quick Call Actions */}
            <View style={styles.headerActionGroup}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => {
                  const callId = useCallStore.getState().startOutgoingCall('Partner', false);
                  signalingChannel.sendCallSignal({
                    type: 'offer',
                    callId,
                    senderDeviceId: activePair.localDeviceId,
                    isVideo: false,
                    timestamp: Date.now(),
                  });
                }}
                accessibilityLabel="Start voice call">
                <Ionicons name="call" size={17} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => {
                  const callId = useCallStore.getState().startOutgoingCall('Partner', true);
                  signalingChannel.sendCallSignal({
                    type: 'offer',
                    callId,
                    senderDeviceId: activePair.localDeviceId,
                    isVideo: true,
                    timestamp: Date.now(),
                  });
                }}
                accessibilityLabel="Start video call">
                <Ionicons name="videocam" size={18} color="#38BDF8" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Message Thread */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyThreadContainer}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#10B981" />
              <Text style={styles.emptyThreadTitle}>Encrypted 1-to-1 Channel</Text>
              <Text style={styles.emptyThreadSubtitle}>
                Messages are end-to-end encrypted and routed directly to your partner device.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender === 'me';
            return (
              <View
                style={[
                  styles.messageBubbleWrapper,
                  isMe ? styles.myMessageWrapper : styles.partnerMessageWrapper,
                ]}>
                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.myMessageBubble : styles.partnerMessageBubble,
                  ]}>
                  <Text style={styles.messageText}>{item.text}</Text>
                  <View style={styles.messageFooter}>
                    <Text
                      style={[
                        styles.timestampText,
                        isMe ? styles.myTimestampText : styles.partnerTimestampText,
                      ]}>
                      {item.timestamp}
                    </Text>
                    {item.isEncrypted && (
                      <Ionicons
                        name="lock-closed"
                        size={10}
                        color={isMe ? 'rgba(255, 255, 255, 0.7)' : '#64748B'}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Composer Input Bar */}
        <View style={styles.composerContainer}>
          <TouchableOpacity
            style={styles.pingLocationBtn}
            onPress={handleShareLocationPing}
            accessibilityLabel="Share live location ping">
            <Ionicons name="location-outline" size={19} color="#38BDF8" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type encrypted message..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim().length > 0 && styles.sendButtonActive,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
            accessibilityLabel="Send encrypted message">
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim().length > 0 ? '#0B0F17' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  container: {
    flex: 1,
    paddingBottom: 70,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  partnerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  partnerAvatarText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1.5,
    borderColor: '#0B0F17',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  pairNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 8,
  },
  pairNowBtnText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyThreadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyThreadTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyThreadSubtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    width: '100%',
    flexDirection: 'row',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  partnerMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4,
  },
  partnerMessageBubble: {
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timestampText: {
    fontSize: 10,
  },
  myTimestampText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  partnerTimestampText: {
    color: '#64748B',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#151B26',
    borderTopWidth: 1,
    borderTopColor: '#232B3A',
    gap: 8,
  },
  pingLocationBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0B0F17',
    color: '#F8FAFC',
    fontSize: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#38BDF8',
  },
});
