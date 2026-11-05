import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePinpointStore } from '../presentation/stores/pinpoint-store';
import { useLocationStore } from '../presentation/stores/location-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RADIUS_OPTIONS = [50, 100, 150, 250, 500];

export default function PinpointScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const {
    initialCoordinate,
    currentCoordinate,
    radiusMeters,
    placeName,
    setCoordinate,
    setRadiusMeters,
    confirmPinpoint,
    closePinpoint,
  } = usePinpointStore();

  const myTelemetry = useLocationStore((state) => state.myTelemetry);

  const handleConfirm = () => {
    confirmPinpoint();
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleClose = () => {
    closePinpoint();
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleSnapToMyGPS = () => {
    const userCoord = myTelemetry.coordinate;
    if (userCoord && mapRef.current) {
      setCoordinate(userCoord);
      mapRef.current.animateToRegion(
        {
          latitude: userCoord.latitude,
          longitude: userCoord.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        400
      );
    }
  };

  const handleCenterOnMarker = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentCoordinate.latitude,
          longitude: currentCoordinate.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        400
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Fullscreen MapKit Interactive View (identical to Radar Screen) */}
      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: initialCoordinate.latitude,
          longitude: initialCoordinate.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        onPress={(e) => {
          setCoordinate(e.nativeEvent.coordinate);
        }}
        onLongPress={(e) => {
          setCoordinate(e.nativeEvent.coordinate);
        }}>
        {/* Geofence Perimeter Circle */}
        <Circle
          center={currentCoordinate}
          radius={radiusMeters}
          fillColor="rgba(56, 189, 248, 0.22)"
          strokeColor="#38BDF8"
          strokeWidth={2}
        />

        {/* Draggable Native Marker (No custom children -> MKMarkerAnnotationView allows dragging) */}
        <Marker
          coordinate={currentCoordinate}
          draggable
          pinColor="#38BDF8"
          onDragEnd={(e) => {
            setCoordinate(e.nativeEvent.coordinate);
          }}
        />
      </MapView>

      {/* Floating Top Header */}
      <View style={[styles.topHeader, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.iconCircleBtn}
          onPress={handleClose}
          activeOpacity={0.7}
          accessibilityLabel="Back and Cancel">
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {placeName ? placeName : 'Pinpoint Location'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentCoordinate.latitude.toFixed(4)}°, {currentCoordinate.longitude.toFixed(4)}°
          </Text>
        </View>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={handleConfirm}
          activeOpacity={0.8}
          accessibilityLabel="Done">
          <Ionicons name="checkmark" size={16} color="#0B0F17" />
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Center / GPS Quick Actions */}
      <View style={[styles.floatingSideControls, { bottom: insets.bottom + 195 }]}>
        <TouchableOpacity
          style={styles.sideFab}
          onPress={handleCenterOnMarker}
          activeOpacity={0.7}
          accessibilityLabel="Center on Marker">
          <Ionicons name="locate" size={20} color="#38BDF8" />
        </TouchableOpacity>

        {myTelemetry.coordinate && (
          <TouchableOpacity
            style={styles.sideFab}
            onPress={handleSnapToMyGPS}
            activeOpacity={0.7}
            accessibilityLabel="Snap to Current GPS">
            <Ionicons name="navigate" size={18} color="#10B981" />
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Bottom Card */}
      <View style={[styles.bottomCard, { bottom: insets.bottom + 12 }]}>
        {/* Radius Header */}
        <View style={styles.radiusHeaderRow}>
          <View style={styles.radiusTitleLeft}>
            <Ionicons name="radio-outline" size={16} color="#38BDF8" />
            <Text style={styles.radiusTitle}>Geofence Radius</Text>
          </View>
          <Text style={styles.radiusValueText}>{radiusMeters} meters</Text>
        </View>

        {/* Radius Chips */}
        <View style={styles.radiusChipsRow}>
          {RADIUS_OPTIONS.map((r) => {
            const isSelected = radiusMeters === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, isSelected && styles.radiusChipActive]}
                onPress={() => setRadiusMeters(r)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.radiusChipText,
                    isSelected && styles.radiusChipTextActive,
                  ]}>
                  {r}m
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Gesture Guide Tips */}
        <View style={styles.guideRow}>
          <View style={styles.guideItem}>
            <Ionicons name="finger-print-outline" size={13} color="#94A3B8" />
            <Text style={styles.guideText}>Tap to place</Text>
          </View>
          <Text style={styles.guideDivider}>•</Text>
          <View style={styles.guideItem}>
            <Ionicons name="move" size={13} color="#94A3B8" />
            <Text style={styles.guideText}>Drag pin</Text>
          </View>
          <Text style={styles.guideDivider}>•</Text>
          <View style={styles.guideItem}>
            <Ionicons name="expand-outline" size={13} color="#94A3B8" />
            <Text style={styles.guideText}>Pinch to zoom</Text>
          </View>
        </View>

        {/* Big Confirm Button */}
        <TouchableOpacity
          style={styles.primaryConfirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.8}
          accessibilityLabel="Confirm Geofence Perimeter">
          <Ionicons name="shield-checkmark" size={18} color="#0B0F17" />
          <Text style={styles.primaryConfirmBtnText}>Confirm Geofence Perimeter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0F17',
    zIndex: 99999,
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  topHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  doneBtnText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingSideControls: {
    position: 'absolute',
    right: 16,
    gap: 10,
  },
  sideFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radiusTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  radiusValueText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  radiusChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  radiusChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  radiusChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#0B0F17',
    fontWeight: '700',
  },
  guideRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guideText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  guideDivider: {
    color: '#475569',
    fontSize: 10,
  },
  primaryConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  primaryConfirmBtnText: {
    color: '#0B0F17',
    fontSize: 15,
    fontWeight: '700',
  },
});
