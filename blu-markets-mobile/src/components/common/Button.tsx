/**
 * Button Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Variants: primary, secondary, outline, ghost, danger
 * Sizes: sm (36pt), md (44pt), lg (52pt)
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, BUTTON_COLORS, ButtonVariant } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  /** Button visual style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Button label text */
  label: string;
  /** Icon component to render (left or right) */
  icon?: React.ReactNode;
  /** Position of icon */
  iconPosition?: 'left' | 'right';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Press handler */
  onPress: () => void;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
  /** Additional text styles */
  textStyle?: StyleProp<TextStyle>;
  /** Test ID for testing */
  testID?: string;
}

const BUTTON_SIZES = {
  sm: {
    height: 36,
    paddingHorizontal: 12,
    fontSize: 14,
    iconSize: 16,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  md: {
    height: 44,
    paddingHorizontal: 16,
    fontSize: 16,
    iconSize: 20,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  lg: {
    height: 52,
    paddingHorizontal: 20,
    fontSize: 16,
    iconSize: 20,
    borderRadius: RADIUS.md,
    gap: 8,
  },
} as const;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  label,
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  style,
  textStyle,
  testID,
}) => {
  const sizeConfig = BUTTON_SIZES[size];
  const colorConfig = BUTTON_COLORS[variant];
  const isDisabled = disabled || loading;

  const getBackgroundColor = () => {
    if (isDisabled) {
      return variant === 'primary'
        ? 'rgba(111, 170, 248, 0.4)'
        : colorConfig.background;
    }
    return colorConfig.background;
  };

  const getTextColor = () => {
    if (isDisabled) {
      return variant === 'primary' ? COLORS.text.primary : COLORS.text.disabled;
    }
    return colorConfig.text;
  };

  const getBorderStyle = () => {
    if (variant === 'outline') {
      const outlineConfig = BUTTON_COLORS.outline;
      return {
        borderWidth: 1,
        borderColor: isDisabled ? COLORS.text.disabled : outlineConfig.border,
      };
    }
    return {};
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: sizeConfig.borderRadius,
          backgroundColor: getBackgroundColor(),
          opacity: isDisabled && variant !== 'primary' ? 0.5 : 1,
        },
        getBorderStyle(),
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
        />
      ) : (
        <View style={[styles.content, { gap: sizeConfig.gap }]}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconContainer}>{icon}</View>
          )}
          <Text
            style={[
              styles.label,
              {
                fontSize: sizeConfig.fontSize,
                color: getTextColor(),
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconContainer}>{icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
  },
});

export default Button;
