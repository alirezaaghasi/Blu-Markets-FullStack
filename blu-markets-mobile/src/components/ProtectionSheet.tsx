// Protection Bottom Sheet Component
// Updated to use Black-Scholes pricing from backend API
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { ProtectableHolding, ProtectionQuote, Holding } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import { PROTECTION_DURATION_PRESETS } from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { addProtection, subtractCash, logAction, setPortfolioValues } from '../store/slices/portfolioSlice';
import { portfolio as portfolioApi } from '../services/api';
import { protection as protectionApi, formatPremiumPct, formatDuration, getRegimeColor } from '../services/api/protection';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';
import { formatIRR } from '../utils/currency';

interface ProtectionSheetProps {
  visible: boolean;
  onClose: () => void;
  holding?: ProtectableHolding | Holding; // Accept either type
  onPurchaseComplete?: () => void;
}

export const ProtectionSheet: React.FC<ProtectionSheetProps> = ({
  visible,
  onClose,
  holding: propHolding,
  onPurchaseComplete,
}) => {
  const dispatch = useAppDispatch();
  const { cashIRR, holdings } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // BUG-010 FIX: Helper to convert Holding to ProtectableHolding
  // NOTE: Client-side value calculations are for UI display ONLY
  // Backend protection.getHoldings API provides authoritative values
  // Indicative premiums are estimates - actual premiums come from backend quote
  const convertToProtectableHolding = (h: Holding | ProtectableHolding): ProtectableHolding => {
    // If already has holdingId, assume it's ProtectableHolding
    if ('holdingId' in h && h.holdingId) {
      return h as ProtectableHolding;
    }
    // At this point, h is Holding (has optional id)
    const holding = h as Holding;
    const asset = ASSETS[holding.assetId];
    const priceUSD = prices[holding.assetId] || 0;
    const priceIRR = priceUSD * fxRate;
    // UI ESTIMATE ONLY - backend quote is authoritative for actual values
    const valueIRR = holding.quantity * priceIRR;
    const valueUSD = holding.quantity * priceUSD;
    return {
      holdingId: holding.id || `demo-${holding.assetId}`,
      assetId: holding.assetId,
      name: asset?.name || holding.assetId,
      layer: holding.layer,
      quantity: holding.quantity,
      // UI ESTIMATES - backend getQuote provides authoritative premium pricing
      valueIrr: valueIRR,
      valueUsd: valueUSD,
      priceUsd: priceUSD,
      priceIrr: priceIRR,
      isProtectable: true,
      hasExistingProtection: false,
      volatility: { iv: 0.5, regime: 'NORMAL', regimeColor: '#3B82F6' },
      // Indicative only - actual premium from backend quote
      indicativePremium: { thirtyDayPct: 0.01, thirtyDayIrr: valueIRR * 0.01 },
    };
  };

  // FIX: Fetch eligible holdings from backend instead of filtering locally
  // Backend is the source of truth for which assets are protection-eligible
  const [eligibleHoldings, setEligibleHoldings] = useState<ProtectableHolding[]>([]);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);

  // Fetch eligible holdings from backend when sheet opens without propHolding
  useEffect(() => {
    if (!visible) return;

    // If a specific holding is provided, use it directly
    if (propHolding) {
      setEligibleHoldings([convertToProtectableHolding(propHolding)]);
      return;
    }

    // Fetch from backend
    let isMounted = true;
    const fetchEligible = async () => {
      setIsLoadingHoldings(true);
      setHoldingsError(null);
      try {
        const response = await protectionApi.getHoldings();
        if (isMounted) {
          // Filter out already protected and non-protectable assets
          const protectable = (response.holdings || []).filter(
            (h) => h.isProtectable && !h.hasExistingProtection && h.quantity > 0
          );
          setEligibleHoldings(protectable);
        }
      } catch (err: any) {
        if (isMounted) {
          setHoldingsError(err?.message || 'Failed to load eligible assets');
          setEligibleHoldings([]);
        }
      } finally {
        if (isMounted) setIsLoadingHoldings(false);
      }
    };

    fetchEligible();
    return () => { isMounted = false; };
  }, [visible, propHolding, prices, fxRate]);

  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState(30);
  const [coveragePct, setCoveragePct] = useState(1.0);
  const [quote, setQuote] = useState<ProtectionQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);
  // Task 4 (Round 2): Collapsible protection info
  const [showProtectionDetails, setShowProtectionDetails] = useState(false);

  // FIX: Show asset picker when opened without a specific holding
  const [showAssetPicker, setShowAssetPicker] = useState(!propHolding);

  // Reset asset picker state when sheet opens/closes or propHolding changes
  useEffect(() => {
    if (visible) {
      // If opened with a specific holding, skip picker; otherwise show it
      setShowAssetPicker(!propHolding);
      if (!propHolding) {
        setSelectedHoldingId(null);
      }
    }
  }, [visible, propHolding]);

  // Get the active holding - convert propHolding to ProtectableHolding if needed
  const holding: ProtectableHolding | undefined = propHolding
    ? convertToProtectableHolding(propHolding)
    : eligibleHoldings.find((h) => h.holdingId === selectedHoldingId);
  const asset = holding ? ASSETS[holding.assetId] : null;

  // Callback for manual quote refresh (button handler)
  const fetchQuote = useCallback(async () => {
    if (!holding?.holdingId) return;
    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const newQuote = await protectionApi.getQuote(
        holding.holdingId,
        coveragePct,
        durationDays
      );
      setQuote(newQuote);
    } catch (err: any) {
      setQuoteError(err?.message || 'Failed to get quote');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [holding?.holdingId, coveragePct, durationDays]);

  // Fetch quote on mount and when params change (with cleanup)
  useEffect(() => {
    if (!visible || !holding?.holdingId) return;

    let isMounted = true;

    const doFetch = async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);

      try {
        const newQuote = await protectionApi.getQuote(
          holding.holdingId,
          coveragePct,
          durationDays
        );
        if (isMounted) setQuote(newQuote);
      } catch (err: any) {
        if (isMounted) {
          setQuoteError(err?.message || 'Failed to get quote');
          setQuote(null);
        }
      } finally {
        if (isMounted) setIsLoadingQuote(false);
      }
    };

    doFetch();
    return () => { isMounted = false; };
  }, [visible, holding?.holdingId, coveragePct, durationDays]);

  // Validation
  const canAfford = quote ? cashIRR >= quote.premiumIrr : false;
  const isValid = canAfford && quote && !quoteError;

  // Handle confirmation
  const handleConfirm = async () => {
    // BUG-4 FIX: Provide feedback instead of silently returning
    if (!holding || !asset) {
      Alert.alert('Select Asset', 'Please select an asset to protect.');
      return;
    }
    if (!quote) {
      Alert.alert('Quote Required', quoteError || 'Unable to get protection quote. Please try again.');
      return;
    }
    if (!canAfford) {
      Alert.alert('Insufficient Funds', `You need ${(quote.premiumIrr ?? 0).toLocaleString()} IRR but only have ${(cashIRR ?? 0).toLocaleString()} IRR.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const protection = await protectionApi.purchase({
        quoteId: quote.quoteId,
        holdingId: holding.holdingId,
        coveragePct,
        durationDays,
        premiumIrr: quote.premiumIrr,
        acknowledgedPremium: true,
      });

      // Update local state
      dispatch(addProtection(protection));
      dispatch(subtractCash(quote.premiumIrr));
      dispatch(
        logAction({
          type: 'PROTECT',
          boundary: 'SAFE',
          message: `Protected ${asset.symbol} for ${formatDuration(durationDays)}`,
          amountIRR: quote.premiumIrr,
          assetId: holding.assetId,
        })
      );

      // Refresh full portfolio data to update all values (prevents stale data)
      try {
        const portfolioData = await portfolioApi.get();
        dispatch(setPortfolioValues({
          totalValueIrr: portfolioData.totalValueIrr || 0,
          holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
          currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
          driftPct: portfolioData.driftPct || 0,
          status: portfolioData.status || 'BALANCED',
        }));
      } catch (e) {
        console.warn('Failed to refresh portfolio after protection purchase:', e);
      }

      // Calculate expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      // Show success modal
      setSuccessResult({
        title: 'Protection Activated!',
        subtitle: `Your ${asset.name} is now protected`,
        items: [
          { label: 'Coverage', value: `${(coveragePct * 100).toFixed(0)}%` },
          { label: 'Duration', value: formatDuration(durationDays) },
          { label: 'Protection Cost', value: `${(quote.premiumIrr ?? 0).toLocaleString()} IRR` },
          { label: 'Expires', value: expiryDate.toLocaleDateString(), highlight: true },
        ],
      });
      setShowSuccess(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to activate protection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // BUG FIX: Close inner modal first, then parent with delay
  // React Native's Modal touch handling gets confused when nested modals close simultaneously
  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSuccessResult(null);
    // Delay parent modal close to allow inner modal to properly unmount
    setTimeout(() => {
      onClose();
      onPurchaseComplete?.();
    }, 150);
  };

  // Show loading, error, or empty state
  if (isLoadingHoldings || holdingsError || (eligibleHoldings.length === 0 && !propHolding)) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>Insure Assets</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            {isLoadingHoldings ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.emptyStateText, { marginTop: spacing[4] }]}>
                  Loading eligible assets...
                </Text>
              </>
            ) : holdingsError ? (
              <>
                <Text style={styles.emptyStateText}>
                  {holdingsError}
                </Text>
                <TouchableOpacity
                  style={{ marginTop: spacing[4], padding: spacing[3], backgroundColor: colors.primary, borderRadius: borderRadius.default }}
                  onPress={() => {
                    setHoldingsError(null);
                    setIsLoadingHoldings(true);
                    protectionApi.getHoldings().then((res) => {
                      const protectable = (res.holdings || []).filter(
                        (h) => h.isProtectable && !h.hasExistingProtection && h.quantity > 0
                      );
                      setEligibleHoldings(protectable);
                    }).catch((err) => {
                      setHoldingsError(err?.message || 'Failed to load');
                    }).finally(() => setIsLoadingHoldings(false));
                  }}
                >
                  <Text style={{ color: colors.textPrimaryDark, fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyStateText}>
                  No assets available for protection.
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Growth and Upside layer assets can be protected against price drops.
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // FIX: Show asset picker when opened from HomeScreen without a specific holding
  if (showAssetPicker && !propHolding) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>Select Asset to Insure</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.pickerSubtitle}>
              Choose an asset from your portfolio to protect against price drops.
            </Text>
            {eligibleHoldings.map((h) => {
              const assetInfo = ASSETS[h.assetId];
              return (
                <TouchableOpacity
                  key={h.holdingId}
                  style={styles.assetPickerItem}
                  onPress={() => {
                    setSelectedHoldingId(h.holdingId);
                    setShowAssetPicker(false);
                  }}
                >
                  <View
                    style={[
                      styles.assetIcon,
                      { backgroundColor: `${LAYER_COLORS[assetInfo?.layer || 'GROWTH']}20` },
                    ]}
                  >
                    <Text style={styles.assetIconText}>{h.assetId.slice(0, 2)}</Text>
                  </View>
                  <View style={styles.assetPickerInfo}>
                    <Text style={styles.assetPickerName}>{assetInfo?.name || h.assetId}</Text>
                    <Text style={styles.assetPickerQuantity}>
                      {h.quantity?.toFixed(6)} {h.assetId}
                    </Text>
                  </View>
                  <View style={styles.assetPickerValue}>
                    <Text style={styles.assetPickerValueText}>
                      {formatIRR(h.valueIrr || 0)}
                    </Text>
                    <Text style={styles.assetPickerLayerBadge}>
                      {h.layer}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Guard: ensure holding is defined before rendering main form
  if (!holding) {
    return null;
  }

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
          {/* Back button when opened from HomeScreen (not with specific holding) */}
          {!propHolding && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowAssetPicker(true);
                setSelectedHoldingId(null);
                setQuote(null);
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Insure {asset?.name || holding.assetId}</Text>
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
                  { backgroundColor: `${LAYER_COLORS[asset?.layer || 'GROWTH']}20` },
                ]}
              >
                <Text style={styles.assetIconText}>{holding.assetId.slice(0, 2)}</Text>
              </View>
              <View>
                <Text style={styles.assetName}>{asset?.name || holding.assetId}</Text>
                <Text style={styles.assetQuantity}>
                  {holding.quantity?.toFixed(6) || '0'} {holding.assetId}
                </Text>
              </View>
            </View>
            <View style={styles.assetValue}>
              <Text style={styles.assetValueLabel}>Value to Protect</Text>
              <Text style={styles.assetValueAmount}>
                {formatIRR(holding.valueIrr || 0)}
              </Text>
              {holding.valueUsd && (
                <Text style={styles.assetValueUsd}>
                  ${(holding.valueUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                </Text>
              )}
            </View>
          </View>

          {/* Duration Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Duration</Text>
            <View style={styles.durationOptions}>
              {PROTECTION_DURATION_PRESETS.map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.durationChip,
                    durationDays === days && styles.durationChipActive,
                  ]}
                  onPress={() => setDurationDays(days)}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      durationDays === days && styles.durationChipTextActive,
                    ]}
                  >
                    {formatDuration(days)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Coverage Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coverage Amount</Text>
            <View style={styles.coverageOptions}>
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    styles.coverageChip,
                    coveragePct === pct && styles.coverageChipActive,
                  ]}
                  onPress={() => setCoveragePct(pct)}
                >
                  <Text
                    style={[
                      styles.coverageChipText,
                      coveragePct === pct && styles.coverageChipTextActive,
                    ]}
                  >
                    {pct * 100}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quote Loading */}
          {isLoadingQuote && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Getting quote...</Text>
            </View>
          )}

          {/* Quote Error */}
          {quoteError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{quoteError}</Text>
              <TouchableOpacity onPress={fetchQuote}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Task 2 (Round 2): Simplified to 2 rows - Total Protection Cost + Available Cash */}
          {quote && !isLoadingQuote && (
            <View style={styles.costSummary}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Total Protection Cost</Text>
                <Text style={styles.costValue}>{formatIRR(quote.premiumIrr || 0)}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Available Cash</Text>
                <Text style={[styles.costValue, !canAfford && styles.cashValueInsufficient]}>
                  {formatIRR(cashIRR || 0)}
                </Text>
              </View>
            </View>
          )}

          {/* Show Available Cash even when no quote yet */}
          {!quote && !isLoadingQuote && (
            <View style={styles.cashInfo}>
              <Text style={styles.cashLabel}>Available Cash</Text>
              <Text style={styles.cashValue}>{formatIRR(cashIRR || 0)}</Text>
            </View>
          )}

          {quote && !canAfford && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                Insufficient cash. Add {formatIRR((quote.premiumIrr || 0) - (cashIRR || 0))} more.
              </Text>
            </View>
          )}

          {/* Task 4 (Round 2): Collapsible "How Protection Works" - one line by default */}
          <TouchableOpacity
            onPress={() => setShowProtectionDetails(!showProtectionDetails)}
            style={styles.protectionInfoContainer}
            activeOpacity={0.7}
          >
            <View style={styles.protectionInfoRow}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.protectionInfoText}>
                If {holding.assetId} drops, you're covered for the difference.
              </Text>
              <Text style={styles.learnMoreLink}>
                {showProtectionDetails ? 'Show less' : 'Learn more ›'}
              </Text>
            </View>
          </TouchableOpacity>

          {showProtectionDetails && (
            <View style={styles.protectionDetailsExpanded}>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>
                  If {holding.assetId} drops below today's price, you receive the difference
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>
                  Coverage ends automatically at expiry
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>
                  This purchase is final and cannot be refunded
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!isValid || isSubmitting || isLoadingQuote) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || isSubmitting || isLoadingQuote}
          >
            <Text style={styles.confirmButtonText}>
              {isSubmitting
                ? 'Processing...'
                : isLoadingQuote
                ? 'Loading...'
                : quote
                ? `Purchase Insurance for ${formatIRR(quote.premiumIrr || 0)}`
                : 'Get Quote First'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Success Modal */}
      <TransactionSuccessModal
        visible={showSuccess}
        onClose={handleSuccessClose}
        result={successResult}
        accentColor={colors.primary}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyStateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Asset picker styles
  pickerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[4],
  },
  assetPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  assetPickerInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  assetPickerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  assetPickerQuantity: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  assetPickerValue: {
    alignItems: 'flex-end',
  },
  assetPickerValueText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  assetPickerLayerBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
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
  backButton: {
    position: 'absolute',
    left: spacing[4],
    top: spacing[3],
  },
  backButtonText: {
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
  assetValueUsd: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing[1],
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
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  durationChip: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  durationChipTextActive: {
    color: colors.textPrimaryDark,
  },
  coverageOptions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  coverageChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  coverageChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  coverageChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  coverageChipTextActive: {
    color: colors.textPrimaryDark,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[2],
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  // Task 2 (Round 2): Cost summary styles - 2 rows only
  costSummary: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  costLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  costValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  // Legacy premium styles (kept for compatibility)
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
  greeksCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  greeksTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  greeksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  greeksLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  greeksValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  greeksValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  regimeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  regimeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  breakevenCard: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  breakevenTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing[2],
  },
  breakevenText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
    lineHeight: 20,
  },
  breakevenHighlight: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  breakevenSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing[2],
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    flex: 1,
  },
  retryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    marginLeft: spacing[2],
  },
  // Task 4 (Round 2): Collapsible protection info styles
  protectionInfoContainer: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  protectionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  infoIcon: {
    fontSize: typography.fontSize.base,
    marginRight: spacing[2],
  },
  protectionInfoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
  },
  learnMoreLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },
  protectionDetailsExpanded: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  // Legacy info styles (kept for compatibility)
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
