import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocationStore } from '../presentation/stores/location-store';
import { PartnerStatusCard } from '../presentation/components/PartnerStatusCard';
import { useCallStore } from '../presentation/stores/call-store';
import { LocationTrackingStateMachine, LocationStateMode } from '../domain/location/location-state-machine';
import { getSignalingChannel } from '../infrastructure/network/supabase-signaling-channel';
import { HardwareLocationEngine } from '../infrastructure/location/hardware-location-engine';
import { BoundaryEvent } from '../domain/places/boundary-event';
import { BoundaryEventService } from '../application/services/boundary-event-service';
import { BoundaryEventBanner } from '../presentation/components/BoundaryEventBanner';
import { getDatabaseClient } from '../infrastructure/database/database-client';
import { useInterpolatedCoordinate } from '../presentation/hooks/useInterpolatedCoordinate';
import { Pair } from '../domain/pairing/pair';

const { width, height } = Dimensions.get('window');

interface DemoPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  icon?: string;
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

  const [activePair, setActivePair] = useState<Pair | null>(null);
  const [places, setPlaces] = useState<DemoPlace[]>([]);

  const myTelemetry = useLocationStore((state) => state.myTelemetry);
  const peerTelemetry = useLocationStore((state) => state.peerTelemetry);
  const updateMyTelemetry = useLocationStore((state) => state.updateMyTelemetry);
  const updatePeerTelemetry = useLocationStore((state) => state.updatePeerTelemetry);
  const setPeerViewingMe = useLocationStore((state) => state.setPeerViewingMe);

  // Initialize live Supabase blind relay channel
  const [signalingChannel] = useState(() => getSignalingChannel());

  // Dynamically load places from local SQLite database and refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      async function syncPlaces() {
        try {
          const stored = await getDatabaseClient().getRepositories().placeRepo.getAllPlaces();
          if (mounted) {
            setPlaces(
              stored.map((p) => ({
                id: p.id,
                name: p.name,
                latitude: p.coordinate.latitude,
                longitude: p.coordinate.longitude,
                radiusMeters: p.radiusMeters,
                icon: p.icon,
              }))
            );
          }
        } catch (err) {
          console.warn('[RadarScreen] Failed to load places from SQLite:', err);
        }
      }
      syncPlaces();
      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    let roomJoined: string | null = null;
    let unsubscribeLocation: (() => void) | null = null;
    let unsubscribeGaze: (() => void) | null = null;

    async function initPairAndSignaling() {
      try {
        const pair = await getDatabaseClient().getRepositories().pairRepo.getActivePair();
        if (!mounted) return;

        if (pair) {
          setActivePair(pair);
          roomJoined = pair.getPairRoomId();
          signalingChannel.joinPairRoom(roomJoined);

          // Listen for incoming live peer location packets
          unsubscribeLocation = signalingChannel.onLocationReceived((payload) => {
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

          unsubscribeGaze = signalingChannel.onPeerGazeReceived((isViewing) => {
            setPeerViewingMe(isViewing);
          });
        } else {
          setActivePair(null);
        }
      } catch (err) {
        console.warn('[RadarScreen] Error initializing pair bond:', err);
      }
    }

    initPairAndSignaling();

    // Listen for autonomous geofence boundary events
    const unsubscribeBoundary = boundaryService.onBoundaryEvent((event) => {
      setLatestBoundaryEvent(event);
    });

    // Start physical hardware GPS & Battery tracking engine
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
      mounted = false;
      locationEngine.stop();
      if (unsubscribeLocation) unsubscribeLocation();
      if (unsubscribeGaze) unsubscribeGaze();
      unsubscribeBoundary();
      if (roomJoined) signalingChannel.leavePairRoom();
    };
  }, [stateMachine, signalingChannel, boundaryService, updateMyTelemetry, updatePeerTelemetry, setPeerViewingMe]);

  const fitBothInView = () => {
    if (!mapRef.current) return;

    if (myTelemetry.coordinate && peerTelemetry.coordinate) {
      mapRef.current.fitToCoordinates(
        [myTelemetry.coordinate, peerTelemetry.coordinate],
        {
          edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
          animated: true,
        }
      );
    } else if (myTelemetry.coordinate) {
      centerOnMe();
    }
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

  const defaultCenter = { latitude: 16.8052, longitude: 96.1561 };
  const userCenter = myTelemetry.coordinate ?? defaultCenter;

  // Smooth 60fps algorithmic coordinate interpolation (ADR 0007)
  const { coordinate: animatedPeerCoord } = useInterpolatedCoordinate(
    peerTelemetry.coordinate,
    1200
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Real Native Interactive Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        userInterfaceStyle="dark"
        loadingEnabled={true}
        loadingIndicatorColor="#38BDF8"
        loadingBackgroundColor="#0B0F17"
        initialRegion={{
          latitude: userCenter.latitude,
          longitude: userCenter.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }}>
        {/* Safe Places Geofence Circles & Center Markers */}
        {places.map((place) => (
          <React.Fragment key={place.id}>
            <Circle
              center={{ latitude: place.latitude, longitude: place.longitude }}
              radius={place.radiusMeters}
              fillColor="rgba(56, 189, 248, 0.18)"
              strokeColor="#38BDF8"
              strokeWidth={1.5}
            />
            <Marker
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              title={place.name}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.placeMarkerBadge}>
                <Ionicons
                  name={(place.icon as keyof typeof Ionicons.glyphMap) || 'shield-checkmark'}
                  size={14}
                  color="#38BDF8"
                />
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* User Marker ("You") */}
        {myTelemetry.coordinate && (
          <Marker
            coordinate={myTelemetry.coordinate}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <View style={styles.userPulseRing} />
              <View style={styles.userDot}>
                <Text style={styles.markerText}>You</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Partner Marker ("Partner") with Coordinate Interpolation */}
        {activePair && peerTelemetry.coordinate && (
          <Marker
            coordinate={animatedPeerCoord ?? peerTelemetry.coordinate}
            title="Partner"
            anchor={{ x: 0.5, y: 0.8 }}>
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
                  color={
                    peerTelemetry.batteryPercent !== null && peerTelemetry.batteryPercent <= 20
                      ? '#EF4444'
                      : '#10B981'
                  }
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
        )}
      </MapView>

      {/* Autonomous Geofence Boundary Alert Banner */}
      <BoundaryEventBanner
        event={latestBoundaryEvent}
        onDismiss={() => setLatestBoundaryEvent(null)}
      />

      {/* Floating Top Header */}
      <SafeAreaView edges={['top']} style={styles.topOverlayContainer} pointerEvents="box-none">
        <View style={styles.topHeader} pointerEvents="box-none">
          <View style={styles.brandFloatingBadge}>
            <Text style={styles.brandTitle}>PairSync</Text>
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
          accessibilityLabel="Fit peers in view">
          <Ionicons name="scan-outline" size={20} color="#38BDF8" />
        </TouchableOpacity>

        {activePair && peerTelemetry.coordinate && (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={centerOnPartner}
            accessibilityLabel="Center on partner">
            <Ionicons name="heart" size={20} color="#F43F5E" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={centerOnMe}
          accessibilityLabel="Center on my location">
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
        {activePair ? (
          <>
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
            </View>

            {/* Ambient Partner Status Card */}
            <PartnerStatusCard
              partnerName="Partner"
              onInitiateCall={() => {
                const callId = useCallStore.getState().startOutgoingCall('Partner', false);
                signalingChannel.sendCallSignal({
                  type: 'offer',
                  callId,
                  senderDeviceId: activePair.localDeviceId,
                  isVideo: false,
                  timestamp: Date.now(),
                });
              }}
              onOpenChat={() => router.push('/chat')}
            />
          </>
        ) : (
          /* Unbonded State Banner */
          <View style={styles.unbondedCard}>
            <View style={styles.unbondedHeaderRow}>
              <View style={styles.unbondedIconBadge}>
                <Ionicons name="link-outline" size={22} color="#38BDF8" />
              </View>
              <View style={styles.unbondedTextCol}>
                <Text style={styles.unbondedTitle}>No Paired Partner</Text>
                <Text style={styles.unbondedSubtitle}>
                  Pair with your partner to share real-time location, safe places alerts, and encrypted chat.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pairNowBtn}
              onPress={() => router.push('/pair')}
              activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={16} color="#0B0F17" />
              <Text style={styles.pairNowBtnText}>Start Pairing Ceremony</Text>
            </TouchableOpacity>
          </View>
        )}
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
    ...StyleSheet.absoluteFill,
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  brandFloatingBadge: {
    backgroundColor: 'rgba(21, 27, 38, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(21, 27, 38, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modePillLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  modePillValue: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 130,
    gap: 12,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(21, 27, 38, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232B3A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  placeMarkerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0B0F17',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 104,
    left: 16,
    right: 16,
    gap: 8,
    paddingBottom: 4,
  },
  batteryEngineCard: {
    backgroundColor: 'rgba(21, 27, 38, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  engineTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  engineTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  engineStatus: {
    color: '#94A3B8',
    fontSize: 11,
  },
  unbondedCard: {
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#232B3A',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  unbondedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unbondedIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unbondedTextCol: {
    flex: 1,
  },
  unbondedTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  unbondedSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  pairNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
  },
  pairNowBtnText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulseRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    position: 'absolute',
  },
  userDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0B0F17',
  },
  peerMarkerContainer: {
    alignItems: 'center',
  },
  peerCalloutBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#151B26',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#232B3A',
    marginBottom: 4,
  },
  peerCalloutText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600',
  },
  peerCalloutDivider: {
    color: '#475569',
    fontSize: 10,
  },
  peerAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  peerAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  peerPinTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
  },
});
