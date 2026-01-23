// Blu Logo Component
// The Blu Bank "b" logo - white b on blue rounded square

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface BluLogoProps {
  size?: number;
  backgroundColor?: string;
  borderRadius?: number;
}

export function BluLogo({
  size = 100,
  backgroundColor = '#2D8CFF',
  borderRadius = 24,
}: BluLogoProps) {
  const scale = size / 100;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor,
          borderRadius,
        },
      ]}
    >
      {/* Dot above the b */}
      <View
        style={[
          styles.dot,
          {
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: 5 * scale,
            top: 12 * scale,
            right: 18 * scale,
          },
        ]}
      />

      {/* Vertical stem of b */}
      <View
        style={[
          styles.stem,
          {
            width: 12 * scale,
            height: 65 * scale,
            borderRadius: 6 * scale,
            left: 22 * scale,
            top: 18 * scale,
          },
        ]}
      />

      {/* Bowl of b (the round part) */}
      <View
        style={[
          styles.bowl,
          {
            width: 40 * scale,
            height: 40 * scale,
            borderRadius: 20 * scale,
            borderWidth: 11 * scale,
            left: 28 * scale,
            bottom: 18 * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  stem: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  bowl: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
});

export default BluLogo;
