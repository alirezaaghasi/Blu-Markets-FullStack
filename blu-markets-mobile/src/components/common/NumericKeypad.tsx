/**
 * NumericKeypad Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * 3x4 grid layout for amount inputs
 * Key size: 100×64pt
 * Large touch targets with haptic feedback
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface NumericKeypadProps {
  /** Called when a key is pressed (0-9) */
  onPress: (key: string) => void;
  /** Called when backspace is pressed */
  onBackspace: () => void;
  /** Show decimal point key */
  showDecimal?: boolean;
  /** Called when decimal is pressed */
  onDecimal?: () => void;
  /** Disable all keys */
  disabled?: boolean;
}

// Key configuration
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'backspace'],
] as const;

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onPress,
  onBackspace,
  showDecimal = false,
  onDecimal,
  disabled = false,
}) => {
  // Handle key press with haptic feedback
  const handleKeyPress = useCallback(
    (key: string) => {
      if (disabled) return;

      // Trigger haptic feedback (on native platforms)
      if (Platform.OS !== 'web') {
        try {
          // Use Expo Haptics if available
          const Haptics = require('expo-haptics');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          // Haptics not available, continue without
        }
      }

      if (key === 'backspace') {
        onBackspace();
      } else if (key === '.') {
        onDecimal?.();
      } else if (key !== '') {
        onPress(key);
      }
    },
    [onPress, onBackspace, onDecimal, disabled]
  );

  const renderKey = (key: string, rowIndex: number, keyIndex: number) => {
    // Handle decimal/empty slot in bottom-left
    const actualKey =
      rowIndex === 3 && keyIndex === 0 ? (showDecimal ? '.' : '') : key;

    // Empty slot
    if (actualKey === '') {
      return <View key={`${rowIndex}-${keyIndex}`} style={styles.keyEmpty} />;
    }

    // Backspace key
    if (actualKey === 'backspace') {
      return (
        <TouchableOpacity
          key={`${rowIndex}-${keyIndex}`}
          onPress={() => handleKeyPress('backspace')}
          activeOpacity={0.7}
          disabled={disabled}
          style={[styles.key, styles.keyBackspace, disabled && styles.keyDisabled]}
        >
          <Text style={styles.backspaceIcon}>⌫</Text>
        </TouchableOpacity>
      );
    }

    // Number key
    return (
      <TouchableOpacity
        key={`${rowIndex}-${keyIndex}`}
        onPress={() => handleKeyPress(actualKey)}
        activeOpacity={0.7}
        disabled={disabled}
        style={[styles.key, disabled && styles.keyDisabled]}
      >
        <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>
          {actualKey}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, keyIndex) => renderKey(key, rowIndex, keyIndex))}
        </View>
      ))}
    </View>
  );
};

// Amount display component to use with keypad
interface AmountDisplayProps {
  /** Amount value in IRR */
  value: number;
  /** Currency label */
  currency?: string;
  /** Maximum length for display */
  maxLength?: number;
  /** Placeholder when empty */
  placeholder?: string;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  value,
  currency = 'IRR',
  placeholder = '0',
}) => {
  // Format number with thousand separators
  const formatAmount = (amount: number): string => {
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) return placeholder;
    return amount.toLocaleString('en-US');
  };

  return (
    <View style={styles.amountContainer}>
      <Text style={styles.amountValue}>{formatAmount(value)}</Text>
      <Text style={styles.amountCurrency}>{currency}</Text>
    </View>
  );
};

// Quick amount chip buttons
interface QuickAmountChipsProps {
  /** Chip values */
  amounts: number[];
  /** Currently selected amount (for highlighting) */
  selectedAmount?: number;
  /** Called when a chip is pressed */
  onSelect: (amount: number) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Format function for display */
  formatLabel?: (amount: number) => string;
}

export const QuickAmountChips: React.FC<QuickAmountChipsProps> = ({
  amounts,
  selectedAmount,
  onSelect,
  disabled = false,
  formatLabel = (amount) => `${(amount / 1000000).toFixed(0)}M`,
}) => {
  return (
    <View style={styles.chipsContainer}>
      {amounts.map((amount) => {
        const isSelected = selectedAmount === amount;
        return (
          <TouchableOpacity
            key={amount}
            onPress={() => onSelect(amount)}
            disabled={disabled}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              disabled && styles.chipDisabled,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                disabled && styles.chipTextDisabled,
              ]}
            >
              {formatLabel(amount)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[4],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[3],
  },
  key: {
    width: 100,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 100,
    height: 64,
  },
  keyBackspace: {
    backgroundColor: 'transparent',
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyText: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  keyTextDisabled: {
    color: COLORS.text.disabled,
  },
  backspaceIcon: {
    fontSize: 28,
    color: COLORS.text.primary,
  },

  // Amount display
  amountContainer: {
    alignItems: 'center',
    paddingVertical: SPACING[6],
  },
  amountValue: {
    fontSize: 40,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  amountCurrency: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.text.muted,
  },

  // Quick amount chips
  chipsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING[2],
    paddingVertical: SPACING[3],
  },
  chip: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background.input,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: COLORS.brand.primary,
    backgroundColor: COLORS.brand.primaryMuted,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  chipTextSelected: {
    color: COLORS.brand.primary,
  },
  chipTextDisabled: {
    color: COLORS.text.disabled,
  },
});

export default NumericKeypad;
