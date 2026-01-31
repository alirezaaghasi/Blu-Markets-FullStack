/**
 * Clean SVG crypto icons - just the logo shapes, no backgrounds
 * All icons render in white for monochrome display
 */
import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { AssetId } from '../types';

interface IconProps {
  size?: number;
  color?: string;
}

// Bitcoin - ₿ symbol
const BTCIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.06 11.57c.59-1.95-.39-3.14-1.9-3.87l.39-1.57-.95-.24-.38 1.53c-.25-.06-.51-.12-.77-.18l.38-1.54-.95-.24-.39 1.57c-.21-.05-.41-.1-.61-.14l-1.31-.33-.25 1.02s.71.16.69.17c.39.1.46.35.45.56l-.45 1.79c.03.01.06.02.1.03l-.1-.02-.63 2.51c-.05.12-.17.29-.44.23.01.01-.69-.17-.69-.17l-.47 1.09 1.24.31c.23.06.46.12.68.17l-.39 1.58.95.24.39-1.57c.26.07.51.14.76.2l-.39 1.57.95.24.39-1.58c1.62.31 2.85.18 3.36-1.29.41-1.18-.02-1.86-.88-2.31.62-.14 1.09-.55 1.22-1.4zm-2.19 3.07c-.3 1.18-2.29.54-2.93.38l.52-2.1c.65.16 2.72.48 2.41 1.72zm.29-3.08c-.27 1.08-1.93.53-2.47.39l.48-1.9c.54.13 2.27.39 1.99 1.51z"
      fill={color}
    />
  </Svg>
);

// Ethereum - Diamond shape
const ETHIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <G opacity="0.8">
      <Path d="M12 2L6 12.5L12 15.5L18 12.5L12 2Z" fill={color} />
    </G>
    <Path d="M12 16.5L6 13.5L12 22L18 13.5L12 16.5Z" fill={color} />
  </Svg>
);

// Tether USDT - ₮ symbol
const USDTIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12.5 8.5V6H17V4H7V6H11.5V8.5C7.5 8.7 4.5 9.5 4.5 10.5C4.5 11.5 7.5 12.3 11.5 12.5V19H12.5V12.5C16.5 12.3 19.5 11.5 19.5 10.5C19.5 9.5 16.5 8.7 12.5 8.5ZM12 11.5C8.5 11.5 5.5 10.9 5.5 10.5C5.5 10.1 8.5 9.5 12 9.5C15.5 9.5 18.5 10.1 18.5 10.5C18.5 10.9 15.5 11.5 12 11.5Z"
      fill={color}
    />
  </Svg>
);

// Binance Coin - BNB diamond
const BNBIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4L9.5 6.5L12 9L14.5 6.5L12 4Z" fill={color} />
    <Path d="M6 10L3.5 12.5L6 15L8.5 12.5L6 10Z" fill={color} />
    <Path d="M18 10L15.5 12.5L18 15L20.5 12.5L18 10Z" fill={color} />
    <Path d="M12 12L9.5 14.5L12 17L14.5 14.5L12 12Z" fill={color} />
    <Path d="M12 18L9.5 20.5L12 23L14.5 20.5L12 18Z" fill={color} opacity="0.6" />
  </Svg>
);

// XRP - X pattern
const XRPIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 4H8.5L12 8L15.5 4H18L13 10L18 16H15.5L12 12L8.5 16H6L11 10L6 4Z"
      fill={color}
    />
    <Path d="M6 18H18V20H6V18Z" fill={color} opacity="0.6" />
  </Svg>
);

// Solana - S wave
const SOLIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 7H17L19 5H7L5 7Z" fill={color} />
    <Path d="M5 13H17L19 11H7L5 13Z" fill={color} opacity="0.7" />
    <Path d="M5 19H17L19 17H7L5 19Z" fill={color} />
  </Svg>
);

// Chainlink - Hexagon
const LINKIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3ZM12 6L16.5 8.5V15.5L12 18L7.5 15.5V8.5L12 6Z"
      fill={color}
      fillRule="evenodd"
    />
  </Svg>
);

// Avalanche - Triangle
const AVAXIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4L4 20H9L12 14L15 20H20L12 4Z" fill={color} />
  </Svg>
);

// Polygon - Geometric shape
const MATICIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M16 8L12 5.5L8 8V13L12 15.5L16 13V8Z"
      fill={color}
      opacity="0.7"
    />
    <Path d="M12 10L8 12.5V17.5L12 20L16 17.5V12.5L12 10Z" fill={color} />
  </Svg>
);

// Toncoin - Diamond
const TONIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3L3 10H11V21H13V10H21L12 3Z" fill={color} />
  </Svg>
);

// Arbitrum - Stylized A
const ARBIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4L5 20H8L10 15H14L16 20H19L12 4ZM11 12L12 8L13 12H11Z" fill={color} fillRule="evenodd" />
  </Svg>
);

// PAX Gold - Gold bar
const PAXGIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 8H18L20 12L18 16H6L4 12L6 8Z" fill={color} />
    <Path d="M8 10H16L17 12L16 14H8L7 12L8 10Z" fill={color} opacity="0.5" />
  </Svg>
);

// Kinesis Silver - KAG stylized
const KAGIcon: React.FC<IconProps> = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4V20H8V13L14 20H17L10 12L16 4H13L8 11V4H6Z" fill={color} />
  </Svg>
);

// Map of asset IDs to icon components
export const CRYPTO_ICONS: Partial<Record<AssetId, React.FC<IconProps>>> = {
  BTC: BTCIcon,
  ETH: ETHIcon,
  USDT: USDTIcon,
  BNB: BNBIcon,
  XRP: XRPIcon,
  SOL: SOLIcon,
  LINK: LINKIcon,
  AVAX: AVAXIcon,
  MATIC: MATICIcon,
  TON: TONIcon,
  ARB: ARBIcon,
  PAXG: PAXGIcon,
  KAG: KAGIcon,
};

export default CRYPTO_ICONS;
