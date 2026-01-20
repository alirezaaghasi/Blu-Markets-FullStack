// Protection Bottom Sheet Component
// Based on PRD Section 6.4 - Protection Flow
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Holding, Protection } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import {
  PROTECTION_PREMIUM_BY_LAYER,
  PROTECTION_MIN_DURATION,
  PROTECTION_MAX_DURATION,
} from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { addProtection, subtractCash, logAction } from '../store/slices/portfolioSlice';

interface ProtectionSheetProps {
  visible: boolean;
  onClose: () => void;
  holding: Holding;
}

// Duration options in months
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6];

export const ProtectionSheet: React.FC<ProtectionSheetProps> = ({
  visible,
  onClose,
  holding,
}) => {
  const dispatch = useAppDispatch();
  const { cashIRR } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  const [durationMonths, setDurationMonths] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const asset = ASSETS[holding.assetId];
  const priceUSD = prices[holding.assetId] || 0;
  const holdingValueIRR = holding.quantity * priceUSD * fxRate;

  // Calculate premium
  const monthlyRate = PROTECTION_PREMIUM_BY_LAYER[asset.layer];
  const premiumIRR = useMemo(() => {
    return Math.round(holdingValueIRR * monthlyRate * durationMonths);
  }, [holdingValueIRR, monthlyRate, durationMonths]);

  // Validation
  const canAfford = cashIRR >= premiumIRR;
  const isValid = canAfford && holdingValueIRR > 0;

  // Handle confirmation
  const handleConfirm = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const protection: Protection = {
        id: `prot-${Date.now()}`,
        assetId: holding.assetId,
        notionalIRR: holdingValueIRR,
        premiumIRR,
        startISO: now.toISOString(),
        endISO: endDate.toISOString(),
        durationMonths,
      };

      dispatch(addProtection(protection));
      dispatch(subtractCash(premiumIRR));
      dispatch(
        logAction({
          type: 'PROTECT',
          boundary: 'SAFE',
          message: `Protected ${asset.symbol} for ${durationMonths}mo`,
          amountIRR: premiumIRR,
          assetId: holding.assetId,
        })
      );

      Alert.alert(
        'Protection Activated',
        `Your ${asset.name} is now protected for ${durationMonths} months.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to activate protection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dragIndicator} />
          <Text style={styles.title}>Protect {asset.name}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Asset Info */}
          <View style={styles.assetCard}>
            <View style={styles.assetHeader}>
              <View
                style={[
                  styles.assetIcon,
                  { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                ]}
              >
                <Text style={styles.assetIconText}>{asset.symbol.slice(0, 2)}</Text>
              </View>
              <View>
                <Text style={styles.assetName}>{asset.name}</Text>
                <Text style={styles.assetQuantity}>
                  {holding.quantity.toFixed(6)} {asset.symbol}
                </Text>
              </View>
            </View>
            <View style={styles.assetValue}>
              <Text style={styles.assetValueLabel}>Value to Protect</Text>
              <Text style={styles.assetValueAmount}>
                {holdingValueIRR.toLocaleString()} IRR
              </Text>
            </View>
          </View>

          {/* Duration Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Duration</Text>
            <View style={styles.durationOptions}>
              {DURATION_OPTIONS.map((months) => (
                <TouchableOpacity
                  key={months}
                  style={[
                    styles.durationChip,
                    durationMonths === months && styles.durationChipActive,
                  ]}
                  onPress={() => setDurationMonths(months)}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      durationMonths === months && styles.durationChipTextActive,
                    ]}
                  >
                    {months}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Premium Calculation */}
          <View style={styles.premiumCard}>
            <View style={styles.premiumRow}>
              <Text style={styles.premiumLabel}>Monthly Rate</Text>
              <Text style={styles.premiumValue}>
                {(monthlyRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.premiumRow}>
              <Text style={styles.premiumLabel}>Duration</Text>
              <Text style={styles.premiumValue}>{durationMonths} months</Text>
            </View>
            <View style={[styles.premiumRow, styles.premiumRowTotal]}>
              <Text style={styles.premiumTotalLabel}>Total Premium</Text>
              <Text style={styles.premiumTotalValue}>
                {premiumIRR.toLocaleString()} IRR
              </Text>
            </View>
          </View>

          {/* Available Cash */}
          <View style={styles.cashInfo}>
            <Text style={styles.cashLabel}>Available Cash</Text>
            <Text
              style={[
                styles.cashValue,
                !canAfford && styles.cashValueInsufficient,
              ]}
            >
              {cashIRR.toLocaleString()} IRR
            </Text>
          </View>

          {!canAfford && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                Insufficient cash. Add {(premiumIRR - cashIRR).toLocaleString()} IRR more to afford this protection.
              </Text>
            </View>
          )}

          {/* How It Works */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How Protection Works</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                You pay a one-time premium of {premiumIRR.toLocaleString()} IRR
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                If {asset.symbol} drops below today's price during coverage, you're protected
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                Coverage ends automatically after {durationMonths} months
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>
                You can cancel anytime, but premiums are non-refundable
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!isValid || isSubmitting) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            <Text style={styles.confirmButtonText}>
              {isSubmitting
                ? 'Processing...'
                : `Buy Protection for ${premiumIRR.toLocaleString()} IRR`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  closeButton: {
    position: 'absolute',
    right: spacing[4],
    top: spacing[3],
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  assetCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  assetIconText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  assetName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  assetQuantity: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  assetValue: {
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    alignItems: 'center',
  },
  assetValueLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  assetValueAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  durationOptions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  durationChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  durationChipTextActive: {
    color: colors.textPrimaryDark,
  },
  premiumCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  premiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  premiumRowTotal: {
    paddingTop: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  premiumLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  premiumValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  premiumTotalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  premiumTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  cashInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cashLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  cashValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  cashValueInsufficient: {
    color: colors.error,
  },
  errorBanner: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  infoCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  infoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  infoBullet: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing[2],
    width: 16,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: spacing[4],
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default ProtectionSheet;
