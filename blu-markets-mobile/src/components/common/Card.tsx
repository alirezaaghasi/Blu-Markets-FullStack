/**
 * Card Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Variants: default, elevated, highlighted, interactive
 * Padding: none, sm, md, lg
 * Radius: sm, md, lg
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, SHADOWS } from '../../constants/spacing';

type CardVariant = 'default' | 'elevated' | 'highlighted' | 'interactive';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardRadius = 'sm' | 'md' | 'lg';

interface CardProps {
  /** Card visual variant */
  variant?: CardVariant;
  /** Internal padding */
  padding?: CardPadding;
  /** Border radius */
  radius?: CardRadius;
  /** Children components */
  children: React.ReactNode;
  /** Press handler (only for interactive variant) */
  onPress?: () => void;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Optional border color for highlighted variant */
  highlightColor?: string;
  /** Test ID for testing */
  testID?: string;
}

const CARD_PADDING = {
  none: 0,
  sm: SPACING[3], // 12pt
  md: SPACING[4], // 16pt
  lg: SPACING[5], // 20pt
} as const;

const CARD_RADIUS = {
  sm: RADIUS.sm, // 8pt
  md: RADIUS.md, // 12pt
  lg: RADIUS.lg, // 16pt
} as const;

const CARD_BACKGROUNDS = {
  default: COLORS.background.surface,
  elevated: COLORS.background.elevated,
  highlighted: COLORS.background.surface,
  interactive: COLORS.background.surface,
} as const;

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  radius = 'lg',
  children,
  onPress,
  style,
  highlightColor,
  testID,
}) => {
  const containerStyle: ViewStyle = {
    backgroundColor: CARD_BACKGROUNDS[variant],
    padding: CARD_PADDING[padding],
    borderRadius: CARD_RADIUS[radius],
    overflow: 'hidden',
  };

  // Add shadow for elevated variant
  const shadowStyle =
    variant === 'elevated'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }
      : {};

  // Add border for highlighted variant
  const borderStyle =
    variant === 'highlighted' && highlightColor
      ? {
          borderWidth: 1,
          borderColor: highlightColor,
        }
      : variant === 'default'
        ? {
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }
        : {};

  // Interactive variant with press capability
  if (variant === 'interactive' && onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.container, containerStyle, borderStyle, shadowStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.container, containerStyle, borderStyle, shadowStyle, style]}
    >
      {children}
    </View>
  );
};

// Convenience components for specific card types
export const ElevatedCard: React.FC<Omit<CardProps, 'variant'>> = (props) => (
  <Card {...props} variant="elevated" />
);

export const InteractiveCard: React.FC<Omit<CardProps, 'variant'>> = (props) => (
  <Card {...props} variant="interactive" />
);

export const HighlightedCard: React.FC<
  Omit<CardProps, 'variant'> & { highlightColor: string }
> = (props) => <Card {...props} variant="highlighted" />;

const styles = StyleSheet.create({
  container: {
    // Base styles applied via inline styles for flexibility
  },
});

export default Card;
