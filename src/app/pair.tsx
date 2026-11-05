import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { QRCodeDisplay } from '../presentation/components/QRCodeDisplay';
import {
  getDeviceKeyManager,
  getOrCreateLocalDeviceId,
} from '../infrastructure/security/device-key-manager';
import { PairDeviceUseCase, PairingPayload } from '../application/use-cases/pair-device.usecase';
import { getDatabaseClient } from '../infrastructure/database/database-client';
import { Pair } from '../domain/pairing/pair';
import { usePairStore } from '../presentation/stores/pair-store';
import { computeSafetyNumber } from '../presentation/utils/safety-number';
import { getSignalingChannel } from '../infrastructure/network/supabase-signaling-channel';

export default function PairingScreen() {
  const [activeTab, setActiveTab] = useState<'myCode' | 'scanner'>('myCode');
  const [pairingPayload, setPairingPayload] = useState<PairingPayload | null>(null);
  const [safetyNumber, setSafetyNumber] = useState<string>('');
  const { activePair, setPair, unpair } = usePairStore();
  const isPaired = Boolean(activePair);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [pairUseCase, setPairUseCase] = useState<PairDeviceUseCase | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const refreshPayload = useCallback(async (showToast = false) => {
    if (!pairUseCase) return;
    try {
      setIsRefreshing(true);
      const payload = await pairUseCase.generatePairingPayload();
      setPairingPayload(payload);

      const currentPair = await getDatabaseClient().getRepositories().pairRepo.getActivePair();
      if (currentPair?.peerPublicKey) {
        const combined = [payload.publicKey, currentPair.peerPublicKey].sort().join(':');
        setSafetyNumber(computeSafetyNumber(combined));
      } else {
        setSafetyNumber(computeSafetyNumber(payload.publicKey));
      }

      if (showToast) {
        Alert.alert('QR Code Refreshed', 'Fresh cryptographic payload generated. Valid for 15 minutes.');
      }
    } catch (err) {
      console.warn('[PairingScreen] Failed to refresh payload:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [pairUseCase]);

  useEffect(() => {
    let mounted = true;

    async function initKeysAndPayload() {
      try {
        const localDeviceId = await getOrCreateLocalDeviceId();
        const keyManager = getDeviceKeyManager();
        const pairRepo = getDatabaseClient().getRepositories().pairRepo;
        const useCase = new PairDeviceUseCase(localDeviceId, keyManager, pairRepo);

        if (!mounted) return;
        setPairUseCase(useCase);

        // Check if device already has an active pair bond in SQLite & Zustand
        const currentPair = await usePairStore.getState().loadPair();

        // Generate real cryptographic payload
        const payload = await useCase.generatePairingPayload();
        if (!mounted) return;
        setPairingPayload(payload);

        // Deterministic cryptographic safety number (Signal-style, no negative numbers)
        if (currentPair?.peerPublicKey) {
          const combined = [payload.publicKey, currentPair.peerPublicKey].sort().join(':');
          setSafetyNumber(computeSafetyNumber(combined));
        } else if (payload.publicKey) {
          setSafetyNumber(computeSafetyNumber(payload.publicKey));
        }
      } catch (err) {
        console.warn('[PairingScreen] Error initializing cryptographic keys:', err);
      }
    }

    initKeysAndPayload();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-refresh payload when returning to screen if it has aged > 5 minutes
  useFocusEffect(
    useCallback(() => {
      usePairStore.getState().loadPair();
      if (pairingPayload && Date.now() - pairingPayload.timestamp > 5 * 60 * 1000) {
        refreshPayload(false);
      }
    }, [pairingPayload, refreshPayload])
  );

  // Listen for pairing handshake broadcast from counterparty (ADR 0001/0006)
  // Enables instant pairing without needing both devices to scan each other!
  useEffect(() => {
    if (isPaired || !pairUseCase || !pairingPayload) return;

    const signaling = getSignalingChannel();
    const unsubscribe = signaling.listenForPairingHandshake(
      pairingPayload.deviceId,
      async (counterpartyPayloadString) => {
        try {
          const verifiedPair = await pairUseCase.processScannedPayload(counterpartyPayloadString);
          await setPair(verifiedPair);

          if (pairingPayload.publicKey && verifiedPair.peerPublicKey) {
            const combined = [pairingPayload.publicKey, verifiedPair.peerPublicKey].sort().join(':');
            setSafetyNumber(computeSafetyNumber(combined));
          }

          Alert.alert(
            'Partner Scanned Your QR Code!',
            'Pair bond established successfully. Real-time location and messaging are now live!'
          );
        } catch (err) {
          console.warn('[PairingScreen] Failed to process incoming handshake:', err);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isPaired, pairUseCase, pairingPayload, setPair]);

  const handleShareInviteLink = async () => {
    try {
      const link = pairingPayload
        ? `pairsync://pair?deviceId=${encodeURIComponent(
            pairingPayload.deviceId
          )}&publicKey=${encodeURIComponent(pairingPayload.publicKey)}&timestamp=${
            pairingPayload.timestamp
          }&nonce=${encodeURIComponent(pairingPayload.nonce)}&sig=${encodeURIComponent(
            pairingPayload.signature
          )}`
        : 'pairsync://pair/invite';
      await Share.share({
        title: 'PairSync Secure Peer Invite',
        message: `Join my private 1-to-1 sync on PairSync: ${link}`,
        url: link,
      });
    } catch (err) {
      console.warn('[PairingScreen] Share invite failed:', err);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const link = pairingPayload
        ? `pairsync://pair?deviceId=${encodeURIComponent(
            pairingPayload.deviceId
          )}&publicKey=${encodeURIComponent(pairingPayload.publicKey)}&timestamp=${
            pairingPayload.timestamp
          }&nonce=${encodeURIComponent(pairingPayload.nonce)}&sig=${encodeURIComponent(
            pairingPayload.signature
          )}`
        : '';
      if (!link) return;
      await Clipboard.setStringAsync(link);
      Alert.alert(
        'Invite Link Copied!',
        'Pairing invite link copied to clipboard. Send it to your partner via chat or email.'
      );
    } catch (err) {
      console.warn('[PairingScreen] Copy invite link failed:', err);
    }
  };

  const handleImportFromPhotos = async () => {
    try {
      setIsImporting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;
      const scannedCodes = await scanFromURLAsync(imageUri, ['qr']);

      if (!scannedCodes || scannedCodes.length === 0 || !scannedCodes[0]?.data) {
        Alert.alert(
          'No QR Code Detected',
          'Could not find a readable QR code in the selected photo. Please make sure the screenshot or photo clearly displays your partner\'s PairSync QR code.'
        );
        return;
      }

      await handleBarcodeScanned({ data: scannedCodes[0].data });
    } catch (err: unknown) {
      console.warn('[PairingScreen] Photo import scan error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to scan image';
      Alert.alert('Photo Scan Failed', msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFromFiles = async () => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const scannedCodes = await scanFromURLAsync(fileUri, ['qr']);

      if (!scannedCodes || scannedCodes.length === 0 || !scannedCodes[0]?.data) {
        Alert.alert(
          'No QR Code Detected',
          'Could not find a readable QR code in the selected file. Please ensure the image contains a clear PairSync QR code.'
        );
        return;
      }

      await handleBarcodeScanned({ data: scannedCodes[0].data });
    } catch (err: unknown) {
      console.warn('[PairingScreen] File import scan error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to scan file';
      Alert.alert('File Scan Failed', msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        Alert.alert('Clipboard Empty', 'No pairing link or code was found in your clipboard.');
        return;
      }

      const trimmed = text.trim();
      if (
        !trimmed.includes('deviceId=') &&
        !trimmed.startsWith('pairsync://') &&
        !trimmed.startsWith('{')
      ) {
        Alert.alert(
          'Invalid Pairing Content',
          'The clipboard content does not look like a valid PairSync pairing link or payload.'
        );
        return;
      }

      await handleBarcodeScanned({ data: trimmed });
    } catch (err: unknown) {
      console.warn('[PairingScreen] Clipboard paste error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse clipboard data';
      Alert.alert('Paste Failed', msg);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || !pairUseCase) return;
    setScanned(true);

    try {
      const verifiedPair = await pairUseCase.processScannedPayload(data);
      await setPair(verifiedPair);

      // Symmetrically update safety number from combined keys
      if (pairingPayload?.publicKey && verifiedPair.peerPublicKey) {
        const combined = [pairingPayload.publicKey, verifiedPair.peerPublicKey].sort().join(':');
        setSafetyNumber(computeSafetyNumber(combined));
      }

      // Seamlessly notify counterparty via Realtime so their phone also activates immediately!
      if (pairingPayload) {
        const signaling = getSignalingChannel();
        await signaling.sendPairingHandshake(
          verifiedPair.peerDeviceId,
          JSON.stringify(pairingPayload)
        );
      }

      Alert.alert(
        'Hardware Pairing Verified',
        'Partner identity verified via cryptographic signature scan. Pair bond established!'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid QR code payload';
      Alert.alert('Scan Failed', msg, [
        {
          text: 'Scan Again',
          onPress: () => setScanned(false),
        },
      ]);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      'Unpair Partner',
      'Are you sure you want to remove this pair bond? Both devices will stop sharing real-time location, safe places alerts, and encrypted chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            try {
              await unpair();
              setScanned(false);
              if (pairingPayload?.publicKey) {
                setSafetyNumber(computeSafetyNumber(pairingPayload.publicKey));
              }
              Alert.alert('Device Unpaired', 'You are ready to pair with a new partner.');
            } catch (err) {
              console.warn('[PairingScreen] Unpair failed:', err);
            }
          },
        },
      ]
    );
  };

  const inviteUrl = pairingPayload
    ? `pairsync://pair?deviceId=${encodeURIComponent(
        pairingPayload.deviceId
      )}&publicKey=${encodeURIComponent(pairingPayload.publicKey)}&timestamp=${
        pairingPayload.timestamp
      }&nonce=${encodeURIComponent(pairingPayload.nonce)}&sig=${encodeURIComponent(
        pairingPayload.signature
      )}`
    : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* Consistent Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Pairing Ceremony</Text>
            </View>

            {/* Bond Status Badge */}
            <View
              style={[
                styles.bondBadge,
                isPaired ? styles.bondBadgeActive : styles.bondBadgeInactive,
              ]}>
              <Ionicons
                name={isPaired ? 'checkmark-circle' : 'radio-outline'}
                size={11}
                color={isPaired ? '#10B981' : '#38BDF8'}
              />
              <Text
                style={[
                  styles.bondBadgeText,
                  isPaired ? styles.bondBadgeTextActive : styles.bondBadgeTextInactive,
                ]}>
                {isPaired ? 'Bond Active' : 'Awaiting Pair'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchBtn, activeTab === 'myCode' && styles.switchBtnActive]}
            onPress={() => setActiveTab('myCode')}>
            <Ionicons
              name="qr-code-outline"
              size={15}
              color={activeTab === 'myCode' ? '#38BDF8' : '#94A3B8'}
            />
            <Text
              style={[
                styles.switchBtnText,
                activeTab === 'myCode' && styles.switchBtnTextActive,
              ]}>
              My QR Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchBtn, activeTab === 'scanner' && styles.switchBtnActive]}
            onPress={() => setActiveTab('scanner')}>
            <Ionicons
              name="scan-outline"
              size={15}
              color={activeTab === 'scanner' ? '#38BDF8' : '#94A3B8'}
            />
            <Text
              style={[
                styles.switchBtnText,
                activeTab === 'scanner' && styles.switchBtnTextActive,
              ]}>
              Scan Partner
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {activeTab === 'myCode' ? (
            <View style={styles.codeContainer}>
              {/* Real High-Resolution Scannable QR Box */}
              <View style={styles.qrCard}>
                <View style={styles.qrWhiteTile}>
                  {inviteUrl ? (
                    <QRCodeDisplay value={inviteUrl} size={196} />
                  ) : (
                    <ActivityIndicator size="large" color="#38BDF8" />
                  )}
                </View>
                <View style={styles.qrFooterRow}>
                  <Text style={styles.qrLabel}>Pairing QR Code</Text>
                  <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => refreshPayload(true)}
                    disabled={isRefreshing}
                    activeOpacity={0.7}>
                    <Ionicons
                      name="refresh-outline"
                      size={14}
                      color="#38BDF8"
                    />
                    <Text style={styles.refreshBtnText}>
                      {isRefreshing ? 'Refreshing...' : 'Refresh QR'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.qrExpiryHint}>Fresh payload • Valid for 15 minutes</Text>
              </View>

              {/* Cryptographic Safety Number */}
              <View style={styles.safetyCard}>
                <View style={styles.safetyHeaderRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
                  <Text style={styles.safetyLabel}>Safety Number</Text>
                </View>
                <Text style={styles.safetyNumber}>
                  {safetyNumber || 'Generating...'}
                </Text>
              </View>

              {/* Remote Invite Buttons */}
              <View style={styles.shareButtonsContainer}>
                <TouchableOpacity
                  style={styles.copyLinkBtn}
                  onPress={handleShareInviteLink}>
                  <Ionicons name="share-social-outline" size={16} color="#0B0F17" />
                  <Text style={styles.copyLinkText}>Share Invite Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copySecondaryBtn}
                  onPress={handleCopyInviteLink}
                  activeOpacity={0.75}>
                  <Ionicons name="copy-outline" size={16} color="#38BDF8" />
                  <Text style={styles.copySecondaryBtnText}>Copy Link</Text>
                </TouchableOpacity>
              </View>

              {/* Unpair Action if Paired */}
              {isPaired && (
                <TouchableOpacity
                  style={styles.unpairBtn}
                  onPress={handleUnpair}
                  activeOpacity={0.8}>
                  <Ionicons name="link-outline" size={16} color="#EF4444" />
                  <Text style={styles.unpairBtnText}>Unpair Device</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.scannerContainer}>
              <View style={styles.viewfinderCard}>
                <View style={styles.viewfinderBox}>
                  {permission?.granted ? (
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                      }}
                      onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    />
                  ) : (
                    <View style={styles.permissionPrompt}>
                      <Ionicons name="camera-outline" size={40} color="#64748B" />
                      <Text style={styles.permissionText}>
                        Camera access required to scan partner QR code
                      </Text>
                      <TouchableOpacity
                        style={styles.permissionBtn}
                        onPress={requestPermission}>
                        <Text style={styles.permissionBtnText}>Enable Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Four Corner Brackets */}
                  <View style={styles.viewfinderCornerTL} />
                  <View style={styles.viewfinderCornerTR} />
                  <View style={styles.viewfinderCornerBL} />
                  <View style={styles.viewfinderCornerBR} />

                  {/* Center Crosshair if permission granted */}
                  {permission?.granted && (
                    <Ionicons name="scan-outline" size={48} color="rgba(56, 189, 248, 0.5)" />
                  )}
                </View>
              </View>

              {/* Remote Pairing Options (Photos, Files, Clipboard) */}
              <View style={styles.remotePairingCard}>
                <View style={styles.remoteHeaderRow}>
                  <Ionicons name="cloud-download-outline" size={16} color="#38BDF8" />
                  <Text style={styles.remoteTitle}>Remote Pairing (Not Together)</Text>
                </View>
                <Text style={styles.remoteSubtitle}>
                  Import a shared QR screenshot from Photos/Files or paste a pairing link sent by your partner.
                </Text>

                <View style={styles.importButtonsRow}>
                  <TouchableOpacity
                    style={styles.importBtn}
                    onPress={handleImportFromPhotos}
                    disabled={isImporting}
                    activeOpacity={0.75}>
                    <Ionicons name="images-outline" size={17} color="#38BDF8" />
                    <Text style={styles.importBtnText}>Photos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.importBtn}
                    onPress={handleImportFromFiles}
                    disabled={isImporting}
                    activeOpacity={0.75}>
                    <Ionicons name="folder-open-outline" size={17} color="#38BDF8" />
                    <Text style={styles.importBtnText}>Files</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.importBtn}
                    onPress={handlePasteFromClipboard}
                    disabled={isImporting}
                    activeOpacity={0.75}>
                    <Ionicons name="clipboard-outline" size={17} color="#38BDF8" />
                    <Text style={styles.importBtnText}>Paste</Text>
                  </TouchableOpacity>
                </View>

                {isImporting && (
                  <View style={styles.importingOverlay}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.importingText}>Decoding QR code from image...</Text>
                  </View>
                )}
              </View>

              {isPaired ? (
                <View style={styles.pairedCard}>
                  <View style={styles.pairedRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <View style={styles.pairedTextCol}>
                      <Text style={styles.pairedTitle}>Bond Verified & Active</Text>
                      <Text style={styles.pairedSubtitle}>
                        Paired with {activePair?.peerDeviceId ?? 'Remote Partner'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.unpairSecondaryBtn}
                    onPress={handleUnpair}
                    activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text style={styles.unpairSecondaryBtnText}>Unpair Partner</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                scanned && (
                  <TouchableOpacity
                    style={styles.rescanBtn}
                    onPress={() => setScanned(false)}
                    activeOpacity={0.8}>
                    <Ionicons name="refresh-outline" size={16} color="#38BDF8" />
                    <Text style={styles.rescanBtnText}>Scan Again</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
        </ScrollView>
      </View>
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
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  bondBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  bondBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  bondBadgeInactive: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: '#38BDF8',
  },
  bondBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bondBadgeTextActive: {
    color: '#10B981',
  },
  bondBadgeTextInactive: {
    color: '#38BDF8',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#151B26',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  switchBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  switchBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
  },
  qrCard: {
    width: '100%',
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232B3A',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  qrWhiteTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  qrFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  refreshBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  qrExpiryHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  safetyCard: {
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#232B3A',
    alignItems: 'center',
    marginBottom: 14,
  },
  safetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  safetyLabel: {
    color: '#94A3B8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  safetyNumber: {
    color: '#38BDF8',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  shareButtonsContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  copyLinkBtn: {
    flex: 1,
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  copyLinkText: {
    color: '#0B0F17',
    fontSize: 13,
    fontWeight: '700',
  },
  copySecondaryBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  copySecondaryBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  unpairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginTop: 10,
  },
  unpairBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  scannerContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  viewfinderCard: {
    width: '100%',
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232B3A',
    marginBottom: 16,
  },
  viewfinderBox: {
    width: 250,
    height: 250,
    backgroundColor: '#0B0F17',
    borderRadius: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  permissionPrompt: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  permissionBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginTop: 4,
  },
  permissionBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  viewfinderCornerTL: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38BDF8',
  },
  viewfinderCornerTR: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38BDF8',
  },
  viewfinderCornerBL: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38BDF8',
  },
  viewfinderCornerBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38BDF8',
  },
  pairedCard: {
    width: '100%',
    backgroundColor: '#151B26',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#232B3A',
    gap: 14,
  },
  pairedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pairedTextCol: {
    flex: 1,
  },
  pairedTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  pairedSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  unpairSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  unpairSecondaryBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  rescanBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  remotePairingCard: {
    width: '100%',
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232B3A',
    marginBottom: 16,
  },
  remoteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  remoteTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  remoteSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  importButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  importBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  importingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
  },
  importingText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
  },
});
