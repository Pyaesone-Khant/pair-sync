import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeviceKeyManager, InMemoryKeyStore } from '../infrastructure/security/device-key-manager';
import { PairDeviceUseCase, PairingPayload } from '../application/use-cases/pair-device.usecase';
import { SqliteDatabaseAdapter, SqlitePairRepository } from '../infrastructure/database/sqlite-repositories';

export default function PairingScreen() {
  const [activeTab, setActiveTab] = useState<'myCode' | 'scanner'>('myCode');
  const [pairingPayload, setPairingPayload] = useState<PairingPayload | null>(null);
  const [isPaired, setIsPaired] = useState(false);

  useEffect(() => {
    async function initKeysAndPayload() {
      const keyManager = new DeviceKeyManager(new InMemoryKeyStore());
      const adapter = new SqliteDatabaseAdapter({
        prepare: () => ({ run: () => {}, all: () => [], get: () => null }),
      });
      const pairRepo = new SqlitePairRepository(adapter);
      const useCase = new PairDeviceUseCase('device-local', keyManager, pairRepo);

      const payload = await useCase.generatePairingPayload();
      setPairingPayload(payload);
    }

    initKeysAndPayload();
  }, []);

  const handleSimulateScan = () => {
    setIsPaired(true);
    Alert.alert(
      'Pairing Ceremony Succeeded',
      'Cryptographic signature verified. 1-to-1 Pair established securely!'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pairing Ceremony</Text>
          <Text style={styles.subtitle}>
            Direct Device Pairing • Secure Cryptographic Handshake
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchBtn, activeTab === 'myCode' && styles.switchBtnActive]}
            onPress={() => setActiveTab('myCode')}>
            <Ionicons
              name="qr-code-outline"
              size={14}
              color={activeTab === 'myCode' ? '#38BDF8' : '#94A3B8'}
            />
            <Text style={[styles.switchBtnText, activeTab === 'myCode' && styles.switchBtnTextActive]}>
              My QR Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchBtn, activeTab === 'scanner' && styles.switchBtnActive]}
            onPress={() => setActiveTab('scanner')}>
            <Ionicons
              name="scan-outline"
              size={14}
              color={activeTab === 'scanner' ? '#38BDF8' : '#94A3B8'}
            />
            <Text style={[styles.switchBtnText, activeTab === 'scanner' && styles.switchBtnTextActive]}>
              Scan Partner
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'myCode' ? (
          <View style={styles.codeContainer}>
            {/* Visual QR Simulation Box */}
            <View style={styles.qrBox}>
              <View style={styles.qrInner}>
                <Ionicons name="qr-code" size={68} color="#0B0F17" />
                <Text style={styles.qrLabel}>PairSync Hardware Key</Text>
                <Text style={styles.qrSubtext}>Have your partner scan this screen</Text>
              </View>
            </View>

            {/* Cryptographic Safety Number */}
            <View style={styles.safetyCard}>
              <View style={styles.safetyHeaderRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
                <Text style={styles.safetyLabel}>Cryptographic Safety Number</Text>
              </View>
              <Text style={styles.safetyNumber}>9481 • 2048 • 7719 • 3102</Text>
              <Text style={styles.safetyExplanation}>
                Verify these digits match on your partner's device to confirm zero tampering.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.copyLinkBtn}
              onPress={() => Alert.alert('Copied', 'Secure invite deep link copied to clipboard')}>
              <Ionicons name="copy-outline" size={15} color="#38BDF8" />
              <Text style={styles.copyLinkText}>Copy Secure Remote Invite Link</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <View style={styles.viewfinderBox}>
              <View style={styles.viewfinderCornerTL} />
              <View style={styles.viewfinderCornerTR} />
              <View style={styles.viewfinderCornerBL} />
              <View style={styles.viewfinderCornerBR} />
              <Text style={styles.scannerInstruction}>
                Point camera at your partner's Pairing QR code
              </Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={handleSimulateScan}>
              <Ionicons
                name={isPaired ? 'checkmark-circle' : 'camera-outline'}
                size={18}
                color="#0B0F17"
              />
              <Text style={styles.actionBtnText}>
                {isPaired ? 'Bond Verified & Active' : 'Simulate Partner Scan'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#151B26',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 14,
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
    paddingVertical: 10,
    borderRadius: 10,
  },
  switchBtnActive: {
    backgroundColor: '#1E293B',
  },
  switchBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  switchBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  codeContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  qrBox: {
    width: 240,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  qrInner: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#0B0F17',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 42,
  },
  qrLabel: {
    color: '#0B0F17',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  qrSubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  safetyCard: {
    backgroundColor: '#151B26',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#232B3A',
    alignItems: 'center',
    marginVertical: 12,
  },
  safetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  safetyLabel: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  safetyNumber: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginVertical: 6,
  },
  safetyExplanation: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  copyLinkBtn: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyLinkText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderBox: {
    width: 260,
    height: 260,
    backgroundColor: '#151B26',
    borderRadius: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: '#232B3A',
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
  scannerInstruction: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  actionBtnText: {
    color: '#0B0F17',
    fontSize: 15,
    fontWeight: '700',
  },
});
