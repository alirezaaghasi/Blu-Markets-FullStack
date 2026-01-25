/**
 * AssetIcon Component
 * Renders appropriate icon for each asset with layer-based styling
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AssetId } from '../types';
import { LAYER_COLORS, ASSETS } from '../constants/assets';

interface AssetIconProps {
  assetId: AssetId;
  size?: number;
}

// Asset icon mappings - using emoji/text as fallback
// In production, replace with actual image assets
const ASSET_ICONS: Partial<Record<AssetId, string>> = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '$',
  PAXG: '🥇',
  SOL: '◎',
  TON: '💎',
  LINK: '⬡',
  AVAX: '🔺',
  BNB: '◆',
  XRP: '✕',
  MATIC: '⬟',
  ARB: '🔷',
  KAG: '🥈',
  QQQ: '📈',
  IRR_FIXED_INCOME: '💵',
};

export const AssetIcon: React.FC<AssetIconProps> = ({ assetId, size = 44 }) => {
  const asset = ASSETS[assetId];
  const icon = ASSET_ICONS[assetId];
  const bgColor = `${LAYER_COLORS[asset?.layer || 'FOUNDATION']}20`;

  return (
    <View style={[
      styles.container,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
      }
    ]}>
      <Text style={[
        styles.iconText,
        { fontSize: size * 0.45 }
      ]}>
        {icon || asset?.symbol?.charAt(0) || assetId.charAt(0)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AssetIcon;
