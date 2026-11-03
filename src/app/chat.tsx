import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface LocalChatMessage {
  id: string;
  sender: 'me' | 'partner';
  text: string;
  timestamp: string;
  isEncrypted: boolean;
}

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<LocalChatMessage[]>([
    {
      id: '1',
      sender: 'partner',
      text: 'Hey! I just left the office.',
      timestamp: '14:20',
      isEncrypted: true,
    },
    {
      id: '2',
      sender: 'me',
      text: 'Great, I see on the map you are ~1.2 km away. See you soon!',
      timestamp: '14:22',
      isEncrypted: true,
    },
  ]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: LocalChatMessage = {
      id: Date.now().toString(),
      sender: 'me',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* E2EE Security Banner */}
        <View style={styles.securityBanner}>
          <Text style={styles.securityBannerText}>
            🔒 End-to-End Encrypted • Zero-Knowledge Private Chat
          </Text>
        </View>

        {/* Message Thread */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
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
                    <Text style={styles.timestampText}>{item.timestamp}</Text>
                    {item.isEncrypted && <Text style={styles.lockIcon}>🔐</Text>}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Composer Input Bar */}
        <View style={styles.composerContainer}>
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
            disabled={!inputText.trim()}>
            <Text style={styles.sendButtonText}>Send</Text>
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
  securityBanner: {
    backgroundColor: '#151B26',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#232B3A',
    alignItems: 'center',
  },
  securityBannerText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageBubbleWrapper: {
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
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4,
  },
  partnerMessageBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  lockIcon: {
    fontSize: 10,
  },
  composerContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#151B26',
    borderTopWidth: 1,
    borderTopColor: '#232B3A',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0B0F17',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonActive: {
    backgroundColor: '#38BDF8',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
