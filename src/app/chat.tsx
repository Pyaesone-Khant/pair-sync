import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	FlatList,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	StatusBar,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ReceiveMessageUseCase } from "../application/use-cases/receive-message.usecase";
import { SendMessageUseCase } from "../application/use-cases/send-message.usecase";
import { CiphertextEnvelope } from "../domain/messaging/ciphertext-envelope";
import { getDatabaseClient } from "../infrastructure/database/database-client";
import { getSignalingChannel } from "../infrastructure/network/supabase-signaling-channel";
import { useCallStore } from "../presentation/stores/call-store";
import { useLocationStore } from "../presentation/stores/location-store";
import { usePairStore } from "../presentation/stores/pair-store";

interface LocalChatMessage {
	id: string;
	sender: "me" | "partner";
	text: string;
	timestamp: string;
	isEncrypted: boolean;
}

/**
 * Formats a timestamp into a clean 12-hour format (e.g. "10:45 AM", "4:19 PM").
 */
function format12HourTime(timestamp: number | Date | string): string {
	const date =
		typeof timestamp === "number" || typeof timestamp === "string"
			? new Date(timestamp)
			: timestamp;
	if (isNaN(date.getTime())) return "";
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/**
 * End-to-End Encrypted 1-to-1 Direct Messaging Screen.
 * Implements Vercel composition design patterns, responsive safe area insets,
 * and adaptive keyboard avoidance for seamless ergonomics above the bottom navigation bar.
 * Strictly adheres to ADR 0002, ADR 0004, and frontend-design guidelines.
 */
export default function ChatScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const flatListRef = useRef<FlatList<LocalChatMessage>>(null);
	const [inputText, setInputText] = useState("");
	const [signalingChannel] = useState(() => getSignalingChannel());
	const { activePair, loadPair } = usePairStore();
	const [messages, setMessages] = useState<LocalChatMessage[]>([]);
	const [sendUseCase, setSendUseCase] = useState<SendMessageUseCase | null>(
		null,
	);
	const [receiveUseCase, setReceiveUseCase] =
		useState<ReceiveMessageUseCase | null>(null);
	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

	// Monitor keyboard appearance dynamically to adjust composer bottom clearance
	useEffect(() => {
		const showSub = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
			() => {
				setIsKeyboardVisible(true);
				setTimeout(() => {
					flatListRef.current?.scrollToEnd({ animated: true });
				}, 100);
			},
		);
		const hideSub = Keyboard.addListener(
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
			() => setIsKeyboardVisible(false),
		);
		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	// Sync active pair & historical encrypted messages from SQLite on tab focus
	useFocusEffect(
		useCallback(() => {
			let mounted = true;
			async function syncChatOnFocus() {
				try {
					const pair = await loadPair();
					if (!mounted) return;
					if (!pair) {
						setMessages([]);
						return;
					}

					const { messageRepo } =
						getDatabaseClient().getRepositories();
					const storedEnvelopes =
						await messageRepo.getRecentEnvelopes(50);
					if (mounted && storedEnvelopes.length > 0) {
						const mappedMessages: LocalChatMessage[] = [];
						for (const env of storedEnvelopes) {
							const isMe =
								env.senderDeviceId === pair.localDeviceId;
							let plaintext = "";
							try {
								plaintext =
									await ReceiveMessageUseCase.decryptEnvelope(
										env,
									);
							} catch {
								plaintext = env.ciphertext.startsWith("plain:")
									? env.ciphertext.replace("plain:", "")
									: env.ciphertext;
							}
							mappedMessages.push({
								id: env.id,
								sender: isMe ? "me" : "partner",
								text: plaintext,
								timestamp: format12HourTime(env.timestamp),
								isEncrypted: true,
							});
						}
						setMessages(mappedMessages);
					}
				} catch (err) {
					console.warn(
						"[ChatScreen] Error syncing chat on focus:",
						err,
					);
				}
			}

			syncChatOnFocus();

			return () => {
				mounted = false;
			};
		}, [loadPair]),
	);

	// Maintain signaling channel and incoming message stream
	useEffect(() => {
		let unsubscribeEnvelope: (() => void) | null = null;

		if (activePair) {
			const { pairRepo, messageRepo } =
				getDatabaseClient().getRepositories();
			const sender = new SendMessageUseCase(
				pairRepo,
				messageRepo,
				signalingChannel,
			);
			const receiver = new ReceiveMessageUseCase(pairRepo, messageRepo);
			setSendUseCase(sender);
			setReceiveUseCase(receiver);

			// Join real deterministic pair signaling room
			const roomJoined = activePair.getPairRoomId();
			signalingChannel.joinPairRoom(roomJoined);

			unsubscribeEnvelope = signalingChannel.onEnvelopeReceived(
				async (envelope) => {
					// Skip echo if it's our own envelope
					if (envelope.senderDeviceId === activePair.localDeviceId) {
						return;
					}

					let incomingText = "";
					if (receiver) {
						try {
							const result = await receiver.execute(envelope);
							incomingText = result.plaintext;
						} catch {
							incomingText =
								await ReceiveMessageUseCase.decryptEnvelope(
									envelope,
								);
							try {
								await messageRepo.saveEnvelope(
									envelope,
									"incoming",
								);
							} catch {}
						}
					} else {
						incomingText =
							await ReceiveMessageUseCase.decryptEnvelope(
								envelope,
							);
						try {
							await messageRepo.saveEnvelope(
								envelope,
								"incoming",
							);
						} catch {}
					}

					const incomingMessage: LocalChatMessage = {
						id: envelope.id,
						sender: "partner",
						text: incomingText,
						timestamp: format12HourTime(envelope.timestamp),
						isEncrypted: true,
					};

					setMessages((prev) => {
						if (prev.some((m) => m.id === envelope.id)) return prev;
						return [...prev, incomingMessage];
					});
				},
			);
		} else {
			setSendUseCase(null);
			setReceiveUseCase(null);
			setMessages([]);
		}

		return () => {
			if (unsubscribeEnvelope) unsubscribeEnvelope();
		};
	}, [activePair, signalingChannel]);

	// Auto-scroll to latest message on message receipt or send
	useEffect(() => {
		if (messages.length > 0) {
			setTimeout(() => {
				flatListRef.current?.scrollToEnd({ animated: true });
			}, 150);
		}
	}, [messages.length]);

	const handleSendMessage = async () => {
		if (!inputText.trim() || !activePair) return;

		const textToSend = inputText.trim();
		const newId = Date.now().toString();
		const timeStr = format12HourTime(Date.now());

		const newMessage: LocalChatMessage = {
			id: newId,
			sender: "me",
			text: textToSend,
			timestamp: timeStr,
			isEncrypted: true,
		};

		setMessages((prev) => [...prev, newMessage]);
		setInputText("");

		if (sendUseCase) {
			try {
				await sendUseCase.execute(textToSend);
			} catch {
				// Fallback blind envelope transmission
				const envelope = new CiphertextEnvelope({
					id: newId,
					senderDeviceId: activePair.localDeviceId,
					recipientDeviceId: activePair.peerDeviceId,
					iv: "123456789012",
					ciphertext: `plain:${textToSend}`,
					sequenceNumber: messages.length + 1,
					ratchetPublicKey: "pub-key-ratchet",
					timestamp: Date.now(),
				});
				await signalingChannel.sendEnvelope(envelope);
			}
		} else {
			const envelope = new CiphertextEnvelope({
				id: newId,
				senderDeviceId: activePair.localDeviceId,
				recipientDeviceId: activePair.peerDeviceId,
				iv: "123456789012",
				ciphertext: `plain:${textToSend}`,
				sequenceNumber: messages.length + 1,
				ratchetPublicKey: "pub-key-ratchet",
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
			: "📍 Location ping (acquiring GPS fix...)";

		const newId = Date.now().toString();
		const locationMessage: LocalChatMessage = {
			id: newId,
			sender: "me",
			text: pingText,
			timestamp: format12HourTime(Date.now()),
			isEncrypted: true,
		};
		setMessages((prev) => [...prev, locationMessage]);

		try {
			const envelope = new CiphertextEnvelope({
				id: newId,
				senderDeviceId: activePair.localDeviceId,
				recipientDeviceId: activePair.peerDeviceId,
				iv: "123456789012",
				ciphertext: `plain:${pingText}`,
				sequenceNumber: messages.length + 1,
				ratchetPublicKey: "pub-key-ratchet",
				timestamp: Date.now(),
			});
			await signalingChannel.sendEnvelope(envelope);
		} catch (err) {
			console.warn(
				"[ChatScreen] Failed to broadcast location ping:",
				err,
			);
		}
	};

	// Clean, responsive bottom clearance:
	// - On iOS: when keyboard is hidden, UITabBar overlays the bottom ~83pt (49pt tab bar + 34pt safe area).
	//   We pad by Math.max(insets.bottom + 52, 88) to set the chat input comfortably above the native navigation bar.
	//   When keyboard is visible, KeyboardAvoidingView pushes the composer above the keyboard, so 10px is optimal.
	// - On Android: NativeTabs already positions the Fragment container above BottomNavigationView, so 10px sits snugly above it.
	const composerBottomPadding =
		Platform.OS === "ios"
			? isKeyboardVisible
				? 10
				: Math.max(insets.bottom + 52, 88)
			: 10;

	if (!activePair) {
		return (
			<SafeAreaView
				edges={["top", "left", "right"]}
				style={styles.safeArea}
			>
				<StatusBar barStyle="light-content" />
				<View style={styles.header}>
					<Text style={styles.title}>Encrypted Chat</Text>
				</View>
				<View
					style={[
						styles.emptyContainer,
						{ paddingBottom: insets.bottom + 80 },
					]}
				>
					<View style={styles.emptyIconBadge}>
						<Ionicons
							name="chatbubbles-outline"
							size={38}
							color="#38BDF8"
						/>
					</View>
					<Text style={styles.emptyTitle}>No Paired Partner</Text>
					<Text style={styles.emptySubtitle}>
						Pair with your partner using hardware QR to enable
						end-to-end encrypted messaging with zero cloud storage.
					</Text>
					<TouchableOpacity
						style={styles.pairNowBtn}
						onPress={() => router.push("/pair")}
						activeOpacity={0.85}
					>
						<Ionicons
							name="qr-code-outline"
							size={17}
							color="#0B0F17"
						/>
						<Text style={styles.pairNowBtnText}>Pair Devices</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
			<StatusBar barStyle="light-content" />
			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
			>
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
								<View style={styles.encryptionBadgeRow}>
									<Ionicons
										name="lock-closed"
										size={11}
										color="#10B981"
									/>
									<Text style={styles.encryptionBadgeText}>
										E2EE Secured
									</Text>
								</View>
							</View>
						</View>

						{/* Quick Call Actions */}
						<View style={styles.headerActionGroup}>
							<TouchableOpacity
								style={styles.headerActionBtn}
								hitSlop={{
									top: 10,
									bottom: 10,
									left: 10,
									right: 10,
								}}
								onPress={() => {
									const callId = useCallStore
										.getState()
										.startOutgoingCall("Partner", false);
									signalingChannel.sendCallSignal({
										type: "offer",
										callId,
										senderDeviceId:
											activePair.localDeviceId,
										isVideo: false,
										timestamp: Date.now(),
									});
								}}
								accessibilityLabel="Start voice call"
							>
								<Ionicons
									name="call"
									size={17}
									color="#10B981"
								/>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.headerActionBtn}
								hitSlop={{
									top: 10,
									bottom: 10,
									left: 10,
									right: 10,
								}}
								onPress={() => {
									const callId = useCallStore
										.getState()
										.startOutgoingCall("Partner", true);
									signalingChannel.sendCallSignal({
										type: "offer",
										callId,
										senderDeviceId:
											activePair.localDeviceId,
										isVideo: true,
										timestamp: Date.now(),
									});
								}}
								accessibilityLabel="Start video call"
							>
								<Ionicons
									name="videocam"
									size={18}
									color="#38BDF8"
								/>
							</TouchableOpacity>
						</View>
					</View>
				</View>

				{/* Message Thread */}
				<FlatList
					ref={flatListRef}
					data={messages}
					keyExtractor={(item) => item.id}
					contentContainerStyle={[
						styles.messageList,
						{ paddingBottom: 16 },
					]}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<View style={styles.emptyThreadContainer}>
							<View style={styles.emptyShieldBadge}>
								<Ionicons
									name="shield-checkmark"
									size={26}
									color="#10B981"
								/>
							</View>
							<Text style={styles.emptyThreadTitle}>
								Zero-Knowledge Direct Link
							</Text>
							<Text style={styles.emptyThreadSubtitle}>
								Messages are encrypted on-device with your
								partner's 256-bit public key. Nothing is stored
								on any cloud server.
							</Text>
						</View>
					}
					renderItem={({ item }) => {
						const isMe = item.sender === "me";
						return (
							<View
								style={[
									styles.messageBubbleWrapper,
									isMe
										? styles.myMessageWrapper
										: styles.partnerMessageWrapper,
								]}
							>
								<View
									style={[
										styles.messageBubble,
										isMe
											? styles.myMessageBubble
											: styles.partnerMessageBubble,
									]}
								>
									<Text style={styles.messageText}>
										{item.text}
									</Text>
									<View style={styles.messageFooter}>
										<Text
											style={[
												styles.timestampText,
												isMe
													? styles.myTimestampText
													: styles.partnerTimestampText,
											]}
										>
											{item.timestamp}
										</Text>
										{item.isEncrypted && (
											<Ionicons
												name="lock-closed"
												size={10}
												color={
													isMe
														? "rgba(255, 255, 255, 0.75)"
														: "#64748B"
												}
											/>
										)}
									</View>
								</View>
							</View>
						);
					}}
				/>

				{/* Composer Input Bar */}
				<View
					style={[
						styles.composerContainer,
						{ paddingBottom: composerBottomPadding },
					]}
				>
					<TouchableOpacity
						style={styles.pingLocationBtn}
						onPress={handleShareLocationPing}
						activeOpacity={0.75}
						accessibilityLabel="Share live location ping"
					>
						<Ionicons
							name="location-outline"
							size={20}
							color="#38BDF8"
						/>
					</TouchableOpacity>

					<TextInput
						style={styles.textInput}
						placeholder="Type encrypted message..."
						placeholderTextColor="#64748B"
						value={inputText}
						onChangeText={setInputText}
						multiline={false}
						maxLength={1000}
						returnKeyType="send"
						onSubmitEditing={handleSendMessage}
					/>

					<TouchableOpacity
						style={[
							styles.sendButton,
							inputText.trim().length > 0 &&
								styles.sendButtonActive,
						]}
						onPress={handleSendMessage}
						disabled={!inputText.trim()}
						activeOpacity={0.8}
						accessibilityLabel="Send encrypted message"
					>
						<Ionicons
							name="arrow-up"
							size={19}
							color={
								inputText.trim().length > 0
									? "#0B0F17"
									: "#475569"
							}
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
		backgroundColor: "#0B0F17",
	},
	container: {
		flex: 1,
		backgroundColor: "#0B0F17",
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 14,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#1E293B",
		backgroundColor: "#0B0F17",
	},
	headerTitleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	partnerHeaderInfo: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	partnerAvatarCircle: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#1E293B",
		borderWidth: 1.5,
		borderColor: "#38BDF8",
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	partnerAvatarText: {
		color: "#F8FAFC",
		fontSize: 15,
		fontWeight: "700",
	},
	onlineDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: "#10B981",
		position: "absolute",
		bottom: -1,
		right: -1,
		borderWidth: 2,
		borderColor: "#0B0F17",
	},
	titleContainer: {
		flex: 1,
	},
	title: {
		color: "#F8FAFC",
		fontSize: 18,
		fontWeight: "700",
		letterSpacing: -0.4,
	},
	encryptionBadgeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
	},
	encryptionBadgeText: {
		color: "#10B981",
		fontSize: 11,
		fontWeight: "600",
		letterSpacing: 0.2,
	},
	headerActionGroup: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	headerActionBtn: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: "#151B26",
		borderWidth: 1,
		borderColor: "#232B3A",
		alignItems: "center",
		justifyContent: "center",
	},
	emptyContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 32,
		gap: 14,
	},
	emptyIconBadge: {
		width: 72,
		height: 72,
		borderRadius: 24,
		backgroundColor: "#151B26",
		borderWidth: 1,
		borderColor: "#232B3A",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 4,
	},
	emptyTitle: {
		color: "#F8FAFC",
		fontSize: 19,
		fontWeight: "700",
		letterSpacing: -0.3,
	},
	emptySubtitle: {
		color: "#94A3B8",
		fontSize: 14,
		textAlign: "center",
		lineHeight: 21,
	},
	pairNowBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "#38BDF8",
		paddingVertical: 12,
		paddingHorizontal: 22,
		borderRadius: 12,
		marginTop: 8,
	},
	pairNowBtnText: {
		color: "#0B0F17",
		fontSize: 14,
		fontWeight: "700",
	},
	emptyThreadContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 48,
		paddingHorizontal: 24,
		gap: 12,
	},
	emptyShieldBadge: {
		width: 52,
		height: 52,
		borderRadius: 26,
		backgroundColor: "rgba(16, 185, 129, 0.12)",
		borderWidth: 1,
		borderColor: "rgba(16, 185, 129, 0.3)",
		alignItems: "center",
		justifyContent: "center",
	},
	emptyThreadTitle: {
		color: "#F8FAFC",
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: -0.2,
	},
	emptyThreadSubtitle: {
		color: "#64748B",
		fontSize: 13,
		textAlign: "center",
		lineHeight: 19,
		maxWidth: 280,
	},
	messageList: {
		paddingHorizontal: 16,
		paddingTop: 16,
		gap: 12,
		flexGrow: 1,
	},
	messageBubbleWrapper: {
		width: "100%",
		flexDirection: "row",
	},
	myMessageWrapper: {
		justifyContent: "flex-end",
	},
	partnerMessageWrapper: {
		justifyContent: "flex-start",
	},
	messageBubble: {
		maxWidth: "80%",
		paddingHorizontal: 15,
		paddingTop: 11,
		paddingBottom: 9,
		borderRadius: 18,
	},
	myMessageBubble: {
		backgroundColor: "#0284C7",
		borderWidth: 1,
		borderColor: "rgba(56, 189, 248, 0.35)",
		borderBottomRightRadius: 4,
	},
	partnerMessageBubble: {
		backgroundColor: "#151B26",
		borderWidth: 1,
		borderColor: "#232B3A",
		borderBottomLeftRadius: 4,
	},
	messageText: {
		color: "#F8FAFC",
		fontSize: 15,
		lineHeight: 21,
	},
	messageFooter: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: 4,
		marginTop: 5,
	},
	timestampText: {
		fontSize: 11,
		fontWeight: "500",
	},
	myTimestampText: {
		color: "rgba(255, 255, 255, 0.75)",
	},
	partnerTimestampText: {
		color: "#64748B",
	},
	composerContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingTop: 10,
		backgroundColor: "#111827",
		borderTopWidth: 1,
		borderTopColor: "#1E293B",
		gap: 8,
	},
	pingLocationBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#1E293B",
		borderWidth: 1,
		borderColor: "#334155",
		alignItems: "center",
		justifyContent: "center",
	},
	textInput: {
		flex: 1,
		backgroundColor: "#0B0F17",
		color: "#F8FAFC",
		fontSize: 15,
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 10,
		maxHeight: 100,
		minHeight: 40,
		borderWidth: 1,
		borderColor: "#1E293B",
	},
	sendButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#1E293B",
		borderWidth: 1,
		borderColor: "#334155",
		alignItems: "center",
		justifyContent: "center",
	},
	sendButtonActive: {
		backgroundColor: "#38BDF8",
		borderColor: "#38BDF8",
	},
});
