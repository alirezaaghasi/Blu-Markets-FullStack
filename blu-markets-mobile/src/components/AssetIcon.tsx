/**
 * AssetIcon Component
 * Renders cryptocurrency icons from the cryptocurrency-icons library
 * https://github.com/spothq/cryptocurrency-icons (MIT License)
 */
import React from 'react';
import { View, Image, Text, StyleSheet, ImageSourcePropType } from 'react-native';
import { AssetId } from '../types';
import { LAYER_COLORS, ASSETS } from '../constants/assets';

interface AssetIconProps {
  assetId: AssetId;
  size?: number;
}

// PNG icons from cryptocurrency-icons library
const CRYPTO_ICON_IMAGES: Partial<Record<AssetId, ImageSourcePropType>> = {
  BTC: require('../../assets/crypto-icons/btc.png'),
  ETH: require('../../assets/crypto-icons/eth.png'),
  USDT: require('../../assets/crypto-icons/usdt.png'),
  BNB: require('../../assets/crypto-icons/bnb.png'),
  XRP: require('../../assets/crypto-icons/xrp.png'),
  SOL: require('../../assets/crypto-icons/sol.png'),
  LINK: require('../../assets/crypto-icons/link.png'),
  AVAX: require('../../assets/crypto-icons/avax.png'),
  MATIC: require('../../assets/crypto-icons/matic.png'),
  TON: require('../../assets/crypto-icons/ton.png'),
  ARB: require('../../assets/crypto-icons/arb.png'),
  PAXG: require('../../assets/crypto-icons/paxg.png'),
  KAG: require('../../assets/crypto-icons/kag.png'),
};

// Fallback symbols for assets without PNG icons
const FALLBACK_SYMBOLS: Partial<Record<AssetId, string>> = {
  IRR_FIXED_INCOME: '%',
  QQQ: 'Q',
};

export const AssetIcon: React.FC<AssetIconProps> = ({ assetId, size = 44 }) => {
  const asset = ASSETS[assetId];
  const layerColor = LAYER_COLORS[asset?.layer || 'FOUNDATION'];
  const iconSource = CRYPTO_ICON_IMAGES[assetId];
  const fallbackSymbol = FALLBACK_SYMBOLS[assetId];

  const iconSize = size * 0.7; // Icon takes 70% of container

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
      {iconSource ? (
        <Image
          source={iconSource}
          style={{
            width: iconSize,
            height: iconSize,
          }}
          resizeMode="contain"
        />
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
    overflow: 'hidden',
  },
  fallbackText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AssetIcon;
