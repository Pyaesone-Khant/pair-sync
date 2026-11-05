import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import { getDatabaseClient } from '../infrastructure/database/database-client';
import { Place } from '../domain/places/place';
import { useLocationStore } from '../presentation/stores/location-store';
import { usePinpointStore } from '../presentation/stores/pinpoint-store';
import {
  PLACE_ICONS,
  PLACE_ICON_CATEGORIES,
  PlaceCategory,
} from '../constants/place-icons';

export interface SafePlace {
  id: string;
  name: string;
  category: 'home' | 'work' | 'gym' | 'other';
  icon?: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
  partnerPresent: boolean;
  lastEvent: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const myTelemetry = useLocationStore((state) => state.myTelemetry);
  const peerTelemetry = useLocationStore((state) => state.peerTelemetry);
  const [places, setPlaces] = useState<SafePlace[]>([]);

  const placeRepo = useMemo(() => getDatabaseClient().getRepositories().placeRepo, []);

  // Load places from SQLite database on mount
  useEffect(() => {
    let mounted = true;
    async function loadPlaces() {
      try {
        const stored = await placeRepo.getAllPlaces();
        if (!mounted) return;

        setPlaces(
          stored.map((p) => {
            const lowerName = p.name.toLowerCase();
            let cat: 'home' | 'work' | 'gym' | 'other' = 'other';
            if (lowerName.includes('home')) cat = 'home';
            else if (lowerName.includes('office') || lowerName.includes('work')) cat = 'work';
            else if (lowerName.includes('gym') || lowerName.includes('fitness')) cat = 'gym';

            return {
              id: p.id,
              name: p.name,
              category: cat,
              icon: p.icon || (cat === 'home' ? 'home' : cat === 'work' ? 'briefcase' : cat === 'gym' ? 'barbell' : 'location'),
              radiusMeters: p.radiusMeters,
              latitude: p.coordinate.latitude,
              longitude: p.coordinate.longitude,
              partnerPresent: false,
              lastEvent: 'Geofence active',
            };
          })
        );
      } catch (err) {
        console.warn('[PlacesScreen] Failed to load places from SQLite:', err);
      }
    }

    loadPlaces();
    return () => {
      mounted = false;
    };
  }, [placeRepo]);

  // Dynamically calculate partner presence using the Place domain entity
  const displayPlaces = useMemo(() => {
    return places.map((p) => {
      let isPresent = p.partnerPresent;
      if (peerTelemetry.coordinate) {
        const placeEntity = new Place({
          id: p.id,
          name: p.name,
          coordinate: { latitude: p.latitude, longitude: p.longitude },
          radiusMeters: p.radiusMeters,
          icon: p.icon,
        });
        isPresent = placeEntity.containsCoordinate(peerTelemetry.coordinate);
      }
      return {
        ...p,
        partnerPresent: isPresent,
        lastEvent: isPresent ? 'Partner currently inside boundary' : p.lastEvent,
      };
    });
  }, [places, peerTelemetry.coordinate]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<'home' | 'work' | 'gym' | 'other'>('home');
  const [selectedIcon, setSelectedIcon] = useState<string>('home');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<PlaceCategory>('All');
  const [radiusInput, setRadiusInput] = useState(100);
  const [targetCoord, setTargetCoord] = useState<{ latitude: number; longitude: number }>({
    latitude: 16.8052,
    longitude: 96.1561,
  });

  const openPinpoint = usePinpointStore((state) => state.openPinpoint);

  const handleOpenPinpoint = () => {
    setModalVisible(false);
    openPinpoint({
      coordinate: targetCoord,
      radiusMeters: radiusInput,
      placeName: nameInput.trim() || undefined,
      icon: selectedIcon,
      onConfirm: (newCoord, newRadius) => {
        setTargetCoord(newCoord);
        setRadiusInput(newRadius);
        setModalVisible(true);
      },
      onCancel: () => {
        setModalVisible(true);
      },
    });
  };

  const filteredIcons = useMemo(() => {
    if (selectedCategoryFilter === 'All') {
      return PLACE_ICONS;
    }
    return PLACE_ICONS.filter((item) => item.category === selectedCategoryFilter);
  }, [selectedCategoryFilter]);

  const currentIconMetadata = useMemo(() => {
    return PLACE_ICONS.find((i) => i.name === selectedIcon) || {
      name: selectedIcon,
      label: selectedIcon,
      category: 'Custom',
    };
  }, [selectedIcon]);

  const openAddModal = () => {
    setEditingPlaceId(null);
    setNameInput('');
    setCategoryInput('home');
    setSelectedIcon('home');
    setSelectedCategoryFilter('All');
    setRadiusInput(100);
    setTargetCoord(myTelemetry.coordinate ?? { latitude: 16.8052, longitude: 96.1561 });
    setModalVisible(true);
  };

  const handleUseCurrentLocation = () => {
    if (myTelemetry.coordinate) {
      setTargetCoord(myTelemetry.coordinate);
    } else {
      Alert.alert('Location Pending', 'GPS coordinate is not yet acquired.');
    }
  };

  const openEditModal = (place: SafePlace) => {
    setEditingPlaceId(place.id);
    setNameInput(place.name);
    setCategoryInput(place.category);
    setSelectedIcon(place.icon || 'location');
    setSelectedCategoryFilter('All');
    setRadiusInput(place.radiusMeters);
    setTargetCoord({ latitude: place.latitude, longitude: place.longitude });
    setModalVisible(true);
  };

  const handleSavePlace = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the place.');
      return;
    }

    const placeId = editingPlaceId ?? Date.now().toString();
    const domainPlace = new Place({
      id: placeId,
      name: nameInput.trim(),
      coordinate: { latitude: targetCoord.latitude, longitude: targetCoord.longitude },
      radiusMeters: radiusInput,
      icon: selectedIcon,
    });

    try {
      await placeRepo.savePlace(domainPlace);
    } catch (err) {
      console.warn('[PlacesScreen] Failed to persist place to SQLite:', err);
    }

    if (editingPlaceId) {
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === editingPlaceId
            ? {
                ...p,
                name: nameInput.trim(),
                category: categoryInput,
                icon: selectedIcon,
                radiusMeters: radiusInput,
                latitude: targetCoord.latitude,
                longitude: targetCoord.longitude,
              }
            : p
        )
      );
    } else {
      const newPlace: SafePlace = {
        id: placeId,
        name: nameInput.trim(),
        category: categoryInput,
        icon: selectedIcon,
        radiusMeters: radiusInput,
        latitude: targetCoord.latitude,
        longitude: targetCoord.longitude,
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
      `Are you sure you want to remove "${name}"? Hardware geofence boundary alerts for this perimeter will be unregistered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await placeRepo.deletePlace(id);
            } catch (err) {
              console.warn('[PlacesScreen] Failed to delete place from SQLite:', err);
            }
            setPlaces((prev) => prev.filter((p) => p.id !== id));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Safe Places</Text>
            </View>

            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAddModal}
              activeOpacity={0.8}
              accessibilityLabel="Add Safe Place">
              <Ionicons name="pin" size={20} color="#0B0F17" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Places List */}
        <FlatList
          data={displayPlaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.placeCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      item.partnerPresent ? styles.iconCircleActive : styles.iconCircleInactive,
                    ]}>
                    <Ionicons
                      name={(item.icon as keyof typeof Ionicons.glyphMap) || 'location'}
                      size={20}
                      color={item.partnerPresent ? '#10B981' : '#38BDF8'}
                    />
                  </View>

                  <View style={styles.nameAndCategoryCol}>
                    <Text style={styles.placeName}>{item.name}</Text>
                    <View style={styles.geofenceChipRow}>
                      <Ionicons name="radio-outline" size={12} color="#38BDF8" />
                      <Text style={styles.radiusChipText}>{item.radiusMeters}m perimeter</Text>
                    </View>
                  </View>
                </View>

                {/* Presence Status Badge */}
                <View
                  style={[
                    styles.presenceBadge,
                    item.partnerPresent ? styles.presenceBadgeActive : styles.presenceBadgeInactive,
                  ]}>
                  <Ionicons
                    name={item.partnerPresent ? 'radio' : 'radio-outline'}
                    size={11}
                    color={item.partnerPresent ? '#10B981' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.presenceBadgeText,
                      item.partnerPresent
                        ? styles.presenceBadgeTextActive
                        : styles.presenceBadgeTextInactive,
                    ]}>
                    {item.partnerPresent ? 'Partner Inside' : 'Outside'}
                  </Text>
                </View>
              </View>

              {/* Card Meta Row */}
              <View style={styles.cardMetaRow}>
                <View style={styles.eventInfoRow}>
                  <Ionicons name="pricetag-outline" size={12} color="#64748B" />
                  <Text style={styles.categoryBadgeText}>
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
                <View style={styles.coordInfoRow}>
                  <Ionicons name="compass-outline" size={12} color="#64748B" />
                  <Text style={styles.coordText}>
                    {item.latitude.toFixed(4)}°, {item.longitude.toFixed(4)}°
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.cardDivider} />

              {/* Card Footer Actions */}
              <View style={styles.cardFooter}>
                <View style={styles.cardFooterLeft}>
                  <Ionicons
                    name={item.partnerPresent ? 'checkmark-circle' : 'time-outline'}
                    size={14}
                    color={item.partnerPresent ? '#10B981' : '#64748B'}
                  />
                  <Text style={styles.lastEventText}>{item.lastEvent}</Text>
                </View>

                {/* Quick Edit and Delete Icon Actions */}
                <View style={styles.cardActionGroup}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => openEditModal(item)}
                    accessibilityLabel={`Edit ${item.name}`}>
                    <Ionicons name="pencil-sharp" size={15} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionIconBtn, styles.deleteIconBtn]}
                    onPress={() => handleDeletePlace(item.id, item.name)}
                    accessibilityLabel={`Delete ${item.name}`}>
                    <Ionicons name="trash-outline" size={15} color="#F43F5E" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBadge}>
                <Ionicons name="shield-checkmark-outline" size={38} color="#38BDF8" />
              </View>
              <Text style={styles.emptyTitle}>No Safe Places Configured</Text>
              <Text style={styles.emptySubtitle}>
                Create geofenced zones (like Home or Office) to receive private automated arrival and departure alerts.
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal} activeOpacity={0.85}>
                <Ionicons name="pin" size={17} color="#0B0F17" />
                <Text style={styles.emptyAddBtnText}>Add Safe Place</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Add/Edit Safe Place Modal (Form View Only) */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.modalContent}>
                {/* Modal Top Bar */}
                <View style={styles.modalHeaderRow}>
                  <View>
                    <Text style={styles.modalTitle}>
                      {editingPlaceId ? 'Edit Safe Place' : 'New Safe Place'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}>
                  {/* Live Geofence Map Preview (Compact with Tap to Expand) */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.modalMapWrapper}
                    onPress={handleOpenPinpoint}
                    accessibilityLabel="Tap to expand fullscreen map">
                    <MapView
                      style={styles.modalMap}
                      userInterfaceStyle="dark"
                      region={{
                        latitude: targetCoord.latitude,
                        longitude: targetCoord.longitude,
                        latitudeDelta: 0.008,
                        longitudeDelta: 0.008,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pointerEvents="none">
                      <Circle
                        center={targetCoord}
                        radius={radiusInput}
                        fillColor="rgba(56, 189, 248, 0.25)"
                        strokeColor="#38BDF8"
                        strokeWidth={2}
                      />
                      <Marker coordinate={targetCoord} />
                    </MapView>

                    {/* Expand Floating Badge */}
                    <View style={styles.expandActionBadge}>
                      <Ionicons name="expand" size={13} color="#0B0F17" />
                      <Text style={styles.expandActionBadgeText}>Expand & Pinpoint</Text>
                    </View>

                    <View style={styles.mapRadiusBadge}>
                      <Ionicons name="radio-outline" size={12} color="#38BDF8" />
                      <Text style={styles.mapRadiusBadgeText}>
                        {radiusInput}m Perimeter • Tap to expand map
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Quick Location Action Button */}
                  <TouchableOpacity
                    style={styles.currentLocationBtn}
                    onPress={handleUseCurrentLocation}
                    activeOpacity={0.7}
                    accessibilityLabel="Use Current Location">
                    <Ionicons name="locate" size={15} color="#38BDF8" />
                    <Text style={styles.currentLocationBtnText}>Center on My Current GPS Location</Text>
                  </TouchableOpacity>

                  {/* Open Fullscreen Precision Map Mode Button */}
                  <TouchableOpacity
                    style={styles.expandFullMapBtn}
                    onPress={handleOpenPinpoint}
                    activeOpacity={0.8}
                    accessibilityLabel="Open Full Screen Precision Map">
                    <Ionicons name="scan" size={16} color="#0B0F17" />
                    <Text style={styles.expandFullMapBtnText}>Open Precision Map Mode (Full Screen)</Text>
                  </TouchableOpacity>

                  {/* Name Input */}
                  <Text style={styles.inputLabel}>Place Name</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="bookmark-outline" size={16} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. Home, Office, Gym, Studio"
                      placeholderTextColor="#64748B"
                      value={nameInput}
                      onChangeText={setNameInput}
                    />
                    {nameInput.length > 0 && (
                      <TouchableOpacity onPress={() => setNameInput('')}>
                        <Ionicons name="close-circle" size={16} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Safe Places Icon Hub */}
                  <View style={styles.iconHubHeaderRow}>
                    <Text style={styles.inputLabel}>Icon Hub ({PLACE_ICONS.length} Icons)</Text>
                    <View style={styles.selectedIconPreviewPill}>
                      <Ionicons
                        name={(selectedIcon as keyof typeof Ionicons.glyphMap) || 'location'}
                        size={15}
                        color="#38BDF8"
                      />
                      <Text style={styles.selectedIconPreviewText}>{currentIconMetadata.label}</Text>
                    </View>
                  </View>

                  {/* Category Filter Tabs */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryFilterScroll}>
                    {PLACE_ICON_CATEGORIES.map((cat) => {
                      const isActive = selectedCategoryFilter === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryFilterChip,
                            isActive && styles.categoryFilterChipActive,
                          ]}
                          onPress={() => setSelectedCategoryFilter(cat)}>
                          <Text
                            style={[
                              styles.categoryFilterChipText,
                              isActive && styles.categoryFilterChipTextActive,
                            ]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Icon Grid Hub */}
                  <View style={styles.iconGridContainer}>
                    <ScrollView
                      nestedScrollEnabled
                      style={styles.iconGridScrollView}
                      contentContainerStyle={styles.iconGridContent}>
                      {filteredIcons.map((iconItem) => {
                        const isSelected = selectedIcon === iconItem.name;
                        return (
                          <TouchableOpacity
                            key={iconItem.name}
                            style={[
                              styles.iconGridTile,
                              isSelected && styles.iconGridTileSelected,
                            ]}
                            onPress={() => {
                              setSelectedIcon(iconItem.name);
                              if (iconItem.category === 'Living') setCategoryInput('home');
                              else if (iconItem.category === 'Work') setCategoryInput('work');
                              else if (iconItem.category === 'Health') setCategoryInput('gym');
                              else setCategoryInput('other');
                            }}>
                            <Ionicons
                              name={iconItem.name as keyof typeof Ionicons.glyphMap}
                              size={20}
                              color={isSelected ? '#38BDF8' : '#94A3B8'}
                            />
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.iconTileLabel,
                                isSelected && styles.iconTileLabelSelected,
                              ]}>
                              {iconItem.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Radius Presets */}
                  <Text style={styles.inputLabel}>
                    Geofence Radius ({radiusInput}m)
                  </Text>
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
                      <Ionicons name="checkmark" size={16} color="#0B0F17" />
                      <Text style={styles.saveBtnText}>Save Safe Place</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
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
    fontWeight: '400',
  },
  addBtn: {
    backgroundColor: '#38BDF8',
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
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
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBannerTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  statusBannerDivider: {
    color: '#475569',
    fontSize: 12,
  },
  statusBannerHighlight: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
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
  listContent: {
    padding: 16,
    gap: 14,
  },
  placeCard: {
    backgroundColor: '#151B26',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232B3A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  iconCircleInactive: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  nameAndCategoryCol: {
    flex: 1,
  },
  placeName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  geofenceChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  radiusChipText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
  },
  presenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  presenceBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  presenceBadgeInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  presenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presenceBadgeTextActive: {
    color: '#10B981',
  },
  presenceBadgeTextInactive: {
    color: '#94A3B8',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryBadgeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastEventText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  coordInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coordText: {
    color: '#64748B',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyAddBtnText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  deleteIconBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#232B3A',
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  modalMapWrapper: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#232B3A',
    position: 'relative',
  },
  modalMap: {
    ...StyleSheet.absoluteFill,
  },
  mapRadiusBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(11, 15, 23, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  mapRadiusBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: {
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  iconHubHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  selectedIconPreviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  selectedIconPreviewText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryFilterScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryFilterChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
  },
  categoryFilterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryFilterChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  iconGridContainer: {
    height: 180,
    backgroundColor: '#0B0F17',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#232B3A',
    overflow: 'hidden',
  },
  iconGridScrollView: {
    flex: 1,
  },
  iconGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
    justifyContent: 'flex-start',
  },
  iconGridTile: {
    width: '23%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  iconGridTileSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  iconTileLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  iconTileLabelSelected: {
    color: '#38BDF8',
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
  },
  radiusBtnTextActive: {
    color: '#0B0F17',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#38BDF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#0B0F17',
    fontWeight: '700',
    fontSize: 14,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  currentLocationBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  expandActionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  expandActionBadgeText: {
    color: '#0B0F17',
    fontSize: 11,
    fontWeight: '700',
  },
  expandFullMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  expandFullMapBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  precisionMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  precisionMarkerInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0B0F17',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  precisionMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#38BDF8',
    marginTop: -1,
  },
});
