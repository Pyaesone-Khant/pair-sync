import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../presentation/stores/location-store';
import { PartnerStatusCard } from '../presentation/components/PartnerStatusCard';
import { LocationTrackingStateMachine, LocationStateMode } from '../domain/location/location-state-machine';

/**
 * Radar & Ambient Presence Screen.
 * Strictly adheres to CONTEXT.md, ADR 0003, and frontend-design principles.
 */
export default function RadarScreen() {
  const router = useRouter();
  const [stateMachine] = useState(() => new LocationTrackingStateMachine());
  const [currentMode, setCurrentMode] = useState<LocationStateMode>(LocationStateMode.Stationary);

  const myTelemetry = useLocationStore((state) => state.myTelemetry);
  const peerTelemetry = useLocationStore((state) => state.peerTelemetry);
  const updateMyTelemetry = useLocationStore((state) => state.updateMyTelemetry);
  const updatePeerTelemetry = useLocationStore((state) => state.updatePeerTelemetry);
  const setPeerViewingMe = useLocationStore((state) => state.setPeerViewingMe);

  useEffect(() => {
    // Seed initial demo coordinates if not set
    if (!myTelemetry.coordinate) {
      updateMyTelemetry({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        batteryPercent: 88,
        isCharging: false,
        motionActivity: 'Stationary',
      });
    }

    if (!peerTelemetry.coordinate) {
      updatePeerTelemetry({
        coordinate: { latitude: 37.7833, longitude: -122.4167 },
        batteryPercent: 42,
        isCharging: true,
        motionActivity: 'Walking',
      });
    }
  }, [myTelemetry.coordinate, peerTelemetry.coordinate, updateMyTelemetry, updatePeerTelemetry]);

  const handleToggleMotion = () => {
    const isCurrentlyMoving = currentMode === LocationStateMode.Transit;
    stateMachine.onMotionActivityChanged({
      isMoving: !isCurrentlyMoving,
      confidence: 'high',
    });
    const newMode = stateMachine.getCurrentMode();
    setCurrentMode(newMode);

    updateMyTelemetry({
      motionActivity: !isCurrentlyMoving ? 'Walking' : 'Stationary',
    });
  };

  const handleTogglePeerGaze = () => {
    const isCurrentlyViewing = stateMachine.getCurrentMode() === LocationStateMode.LiveViewing;
    stateMachine.onPeerGazeChanged({ isViewing: !isCurrentlyViewing });
    const newMode = stateMachine.getCurrentMode();
    setCurrentMode(newMode);
    setPeerViewingMe(!isCurrentlyViewing);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top App Bar */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brandTitle}>PairSync</Text>
            <Text style={styles.connectionBadge}>● Connected • End-to-End Encrypted</Text>
          </View>

          <View style={styles.modePill}>
            <Text style={styles.modePillLabel}>Mode:</Text>
            <Text style={styles.modePillValue}>{currentMode}</Text>
          </View>
        </View>

        {/* Ambient Radar Canvas */}
        <View style={styles.radarCanvas}>
          <View style={styles.radarRingOuter} />
          <View style={styles.radarRingMiddle} />
          <View style={styles.radarRingInner} />

          {/* User Node */}
          <View style={styles.userNode}>
            <Text style={styles.nodeLabel}>You</Text>
          </View>

          {/* Partner Node */}
          <View style={styles.peerNode}>
            <Text style={styles.nodeLabel}>Partner</Text>
          </View>
        </View>

        {/* Interactive Mode Simulator / Controls */}
        <View style={styles.simulatorCard}>
          <Text style={styles.simulatorTitle}>Adaptive Battery Engine (ADR 0003)</Text>
          <Text style={styles.simulatorSubtitle}>
            Updates: Every {stateMachine.getUpdateIntervalSeconds()}s • GPS:{' '}
            {stateMachine.isHighAccuracyGpsActive() ? 'High Precision' : 'Dormant (Power Saving)'}
          </Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlBtn} onPress={handleToggleMotion}>
              <Text style={styles.controlBtnText}>
                {currentMode === LocationStateMode.Transit ? 'Stop Moving' : 'Start Walking'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                stateMachine.getCurrentMode() === LocationStateMode.LiveViewing &&
                  styles.controlBtnActive,
              ]}
              onPress={handleTogglePeerGaze}>
              <Text style={styles.controlBtnText}>
                {stateMachine.getCurrentMode() === LocationStateMode.LiveViewing
                  ? 'Close Map Gaze'
                  : 'Simulate Live Gaze'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ambient Partner Status Card */}
        <PartnerStatusCard
          partnerName="My Partner"
          onInitiateCall={() => alert('Initiating native WebRTC CallSession with CallKit...')}
          onOpenChat={() => router.push('/chat')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  connectionBadge: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  modePillLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modePillValue: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  radarCanvas: {
    height: 280,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  radarRingOuter: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.1)',
  },
  radarRingMiddle: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
  },
  radarRingInner: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  userNode: {
    position: 'absolute',
    bottom: 50,
    left: 80,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  peerNode: {
    position: 'absolute',
    top: 50,
    right: 80,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F43F5E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F43F5E',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  nodeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  simulatorCard: {
    backgroundColor: '#151B26',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  simulatorTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
  },
  simulatorSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlBtnActive: {
    backgroundColor: '#F43F5E',
    borderColor: '#F43F5E',
  },
  controlBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
