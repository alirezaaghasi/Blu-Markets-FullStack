/**
 * AssetIcon Component
 * Renders cryptocurrency icons in monochrome white with layer-based styling
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AssetId } from '../types';
import { LAYER_COLORS, ASSETS } from '../constants/assets';
import { CRYPTO_ICONS } from './CryptoIcons';

interface AssetIconProps {
  assetId: AssetId;
  size?: number;
}

// Fallback symbols for assets without SVG icons
const FALLBACK_SYMBOLS: Partial<Record<AssetId, string>> = {
  IRR_FIXED_INCOME: '%',
  QQQ: 'Q',
};

export const AssetIcon: React.FC<AssetIconProps> = ({ assetId, size = 44 }) => {
  const asset = ASSETS[assetId];
  const layerColor = LAYER_COLORS[asset?.layer || 'FOUNDATION'];
  const IconComponent = CRYPTO_ICONS[assetId];
  const fallbackSymbol = FALLBACK_SYMBOLS[assetId];

  const iconSize = size * 0.55; // Icon takes 55% of container

  return (
    <View style={[
      styles.container,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: layerColor,
        backgroundColor: `${layerColor}15`,
      }
    ]}>
      {IconComponent ? (
        <IconComponent size={iconSize} color="#FFFFFF" />
      ) : (
        <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
          {fallbackSymbol || asset?.symbol?.charAt(0) || '?'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AssetIcon;
