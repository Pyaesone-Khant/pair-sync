import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocationStore } from '../stores/location-store';
import { calculateProximityRadar } from '../utils/radar';

export interface PartnerStatusCardProps {
  partnerName: string;
  onInitiateCall: () => void;
  onOpenChat: () => void;
}

/**
 * Clean presentation card rendering ambient presence, battery telemetry,
 * motion activity, proximity radar, and direct P2P call action.
 * Adheres to Clean Architecture and frontend-design principles.
 */
export const PartnerStatusCard: React.FC<PartnerStatusCardProps> = ({
  partnerName,
  onInitiateCall,
  onOpenChat,
}) => {
  const myTelemetry = useLocationStore((state) => state.myTelemetry);
  const peerTelemetry = useLocationStore((state) => state.peerTelemetry);
  const isPeerViewingMe = useLocationStore((state) => state.isPeerViewingMe);

  const radar = calculateProximityRadar(
    myTelemetry.coordinate,
    peerTelemetry.coordinate
  );

  const isLowBattery =
    peerTelemetry.batteryPercent !== null && peerTelemetry.batteryPercent <= 15;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {partnerName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            {isPeerViewingMe && (
              <View style={styles.liveBadge}>
                <Ionicons name="eye" size={11} color="#EF4444" />
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            )}
          </View>
          <Text style={styles.distanceText}>{radar.formattedDistance}</Text>
        </View>

        {peerTelemetry.batteryPercent !== null && (
          <View
            style={[
              styles.batteryPill,
              isLowBattery && styles.batteryPillWarning,
            ]}>
            <Ionicons
              name={
                peerTelemetry.isCharging
                  ? 'flash'
                  : isLowBattery
                  ? 'battery-dead'
                  : 'battery-half'
              }
              size={13}
              color={peerTelemetry.isCharging ? '#10B981' : isLowBattery ? '#EF4444' : '#E5E7EB'}
            />
            <Text style={styles.batteryText}>{peerTelemetry.batteryPercent}%</Text>
          </View>
        )}
      </View>

      <View style={styles.telemetryRow}>
        <View style={styles.statusPill}>
          <Ionicons
            name={
              peerTelemetry.motionActivity === 'Driving'
                ? 'car-outline'
                : peerTelemetry.motionActivity === 'Walking'
                ? 'walk-outline'
                : 'home-outline'
            }
            size={13}
            color="#38BDF8"
          />
          <Text style={styles.statusPillText}>
            {peerTelemetry.motionActivity === 'Driving'
              ? 'Driving'
              : peerTelemetry.motionActivity === 'Walking'
              ? 'Walking'
              : 'Stationary'}
          </Text>
        </View>

        {radar.drivingEtaMinutes !== null && (
          <Text style={styles.etaText}>
            ~{radar.drivingEtaMinutes} min drive • ~{radar.walkingEtaMinutes} min walk
          </Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.chatButton]}
          onPress={onOpenChat}>
          <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFFFFF" />
          <Text style={styles.chatButtonText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.callButton]}
          onPress={onInitiateCall}>
          <Ionicons name="call" size={17} color="#FFFFFF" />
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1E2024',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2A2D34',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  liveBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distanceText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  batteryPill: {
    backgroundColor: '#2A2D34',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  batteryPillWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  batteryText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  statusPill: {
    backgroundColor: '#262930',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPillText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  etaText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chatButton: {
    backgroundColor: '#2A2D34',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#10B981',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
