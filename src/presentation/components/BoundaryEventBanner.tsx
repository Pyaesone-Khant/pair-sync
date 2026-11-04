import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BoundaryEvent } from '../../domain/places/boundary-event';
import { DesignTokens } from '../../constants/theme';

export interface BoundaryEventBannerProps {
  event: BoundaryEvent | null;
  onDismiss: () => void;
  autoHideDurationMs?: number;
}

/**
 * High-signal floating boundary alert banner.
 * Displays autonomous geofence entry and exit events with smooth entrance animation.
 * Adheres to ADR 0008, frontend-design, and Vercel design principles.
 */
export const BoundaryEventBanner: React.FC<BoundaryEventBannerProps> = ({
  event,
  onDismiss,
  autoHideDurationMs = 5000,
}) => {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (event) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDurationMs);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-80);
      opacityAnim.setValue(0);
    }
  }, [event]);

  if (!event) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const isArrival = event.type === 'arrived';
  const accentColor = isArrival
    ? DesignTokens.colors.accentEmerald
    : DesignTokens.colors.accentCyan;

  return (
    <Animated.View
      style={[
        styles.bannerWrapper,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}>
      <View style={[styles.bannerContainer, { borderColor: accentColor }]}>
        <View style={[styles.iconCircle, { backgroundColor: `${accentColor}1A` }]}>
          <Ionicons
            name={isArrival ? 'log-in' : 'log-out'}
            size={16}
            color={accentColor}
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {event.getSummary()}
          </Text>
          <Text style={styles.metaText}>
            Autonomous Hardware Geofence • Just now
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          accessibilityLabel="Dismiss Alert">
          <Ionicons name="close" size={14} color={DesignTokens.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerWrapper: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.bgCard,
    borderRadius: DesignTokens.radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  metaText: {
    fontSize: 10,
    color: DesignTokens.colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
});
