import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '../presentation/stores/location-store';
import { PartnerStatusCard } from '../presentation/components/PartnerStatusCard';
import { CallModal } from '../presentation/components/CallModal';
import { useCallStore } from '../presentation/stores/call-store';
import { LocationTrackingStateMachine, LocationStateMode } from '../domain/location/location-state-machine';
import { SupabaseSignalingChannel } from '../infrastructure/network/supabase-signaling-channel';
import { HardwareLocationEngine } from '../infrastructure/location/hardware-location-engine';
import { BoundaryEvent } from '../domain/places/boundary-event';
import { BoundaryEventService } from '../application/services/boundary-event-service';
import { BoundaryEventBanner } from '../presentation/components/BoundaryEventBanner';
import { getDatabaseClient } from '../infrastructure/database/database-client';

const { width, height } = Dimensions.get('window');

interface DemoPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export default function RadarScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [stateMachine] = useState(() => new LocationTrackingStateMachine());
  const [currentMode, setCurrentMode] = useState<LocationStateMode>(LocationStateMode.Stationary);
  const [latestBoundaryEvent, setLatestBoundaryEvent] = useState<BoundaryEvent | null>(null);
  const [boundaryService] = useState(
    () => new BoundaryEventService(getDatabaseClient().getRepositories().placeRepo)
  );

  const myTelemetry = useLocationStore((state) => state.myTelemetry);
  const peerTelemetry = useLocationStore((state) => state.peerTelemetry);
  const updateMyTelemetry = useLocationStore((state) => state.updateMyTelemetry);
  const updatePeerTelemetry = useLocationStore((state) => state.updatePeerTelemetry);
  const setPeerViewingMe = useLocationStore((state) => state.setPeerViewingMe);

  // Demo Places rendered as live geofence circles on the map
  const [places] = useState<DemoPlace[]>([
    {
      id: 'home',
      name: 'Home',
      latitude: 37.7749,
      longitude: -122.4194,
      radiusMeters: 120,
    },
    {
      id: 'office',
      name: 'Office',
      latitude: 37.7899,
      longitude: -122.4014,
      radiusMeters: 180,
    },
  ]);

  // Initialize live Supabase blind relay channel
  const [signalingChannel] = useState(() => new SupabaseSignalingChannel());

  useEffect(() => {
    // 1. Initial fallback seeds for simulator preview before GPS fix
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

    // 2. Connect to live Supabase Pair broadcast room
    signalingChannel.joinPairRoom('pair-primary');

    // 3. Listen for autonomous geofence boundary events
    const unsubscribeBoundary = boundaryService.onBoundaryEvent((event) => {
      setLatestBoundaryEvent(event);
    });

    // 4. Listen for incoming live peer location packets
    const unsubscribeLocation = signalingChannel.onLocationReceived((payload) => {
      const motion =
        payload.motionActivity === 'Driving' || payload.motionActivity === 'Walking'
          ? payload.motionActivity
          : 'Stationary';

      updatePeerTelemetry({
        coordinate: { latitude: payload.latitude, longitude: payload.longitude },
        batteryPercent: payload.batteryPercent ?? null,
        isCharging: Boolean(payload.isCharging),
        motionActivity: motion,
      });

      boundaryService.evaluateCoordinateChange('peer', {
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
    });

    const unsubscribeGaze = signalingChannel.onPeerGazeReceived((isViewing) => {
      setPeerViewingMe(isViewing);
    });

    const unsubscribeCall = signalingChannel.onCallSignalReceived((signal) => {
      if (signal.type === 'offer') {
        useCallStore.getState().receiveIncomingCall(signal.callId, 'My Partner', signal.isVideo);
      } else if (signal.type === 'answer') {
        useCallStore.getState().acceptCall();
      } else if (signal.type === 'hangup' || signal.type === 'reject') {
        useCallStore.getState().endCall();
      }
    });

    // 5. Start physical hardware GPS & Battery tracking engine
    const locationEngine = new HardwareLocationEngine({
      stateMachine,
      signalingPort: signalingChannel,
      onTelemetryUpdated: (telemetry) => {
        const motion =
          telemetry.motionActivity === 'Driving' || telemetry.motionActivity === 'Walking'
            ? telemetry.motionActivity
            : 'Stationary';

        updateMyTelemetry({
          coordinate: telemetry.coordinate,
          batteryPercent: telemetry.batteryPercent ?? null,
          isCharging: Boolean(telemetry.isCharging),
          motionActivity: motion,
        });

        boundaryService.evaluateCoordinateChange('me', telemetry.coordinate);
      },
    });

    locationEngine.start();

    return () => {
      locationEngine.stop();
      unsubscribeLocation();
      unsubscribeGaze();
      unsubscribeCall();
      unsubscribeBoundary();
      signalingChannel.leavePairRoom();
    };
  }, [stateMachine, signalingChannel, updateMyTelemetry, updatePeerTelemetry, setPeerViewingMe]);

  const fitBothInView = () => {
    if (!myTelemetry.coordinate || !peerTelemetry.coordinate || !mapRef.current) return;

    mapRef.current.fitToCoordinates(
      [myTelemetry.coordinate, peerTelemetry.coordinate],
      {
        edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
        animated: true,
      }
    );
  };

  const centerOnPartner = () => {
    if (!peerTelemetry.coordinate || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: peerTelemetry.coordinate.latitude,
        longitude: peerTelemetry.coordinate.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      800
    );
  };

  const centerOnMe = () => {
    if (!myTelemetry.coordinate || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: myTelemetry.coordinate.latitude,
        longitude: myTelemetry.coordinate.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      800
    );
  };

  const handleToggleMotion = () => {
    const isCurrentlyMoving = currentMode === LocationStateMode.Transit;
    const nextMoving = !isCurrentlyMoving;
    stateMachine.onMotionActivityChanged({
      isMoving: nextMoving,
      confidence: 'high',
    });
    const newMode = stateMachine.getCurrentMode();
    setCurrentMode(newMode);

    // If moving, simulate partner stepping into Home geofence (37.7749, -122.4194)
    // If stopping, step out into transit (37.7850, -122.4150)
    const newCoord = nextMoving
      ? { latitude: 37.7749, longitude: -122.4194 } // Home center
      : { latitude: 37.7850, longitude: -122.4150 }; // In transit
    const newMotion = nextMoving ? 'Walking' : 'Stationary';

    updatePeerTelemetry({
      coordinate: newCoord,
      motionActivity: newMotion,
    });

    boundaryService.evaluateCoordinateChange('peer', newCoord);
  };

  const handleTogglePeerGaze = () => {
    const isCurrentlyViewing = stateMachine.getCurrentMode() === LocationStateMode.LiveViewing;
    const nextViewingState = !isCurrentlyViewing;
    stateMachine.onPeerGazeChanged({ isViewing: nextViewingState });
    const newMode = stateMachine.getCurrentMode();
    setCurrentMode(newMode);
    setPeerViewingMe(nextViewingState);
    signalingChannel.sendPeerGaze(nextViewingState);
  };

  const myCoord = myTelemetry.coordinate ?? { latitude: 37.7749, longitude: -122.4194 };
  const peerCoord = peerTelemetry.coordinate ?? { latitude: 37.7833, longitude: -122.4167 };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Real Native Interactive Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: (myCoord.latitude + peerCoord.latitude) / 2,
          longitude: (myCoord.longitude + peerCoord.longitude) / 2,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }}>
        {/* Safe Places Geofence Circles */}
        {places.map((place) => (
          <Circle
            key={place.id}
            center={{ latitude: place.latitude, longitude: place.longitude }}
            radius={place.radiusMeters}
            fillColor="rgba(56, 189, 248, 0.18)"
            strokeColor="#38BDF8"
            strokeWidth={1.5}
          />
        ))}

        {/* User Marker ("You") */}
        <Marker coordinate={myCoord} title="You" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.userMarkerContainer}>
            <View style={styles.userPulseRing} />
            <View style={styles.userDot}>
              <Text style={styles.markerText}>You</Text>
            </View>
          </View>
        </Marker>

        {/* Partner Marker ("Partner") */}
        <Marker coordinate={peerCoord} title="Partner" anchor={{ x: 0.5, y: 0.8 }}>
          <View style={styles.peerMarkerContainer}>
            <View style={styles.peerCalloutBubble}>
              <Ionicons
                name={
                  (peerTelemetry.batteryPercent ?? 0) <= 20
                    ? 'battery-dead'
                    : (peerTelemetry.batteryPercent ?? 0) <= 50
                    ? 'battery-half'
                    : 'battery-full'
                }
                size={12}
                color={peerTelemetry.batteryPercent !== null && peerTelemetry.batteryPercent <= 20 ? '#EF4444' : '#10B981'}
              />
              <Text style={styles.peerCalloutText}>
                {peerTelemetry.batteryPercent !== null ? `${peerTelemetry.batteryPercent}%` : '--%'}
              </Text>
              <Text style={styles.peerCalloutDivider}>•</Text>
              <Ionicons
                name={
                  peerTelemetry.motionActivity === 'Driving'
                    ? 'car-outline'
                    : peerTelemetry.motionActivity === 'Walking'
                    ? 'walk-outline'
                    : 'home-outline'
                }
                size={12}
                color="#F8FAFC"
              />
              <Text style={styles.peerCalloutText}>
                {peerTelemetry.motionActivity ?? 'Stationary'}
              </Text>
            </View>
            <View style={styles.peerAvatarCircle}>
              <Text style={styles.peerAvatarText}>P</Text>
            </View>
            <View style={styles.peerPinTip} />
          </View>
        </Marker>
      </MapView>

      {/* Autonomous Geofence Boundary Alert Banner */}
      <BoundaryEventBanner
        event={latestBoundaryEvent}
        onDismiss={() => setLatestBoundaryEvent(null)}
      />

      {/* Floating Top Header */}
      <SafeAreaView style={styles.topOverlayContainer}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brandTitle}>PairSync</Text>
            <View style={styles.connectionBadgeRow}>
              <Ionicons name="lock-closed" size={11} color="#10B981" />
              <Text style={styles.connectionBadge}>Encrypted • Connected</Text>
            </View>
          </View>

          <View style={styles.modePill}>
            <Text style={styles.modePillLabel}>Mode:</Text>
            <Text style={styles.modePillValue}>{currentMode}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Floating Camera Controls (Right Side) */}
      <View style={styles.floatingControls}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={fitBothInView}
          accessibilityLabel="Fit both peers in view">
          <Ionicons name="scan-outline" size={20} color="#38BDF8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={centerOnPartner}
          accessibilityLabel="Center camera on partner">
          <Ionicons name="heart" size={20} color="#F43F5E" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={centerOnMe}
          accessibilityLabel="Center camera on my location">
          <Ionicons name="navigate" size={20} color="#38BDF8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.push('/places')}
          accessibilityLabel="Manage Safe Places">
          <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      {/* Bottom Floating Control Panel */}
      <View style={styles.bottomOverlay}>
        {/* Battery Engine Info Card */}
        <View style={styles.batteryEngineCard}>
          <View style={styles.engineTextRow}>
            <View style={styles.engineTitleWithIcon}>
              <Ionicons name="hardware-chip-outline" size={14} color="#38BDF8" />
              <Text style={styles.engineTitle}>Adaptive Battery Engine</Text>
            </View>
            <Text style={styles.engineStatus}>
              {stateMachine.isHighAccuracyGpsActive()
                ? `High Accuracy (${stateMachine.getUpdateIntervalSeconds()}s)`
                : 'Power Saving (300s)'}
            </Text>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlBtn} onPress={handleToggleMotion}>
              <Ionicons
                name={currentMode === LocationStateMode.Transit ? 'pause-circle-outline' : 'walk-outline'}
                size={14}
                color="#F8FAFC"
              />
              <Text style={styles.controlBtnText}>
                {currentMode === LocationStateMode.Transit ? 'Stop Walking' : 'Simulate Walking'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                stateMachine.getCurrentMode() === LocationStateMode.LiveViewing &&
                  styles.controlBtnActive,
              ]}
              onPress={handleTogglePeerGaze}>
              <Ionicons
                name={
                  stateMachine.getCurrentMode() === LocationStateMode.LiveViewing
                    ? 'eye-off-outline'
                    : 'eye-outline'
                }
                size={14}
                color="#F8FAFC"
              />
              <Text style={styles.controlBtnText}>
                {stateMachine.getCurrentMode() === LocationStateMode.LiveViewing
                  ? 'Close Live Gaze'
                  : 'Simulate Live Gaze'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ambient Partner Status Card */}
        <PartnerStatusCard
          partnerName="My Partner"
          onInitiateCall={() => {
            const callId = useCallStore.getState().startOutgoingCall('My Partner', false);
            signalingChannel.sendCallSignal({
              type: 'offer',
              callId,
              senderDeviceId: 'local-device',
              isVideo: false,
              timestamp: Date.now(),
            });
          }}
          onOpenChat={() => router.push('/chat')}
        />

        {/* WebRTC In-Call HUD Modal */}
        <CallModal
          onHangupSignal={(callId) => {
            signalingChannel.sendCallSignal({
              type: 'hangup',
              callId,
              senderDeviceId: 'local-device',
              timestamp: Date.now(),
            });
          }}
          onAnswerSignal={(callId) => {
            signalingChannel.sendCallSignal({
              type: 'answer',
              callId,
              senderDeviceId: 'local-device',
              timestamp: Date.now(),
            });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  map: {
    width,
    height,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(11, 15, 23, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  connectionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  connectionBadge: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
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
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 130,
    gap: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  circleBtnText: {
    fontSize: 18,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    paddingBottom: 6,
  },
  batteryEngineCard: {
    backgroundColor: 'rgba(21, 27, 38, 0.95)',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  engineTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  engineTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  engineStatus: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlBtnActive: {
    backgroundColor: '#F43F5E',
    borderColor: '#F43F5E',
  },
  controlBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  userMarkerContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
  },
  userDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  peerMarkerContainer: {
    alignItems: 'center',
  },
  peerCalloutBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 27, 38, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F43F5E',
    marginBottom: 4,
    gap: 4,
  },
  peerCalloutDivider: {
    color: '#64748B',
    fontSize: 10,
    marginHorizontal: 1,
  },
  peerCalloutText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600',
  },
  peerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F43F5E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#F43F5E',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  peerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  peerPinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F43F5E',
  },
});
