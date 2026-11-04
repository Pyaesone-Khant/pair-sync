import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { generateQrSpans } from '../utils/qr-matrix';

export interface QRCodeDisplayProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
  margin?: number;
}

/**
 * Universal, high-contrast, vector-sharp QR Code component.
 * Uses core Galois Field / Reed-Solomon math to construct the QR bitmatrix
 * and renders directly with React Native native primitives.
 * Completely immune to browser canvas errors, DOM requirements, or image decoding latency.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  backgroundColor = '#FFFFFF',
  color = '#0B0F17',
  margin = 2,
}) => {
  const { rows, moduleSize, totalDimension } = useMemo(() => {
    return generateQrSpans(value, size, margin);
  }, [value, size, margin]);

  if (!rows.length) {
    return <View style={[styles.fallbackBox, { width: size, height: size, backgroundColor }]} />;
  }

  const paddingVal = margin * moduleSize;

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: totalDimension,
          height: totalDimension,
          backgroundColor,
          padding: paddingVal,
        },
      ]}>
      {rows.map((rowSpans, rIndex) => (
        <View key={`row-${rIndex}`} style={{ flexDirection: 'row', height: moduleSize }}>
          {rowSpans.map((span, sIndex) => (
            <View
              key={`span-${rIndex}-${sIndex}`}
              style={{
                width: span.count * moduleSize,
                height: moduleSize,
                backgroundColor: span.isDark ? color : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBox: {
    borderRadius: 8,
  },
});
