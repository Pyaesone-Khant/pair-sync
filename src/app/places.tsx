import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';

interface SavedPlaceItem {
  id: string;
  name: string;
  category: 'home' | 'work' | 'gym' | 'other';
  radiusMeters: number;
  partnerPresent: boolean;
  lastEvent: string;
}

export default function PlacesScreen() {
  const [places, setPlaces] = useState<SavedPlaceItem[]>([
    {
      id: '1',
      name: 'Home',
      category: 'home',
      radiusMeters: 100,
      partnerPresent: false,
      lastEvent: 'Left at 08:30 AM',
    },
    {
      id: '2',
      name: 'Office',
      category: 'work',
      radiusMeters: 150,
      partnerPresent: true,
      lastEvent: 'Arrived at 09:15 AM',
    },
    {
      id: '3',
      name: 'Fitness Center',
      category: 'gym',
      radiusMeters: 80,
      partnerPresent: false,
      lastEvent: 'Visited yesterday',
    },
  ]);

  const togglePresence = (id: string) => {
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === id
          ? {
              ...place,
              partnerPresent: !place.partnerPresent,
              lastEvent: !place.partnerPresent
                ? `Arrived just now`
                : `Left just now`,
            }
          : place
      )
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Safe Places</Text>
          <Text style={styles.subtitle}>
            Client-side hardware geofences (ADR 0008). Zero coordinates uploaded to the cloud.
          </Text>
        </View>

        {/* Places List */}
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.placeCard}>
              <View style={styles.placeIconCol}>
                <View
                  style={[
                    styles.iconCircle,
                    item.partnerPresent ? styles.iconCircleActive : styles.iconCircleInactive,
                  ]}>
                  <Text style={styles.iconEmoji}>
                    {item.category === 'home'
                      ? '🏠'
                      : item.category === 'work'
                      ? '🏢'
                      : '🏋️'}
                  </Text>
                </View>
              </View>

              <View style={styles.placeInfoCol}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.placeName}>{item.name}</Text>
                  {item.partnerPresent && (
                    <View style={styles.presentBadge}>
                      <Text style={styles.presentBadgeText}>Here Now</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.radiusText}>Geofence radius: {item.radiusMeters}m</Text>
                <Text style={styles.lastEventText}>{item.lastEvent}</Text>
              </View>

              <TouchableOpacity
                style={styles.simulateBtn}
                onPress={() => togglePresence(item.id)}>
                <Text style={styles.simulateBtnText}>
                  {item.partnerPresent ? 'Trigger Exit' : 'Trigger Entry'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  placeCard: {
    backgroundColor: '#151B26',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232B3A',
    gap: 14,
  },
  placeIconCol: {
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  iconCircleInactive: {
    backgroundColor: '#1E293B',
  },
  iconEmoji: {
    fontSize: 20,
  },
  placeInfoCol: {
    flex: 1,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  presentBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  presentBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  radiusText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  lastEventText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  simulateBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simulateBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
});
