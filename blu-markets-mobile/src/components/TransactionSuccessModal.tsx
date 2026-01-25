/**
 * TransactionSuccessModal
 * Reusable success modal for all transaction sheets
 * Shows animated checkmark, summary, and action button
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Button } from './common';

export interface TransactionSuccessResult {
  title: string;
  subtitle?: string;
  items: Array<{
    label: string;
    value: string;
    highlight?: boolean;
  }>;
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
}

interface TransactionSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  result: TransactionSuccessResult | null;
  accentColor?: string;
}

export const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({
  visible,
  onClose,
  result,
  accentColor = colors.success,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      checkScale.setValue(0);

      // Animate success icon
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(checkScale, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim, checkScale]);

  if (!result) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Success Icon */}
              <Animated.View
                style={[
                  styles.iconContainer,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <View style={[styles.successCircle, { backgroundColor: accentColor }]}>
                  <Animated.Text
                    style={[
                      styles.checkmark,
                      { transform: [{ scale: checkScale }] },
                    ]}
                  >
                    ✓
                  </Animated.Text>
                </View>
              </Animated.View>

              {/* Title */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.title}>{result.title}</Text>
                {result.subtitle && (
                  <Text style={styles.subtitle}>{result.subtitle}</Text>
                )}
              </Animated.View>

              {/* Summary Items */}
              <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
                {result.items.map((item, index) => (
                  <View key={index}>
                    {index > 0 && <View style={styles.divider} />}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{item.label}</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          item.highlight && { color: accentColor },
                        ]}
                      >
                        {item.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </Animated.View>

              {/* Actions - Side by side layout */}
              <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
                {result.secondaryAction && (
                  <Button
                    label={result.secondaryAction.label}
                    variant="secondary"
                    size="lg"
                    onPress={result.secondaryAction.onPress}
                    style={styles.actionButton}
                  />
                )}
                <Button
                  label={result.primaryAction?.label || 'Done'}
                  variant="primary"
                  size="lg"
                  onPress={result.primaryAction?.onPress || onClose}
                  style={styles.actionButton}
                />
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing[4],
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: colors.textPrimaryDark,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDark,
    marginVertical: spacing[2],
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing[3],
  },
  actionButton: {
    flex: 1,
  },
});

export default TransactionSuccessModal;
