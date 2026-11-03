import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';

export interface SafePlace {
  id: string;
  name: string;
  category: 'home' | 'work' | 'gym' | 'other';
  radiusMeters: number;
  latitude: number;
  longitude: number;
  partnerPresent: boolean;
  lastEvent: string;
}

export default function PlacesScreen() {
  const [places, setPlaces] = useState<SafePlace[]>([
    {
      id: '1',
      name: 'Home',
      category: 'home',
      radiusMeters: 100,
      latitude: 37.7749,
      longitude: -122.4194,
      partnerPresent: false,
      lastEvent: 'Left at 08:30 AM',
    },
    {
      id: '2',
      name: 'Office',
      category: 'work',
      radiusMeters: 150,
      latitude: 37.7899,
      longitude: -122.4014,
      partnerPresent: true,
      lastEvent: 'Arrived at 09:15 AM',
    },
    {
      id: '3',
      name: 'Fitness Center',
      category: 'gym',
      radiusMeters: 80,
      latitude: 37.765,
      longitude: -122.42,
      partnerPresent: false,
      lastEvent: 'Visited yesterday',
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<'home' | 'work' | 'gym' | 'other'>('home');
  const [radiusInput, setRadiusInput] = useState(100);

  const openAddModal = () => {
    setEditingPlaceId(null);
    setNameInput('');
    setCategoryInput('home');
    setRadiusInput(100);
    setModalVisible(true);
  };

  const openEditModal = (place: SafePlace) => {
    setEditingPlaceId(place.id);
    setNameInput(place.name);
    setCategoryInput(place.category);
    setRadiusInput(place.radiusMeters);
    setModalVisible(true);
  };

  const handleSavePlace = () => {
    if (!nameInput.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the place.');
      return;
    }

    if (editingPlaceId) {
      // Edit existing
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === editingPlaceId
            ? {
                ...p,
                name: nameInput.trim(),
                category: categoryInput,
                radiusMeters: radiusInput,
              }
            : p
        )
      );
    } else {
      // Add new
      const newPlace: SafePlace = {
        id: Date.now().toString(),
        name: nameInput.trim(),
        category: categoryInput,
        radiusMeters: radiusInput,
        latitude: 37.775,
        longitude: -122.418,
        partnerPresent: false,
        lastEvent: 'Added just now',
      };
      setPlaces((prev) => [...prev, newPlace]);
    }

    setModalVisible(false);
  };

  const handleDeletePlace = (id: string, name: string) => {
    Alert.alert(
      'Delete Safe Place',
      `Are you sure you want to remove "${name}"? Geofence alerts for this place will be unregistered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPlaces((prev) => prev.filter((p) => p.id !== id));
          },
        },
      ]
    );
  };

  const togglePresence = (id: string) => {
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === id
          ? {
              ...place,
              partnerPresent: !place.partnerPresent,
              lastEvent: !place.partnerPresent ? 'Arrived just now' : 'Left just now',
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
          <View style={styles.headerTitleRow}>
            <View>
              <Text style={styles.title}>Safe Places</Text>
              <Text style={styles.subtitle}>
                Hardware geofencing alerts • Zero cloud tracking
              </Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
              <Text style={styles.addBtnText}>+ Add Place</Text>
            </TouchableOpacity>
          </View>
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
                      : item.category === 'gym'
                      ? '🏋️'
                      : '⭐️'}
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

              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={styles.simulateBtn}
                  onPress={() => togglePresence(item.id)}>
                  <Text style={styles.simulateBtnText}>
                    {item.partnerPresent ? 'Exit' : 'Enter'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.editDeleteRow}>
                  <TouchableOpacity
                    style={styles.smallActionBtn}
                    onPress={() => openEditModal(item)}>
                    <Text style={styles.smallActionText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.smallActionBtn}
                    onPress={() => handleDeletePlace(item.id, item.name)}>
                    <Text style={[styles.smallActionText, styles.deleteActionText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />

        {/* Add/Edit Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingPlaceId ? 'Edit Safe Place' : 'New Safe Place'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Boundary notifications fire automatically when your partner arrives or leaves.
              </Text>

              {/* Name Input */}
              <Text style={styles.inputLabel}>Place Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Home, Office, Gym, Mom's House"
                placeholderTextColor="#64748B"
                value={nameInput}
                onChangeText={setNameInput}
              />

              {/* Category Selector */}
              <Text style={styles.inputLabel}>Category Icon</Text>
              <View style={styles.categoryRow}>
                {(['home', 'work', 'gym', 'other'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      categoryInput === cat && styles.categoryBtnActive,
                    ]}
                    onPress={() => setCategoryInput(cat)}>
                    <Text style={styles.categoryBtnText}>
                      {cat === 'home'
                        ? '🏠 Home'
                        : cat === 'work'
                        ? '🏢 Work'
                        : cat === 'gym'
                        ? '🏋️ Gym'
                        : '⭐️ Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Radius Presets */}
              <Text style={styles.inputLabel}>Geofence Radius ({radiusInput}m)</Text>
              <View style={styles.radiusRow}>
                {[50, 100, 150, 250, 500].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusBtn, radiusInput === r && styles.radiusBtnActive]}
                    onPress={() => setRadiusInput(r)}>
                    <Text
                      style={[
                        styles.radiusBtnText,
                        radiusInput === r && styles.radiusBtnTextActive,
                      ]}>
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Modal Buttons */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlace}>
                  <Text style={styles.saveBtnText}>Save Safe Place</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  addBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#0B0F17',
    fontWeight: '700',
    fontSize: 13,
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
  actionsCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  simulateBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  simulateBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  editDeleteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  smallActionText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  deleteActionText: {
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151B26',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    backgroundColor: '#0B0F17',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
  },
  categoryBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusBtn: {
    flex: 1,
    backgroundColor: '#0B0F17',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  radiusBtnActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  radiusBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  radiusBtnTextActive: {
    color: '#0B0F17',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 15,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#0B0F17',
    fontWeight: '700',
    fontSize: 15,
  },
});
