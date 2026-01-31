/**
 * TradeSuccessModal
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Success modal shown after trade completion
 * Shows: Checkmark animation, trade summary, new balance
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYOUT } from '../constants/layout';
import { Button } from './common';
import { AssetId } from '../types';
import { ASSETS } from '../constants/assets';
import { TRADE, BUTTONS } from '../constants/messages';
import { formatIRR } from '../utils/currency';

interface TradeResult {
  side: 'BUY' | 'SELL';
  assetId: AssetId;
  amountIRR: number;
  quantity: number;
  newCashBalance: number;
  newHoldingQuantity: number;
}

interface TradeSuccessModalProps {
  /** Visibility state */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Trade result data */
  result: TradeResult | null;
}

// Format number with commas
const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return num.toLocaleString('en-US');
};

export const TradeSuccessModal: React.FC<TradeSuccessModalProps> = ({
  visible,
  onClose,
  result,
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
  }, [visible]);

  if (!result) return null;

  const asset = ASSETS[result.assetId];

  // Guard clause: return null if asset not found
  if (!asset) return null;

  const isBuy = result.side === 'BUY';

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
                <View style={styles.successCircle}>
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
                <Text style={styles.title}>{TRADE.success.title}</Text>
                <Text style={styles.subtitle}>
                  Your {isBuy ? 'purchase' : 'sale'} was successful
                </Text>
              </Animated.View>

              {/* Trade Summary */}
              <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {isBuy ? 'Purchased' : 'Sold'}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {(result.quantity ?? 0).toFixed(6)} {asset.symbol ?? ''}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {isBuy ? 'Amount Paid' : 'Amount Received'}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatIRR(result.amountIRR ?? 0)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.balanceSection}>
                  <Text style={styles.balanceTitle}>{TRADE.success.newBalances}</Text>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Cash</Text>
                    <Text style={styles.balanceValue}>
                      {formatIRR(result.newCashBalance ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>{asset.symbol ?? ''}</Text>
                    <Text style={styles.balanceValue}>
                      {(result.newHoldingQuantity ?? 0).toFixed(6)}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Action */}
              <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
                <Button
                  label={BUTTONS.done}
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={onClose}
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
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[4],
  },
  container: {
    width: '100%',
    maxWidth: LAYOUT.modalMaxWidth,
    backgroundColor: COLORS.background.elevated,
    borderRadius: LAYOUT.modalRadius,
    padding: LAYOUT.modalPadding,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING[4],
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.semantic.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: COLORS.text.inverse,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING[1],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING[5],
  },
  summaryCard: {
    width: '100%',
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginBottom: SPACING[5],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING[3],
  },
  balanceSection: {
    marginTop: SPACING[2],
  },
  balanceTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING[2],
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[1],
  },
  balanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  balanceValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  actions: {
    width: '100%',
  },
});

export default TradeSuccessModal;
