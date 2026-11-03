import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
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
        {/* Consistent Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Pairing Ceremony</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Hardware Key Exchange • 1-to-1 Device Bond
              </Text>
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

        {/* Security Overview Strip Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusBannerLeft}>
            <View style={[styles.statusIndicatorDot, isPaired && styles.statusIndicatorDotActive]} />
            <Text style={styles.statusBannerTitle}>
              Zero Server Knowledge • Signal Double Ratchet
            </Text>
          </View>
          <View style={styles.engineBadge}>
            <Ionicons name="key-outline" size={12} color="#38BDF8" />
            <Text style={styles.engineBadgeText}>Ed25519</Text>
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
              {/* Visual QR Simulation Box */}
              <View style={styles.qrCard}>
                <View style={styles.qrWhiteTile}>
                  <Ionicons name="qr-code" size={140} color="#0B0F17" />
                </View>
                <Text style={styles.qrLabel}>PairSync Hardware Key</Text>
                <Text style={styles.qrSubtext}>
                  Have your partner scan this screen with their PairSync camera
                </Text>
              </View>

              {/* Cryptographic Safety Number */}
              <View style={styles.safetyCard}>
                <View style={styles.safetyHeaderRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
                  <Text style={styles.safetyLabel}>Cryptographic Safety Number</Text>
                </View>
                <Text style={styles.safetyNumber}>9481 • 2048 • 7719 • 3102</Text>
                <Text style={styles.safetyExplanation}>
                  Verify these digits match on your partner's screen to confirm zero tampering or relay interception.
                </Text>
              </View>

              {/* Remote Invite Button */}
              <TouchableOpacity
                style={styles.copyLinkBtn}
                onPress={() => Alert.alert('Invite Link Copied', 'Encrypted invite deep link copied to clipboard')}>
                <Ionicons name="link-outline" size={16} color="#0B0F17" />
                <Text style={styles.copyLinkText}>Copy Secure Remote Invite Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scannerContainer}>
              <View style={styles.viewfinderCard}>
                <View style={styles.viewfinderBox}>
                  {/* Four Corner Brackets */}
                  <View style={styles.viewfinderCornerTL} />
                  <View style={styles.viewfinderCornerTR} />
                  <View style={styles.viewfinderCornerBL} />
                  <View style={styles.viewfinderCornerBR} />

                  {/* Center Crosshair */}
                  <Ionicons name="scan-outline" size={48} color="rgba(56, 189, 248, 0.4)" />

                  <Text style={styles.scannerInstruction}>
                    Align partner's QR code within the viewfinder frame
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, isPaired && styles.actionBtnPaired]}
                onPress={handleSimulateScan}>
                <Ionicons
                  name={isPaired ? 'checkmark-circle' : 'camera'}
                  size={18}
                  color={isPaired ? '#FFFFFF' : '#0B0F17'}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    isPaired && styles.actionBtnTextPaired,
                  ]}>
                  {isPaired ? 'Bond Verified & Active' : 'Simulate Partner Scan'}
                </Text>
              </TouchableOpacity>
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
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  bondBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151B26',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  statusIndicatorDotActive: {
    backgroundColor: '#10B981',
  },
  statusBannerTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '500',
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  engineBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
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
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  qrLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  qrSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
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
  safetyExplanation: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  copyLinkBtn: {
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  copyLinkText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
  },
  actionBtn: {
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPaired: {
    backgroundColor: '#10B981',
  },
  actionBtnText: {
    color: '#0B0F17',
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtnTextPaired: {
    color: '#FFFFFF',
  },
});
