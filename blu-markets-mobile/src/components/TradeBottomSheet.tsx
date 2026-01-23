/**
 * TradeBottomSheet
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * BUY/SELL interface with two-step confirmation flow
 * Step 1: Enter trade details → Review Trade
 * Step 2: ConfirmTradeModal → Confirm/Cancel
 * Result: TradeSuccessModal or TradeErrorModal
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, BOUNDARY_BG } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYOUT } from '../constants/layout';
import { Button } from './common';
import { AssetId, Boundary, Holding, TradePreview } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { MIN_TRADE_AMOUNT, SPREAD_BY_LAYER } from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { updateHoldingFromTrade, updateCash, logAction } from '../store/slices/portfolioSlice';
import {
  validateBuyTrade,
  validateSellTrade,
  generateTradePreview,
} from '../utils/tradeValidation';
import AllocationBar from './AllocationBar';
import { trade } from '../services/api';
import { ConfirmTradeModal } from './ConfirmTradeModal';
import { TradeSuccessModal } from './TradeSuccessModal';
import { TradeErrorModal } from './TradeErrorModal';

interface TradeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  initialAssetId?: AssetId;
  initialSide?: 'BUY' | 'SELL';
}

// Trade validation constants
const MIN_BUY_AMOUNT_IRR = 100_000; // Minimum buy amount in IRR
const MIN_SELL_QUANTITY = 0.0001; // Minimum sell quantity in units

// Quick amount chips as percentages
const QUICK_AMOUNTS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.50 },
  { label: '75%', value: 0.75 },
  { label: 'Max', value: 1.0 },
];

// Boundary indicator colors
const BOUNDARY_COLORS: Record<Boundary, string> = {
  SAFE: COLORS.boundary.safe,
  DRIFT: COLORS.boundary.drift,
  STRUCTURAL: COLORS.boundary.structural,
  STRESS: COLORS.boundary.stress,
};

// Trade result for success modal
interface TradeResult {
  side: 'BUY' | 'SELL';
  assetId: AssetId;
  amountIRR: number;
  quantity: number;
  newCashBalance: number;
  newHoldingQuantity: number;
}

export const TradeBottomSheet: React.FC<TradeBottomSheetProps> = ({
  visible,
  onClose,
  initialAssetId = 'BTC',
  initialSide = 'BUY',
}) => {
  const dispatch = useAppDispatch();
  const { holdings, cashIRR, targetLayerPct } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Trade input state
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [assetId, setAssetId] = useState<AssetId>(initialAssetId);
  const [amountInput, setAmountInput] = useState('');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Two-step confirmation flow state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const asset = ASSETS[assetId];
  const priceUSD = prices[assetId] || 0;
  const priceIRR = priceUSD * fxRate;

  // Find holding for selected asset
  const holding = holdings.find((h) => h.assetId === assetId);
  const holdingQuantity = holding?.quantity || 0;
  const holdingValue = holdingQuantity * priceIRR;

  // Calculate holding values map
  const holdingValues = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      const p = prices[h.assetId] || 0;
      map.set(h.assetId, h.quantity * p * fxRate);
    });
    return map;
  }, [holdings, prices, fxRate]);

  // Current allocation
  const currentAllocation = useMemo(() => {
    const layerValues = { FOUNDATION: cashIRR, GROWTH: 0, UPSIDE: 0 };
    holdingValues.forEach((value, id) => {
      const a = ASSETS[id as AssetId];
      if (a) layerValues[a.layer] += value;
    });
    const total = layerValues.FOUNDATION + layerValues.GROWTH + layerValues.UPSIDE;
    if (total === 0) return { FOUNDATION: 1, GROWTH: 0, UPSIDE: 0 };
    return {
      FOUNDATION: layerValues.FOUNDATION / total,
      GROWTH: layerValues.GROWTH / total,
      UPSIDE: layerValues.UPSIDE / total,
    };
  }, [holdingValues, cashIRR]);

  // Parse amount
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  // Calculate quantity from IRR amount
  const tradeQuantity = priceIRR > 0 ? amountIRR / priceIRR : 0;

  // Available balance for current side
  const availableBalance = side === 'BUY' ? cashIRR : holdingValue;

  // Enhanced validation with clearer error messages
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (side === 'BUY') {
      // Buy validation
      if (amountIRR > 0 && amountIRR < MIN_BUY_AMOUNT_IRR) {
        errors.push(`Minimum trade is ${MIN_BUY_AMOUNT_IRR.toLocaleString()} IRR`);
      }
      if (amountIRR > cashIRR) {
        errors.push('Insufficient funds');
      }
      if (!ASSETS[assetId]) {
        errors.push('Invalid asset');
      }
    } else {
      // Sell validation - quantity based
      if (!holding) {
        errors.push('You do not hold this asset');
      } else {
        if (holding.frozen) {
          errors.push('This asset is locked as loan collateral');
        }
        if (tradeQuantity > 0 && tradeQuantity < MIN_SELL_QUANTITY) {
          errors.push(`Minimum sell quantity is ${MIN_SELL_QUANTITY} ${asset.symbol}`);
        }
        if (tradeQuantity > holdingQuantity) {
          errors.push('Exceeds available balance');
        }
      }
    }

    return {
      ok: errors.length === 0 && amountIRR > 0,
      errors,
      meta: {
        required: amountIRR,
        available: availableBalance,
      },
    };
  }, [side, amountIRR, cashIRR, assetId, holding, holdingQuantity, tradeQuantity, asset.symbol, availableBalance]);

  // Generate preview
  const preview = useMemo(() => {
    if (amountIRR < MIN_TRADE_AMOUNT) return null;
    return generateTradePreview(
      side,
      assetId,
      amountIRR,
      priceUSD,
      fxRate,
      currentAllocation,
      targetLayerPct,
      holdings,
      holdingValues,
      cashIRR
    );
  }, [side, assetId, amountIRR, priceUSD, fxRate, currentAllocation, targetLayerPct, holdings, holdingValues, cashIRR]);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  // Handle amount input
  const handleAmountChange = (text: string) => {
    // Remove non-numeric characters except commas
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setAmountInput('');
      return;
    }
    const num = parseInt(cleaned, 10);
    setAmountInput(formatNumber(num));
  };

  // Handle quick amount selection
  const handleQuickAmount = (percentage: number) => {
    const amount = Math.floor(availableBalance * percentage);
    setAmountInput(formatNumber(amount));
  };

  // Step 1: Open confirmation modal (Review Trade)
  const handleReviewTrade = () => {
    if (!validation.ok || !preview) return;
    setShowConfirmModal(true);
  };

  // Step 2: Execute trade after confirmation
  const handleConfirmTrade = async () => {
    if (!preview) return;

    setIsSubmitting(true);
    try {
      // Execute trade via API
      const response = await trade.execute(assetId, side, amountIRR);

      // Update local state with trade result
      dispatch(updateHoldingFromTrade({
        assetId,
        quantity: response.newHoldingQuantity,
        side,
      }));
      // Update cash - for BUY we subtract, for SELL we add
      const cashChange = side === 'BUY' ? -amountIRR : amountIRR;
      dispatch(updateCash(cashIRR + cashChange));

      // Log action to activity feed
      dispatch(logAction({
        type: 'TRADE',
        boundary: preview.boundary,
        message: `${side === 'BUY' ? 'Bought' : 'Sold'} ${preview.quantity.toFixed(6)} ${asset.symbol}`,
        amountIRR: amountIRR,
      }));

      // Set trade result for success modal
      setTradeResult({
        side,
        assetId,
        amountIRR,
        quantity: preview.quantity,
        newCashBalance: cashIRR + cashChange,
        newHoldingQuantity: response.newHoldingQuantity,
      });

      // Close confirm modal, show success modal
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute trade. Please try again.';
      setErrorMessage(errorMessage);

      // Close confirm modal, show error modal
      setShowConfirmModal(false);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle success modal close
  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setTradeResult(null);
    setAmountInput('');
    onClose(); // Close the entire bottom sheet
  };

  // Handle error modal close
  const handleErrorClose = () => {
    setShowErrorModal(false);
    setErrorMessage('');
  };

  // Handle error retry
  const handleErrorRetry = () => {
    setShowErrorModal(false);
    setErrorMessage('');
    setShowConfirmModal(true); // Re-open confirm modal
  };

  // Reset on asset change
  const handleAssetChange = (newAssetId: AssetId) => {
    setAssetId(newAssetId);
    setAmountInput('');
    setShowAssetPicker(false);
  };

  // Reset when side changes
  const handleSideChange = (newSide: 'BUY' | 'SELL') => {
    setSide(newSide);
    setAmountInput('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Asset Selector */}
            <TouchableOpacity
              style={styles.assetSelector}
              onPress={() => setShowAssetPicker(true)}
            >
              <View style={styles.assetInfo}>
                <View style={[styles.assetIcon, { backgroundColor: `${LAYER_COLORS[asset.layer]}20` }]}>
                  <Text style={styles.assetIconText}>{asset.symbol.slice(0, 2)}</Text>
                </View>
                <View>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetPrice}>
                    {formatNumber(priceIRR)} IRR (${priceUSD.toLocaleString()})
                  </Text>
                </View>
              </View>
              <Text style={styles.assetArrow}>›</Text>
            </TouchableOpacity>

            {/* Buy/Sell Toggle */}
            <View style={styles.sideToggle}>
              <TouchableOpacity
                style={[styles.sideButton, side === 'BUY' && styles.sideButtonActive]}
                onPress={() => handleSideChange('BUY')}
              >
                <Text style={[styles.sideButtonText, side === 'BUY' && styles.sideButtonTextActive]}>
                  Buy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideButton, side === 'SELL' && styles.sideButtonActiveSell]}
                onPress={() => handleSideChange('SELL')}
              >
                <Text style={[styles.sideButtonText, side === 'SELL' && styles.sideButtonTextActive]}>
                  Sell
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount (IRR)</Text>
              <TextInput
                style={styles.amountInput}
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={COLORS.text.muted}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.availableText}>
                Available: {formatNumber(availableBalance)} IRR
              </Text>
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={styles.quickChip}
                  onPress={() => handleQuickAmount(chip.value)}
                >
                  <Text style={styles.quickChipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview Section */}
            {preview && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Trade Preview</Text>

                {/* Quantity */}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>You will {side === 'BUY' ? 'receive' : 'sell'}</Text>
                  <Text style={styles.previewValue}>
                    {preview.quantity.toFixed(6)} {asset.symbol}
                  </Text>
                </View>

                {/* Spread */}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Spread ({(preview.spread * 100).toFixed(2)}%)</Text>
                  <Text style={styles.previewValue}>
                    {formatNumber(Math.round(amountIRR * preview.spread))} IRR
                  </Text>
                </View>

                {/* Allocation Preview */}
                <View style={styles.allocationPreview}>
                  <Text style={styles.allocationLabel}>Allocation Impact</Text>
                  <View style={styles.allocationBars}>
                    <View style={styles.allocationBarRow}>
                      <Text style={styles.allocationBarLabel}>Before</Text>
                      <AllocationBar current={preview.before} target={targetLayerPct} compact />
                    </View>
                    <View style={styles.allocationBarRow}>
                      <Text style={styles.allocationBarLabel}>After</Text>
                      <AllocationBar current={preview.after} target={targetLayerPct} compact />
                    </View>
                    <View style={styles.allocationBarRow}>
                      <Text style={styles.allocationBarLabel}>Target</Text>
                      <AllocationBar current={targetLayerPct} target={targetLayerPct} compact />
                    </View>
                  </View>
                </View>

                {/* Boundary Indicator */}
                <View style={[styles.boundaryIndicator, { backgroundColor: `${BOUNDARY_COLORS[preview.boundary]}20` }]}>
                  <View style={[styles.boundaryDot, { backgroundColor: BOUNDARY_COLORS[preview.boundary] }]} />
                  <Text style={[styles.boundaryText, { color: BOUNDARY_COLORS[preview.boundary] }]}>
                    {preview.boundary} {preview.movesTowardTarget ? '(moves toward target)' : ''}
                  </Text>
                </View>

                {/* Friction Copy */}
                {preview.frictionCopy.length > 0 && (
                  <View style={styles.frictionCopy}>
                    {preview.frictionCopy.map((copy, index) => (
                      <Text key={index} style={styles.frictionText}>
                        {copy}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Validation Errors */}
            {!validation.ok && amountIRR > 0 && (
              <View style={styles.errorSection}>
                {validation.errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    {error}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Review Trade Button (Step 1) */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                side === 'SELL' && styles.confirmButtonSell,
                !validation.ok && styles.confirmButtonDisabled,
              ]}
              onPress={handleReviewTrade}
              disabled={!validation.ok}
            >
              <Text style={styles.confirmButtonText}>
                Review Trade
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Asset Picker Modal */}
        <AssetPickerModal
          visible={showAssetPicker}
          onClose={() => setShowAssetPicker(false)}
          onSelect={handleAssetChange}
          currentAssetId={assetId}
          side={side}
          holdings={holdings}
          prices={prices}
          fxRate={fxRate}
        />

        {/* Step 2: Confirm Trade Modal */}
        <ConfirmTradeModal
          visible={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmTrade}
          preview={preview}
          loading={isSubmitting}
        />

        {/* Success Modal */}
        <TradeSuccessModal
          visible={showSuccessModal}
          onClose={handleSuccessClose}
          result={tradeResult}
        />

        {/* Error Modal */}
        <TradeErrorModal
          visible={showErrorModal}
          onClose={handleErrorClose}
          onRetry={handleErrorRetry}
          message={errorMessage}
        />
      </SafeAreaView>
    </Modal>
  );
};

// Asset Picker Modal Component
interface AssetPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (assetId: AssetId) => void;
  currentAssetId: AssetId;
  side: 'BUY' | 'SELL';
  holdings: Holding[];
  prices: Record<string, number>;
  fxRate: number;
}

const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  currentAssetId,
  side,
  holdings,
  prices,
  fxRate,
}) => {
  // Get assets to show based on side
  const assetsToShow = useMemo(() => {
    if (side === 'BUY') {
      // Show all tradeable assets except IRR_FIXED_INCOME
      return Object.values(ASSETS).filter((a) => a.id !== 'IRR_FIXED_INCOME');
    } else {
      // Show only assets user holds
      return holdings
        .filter((h) => !h.frozen && h.quantity > 0)
        .map((h) => ASSETS[h.assetId]);
    }
  }, [side, holdings]);

  // Group by layer
  const assetsByLayer = useMemo(() => {
    const grouped: Record<string, typeof assetsToShow> = {
      FOUNDATION: [],
      GROWTH: [],
      UPSIDE: [],
    };
    assetsToShow.forEach((asset) => {
      grouped[asset.layer].push(asset);
    });
    return grouped;
  }, [assetsToShow]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select Asset</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.pickerClose}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.pickerScrollView}>
          {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as const).map((layer) => {
            const layerAssets = assetsByLayer[layer];
            if (layerAssets.length === 0) return null;

            return (
              <View key={layer} style={styles.pickerLayerSection}>
                <View style={styles.pickerLayerHeader}>
                  <View style={[styles.pickerLayerDot, { backgroundColor: LAYER_COLORS[layer] }]} />
                  <Text style={styles.pickerLayerName}>{LAYER_NAMES[layer]}</Text>
                </View>

                {layerAssets.map((asset) => {
                  const priceUSD = prices[asset.id] || 0;
                  const priceIRR = priceUSD * fxRate;
                  const holding = holdings.find((h) => h.assetId === asset.id);
                  const isSelected = asset.id === currentAssetId;

                  return (
                    <TouchableOpacity
                      key={asset.id}
                      style={[styles.pickerAssetRow, isSelected && styles.pickerAssetRowSelected]}
                      onPress={() => onSelect(asset.id)}
                    >
                      <View style={styles.pickerAssetInfo}>
                        <Text style={styles.pickerAssetName}>{asset.name}</Text>
                        <Text style={styles.pickerAssetPrice}>
                          {priceIRR.toLocaleString()} IRR
                        </Text>
                      </View>
                      {holding && holding.quantity > 0 && (
                        <Text style={styles.pickerHolding}>
                          {holding.quantity.toFixed(4)} {asset.symbol}
                        </Text>
                      )}
                      {isSelected && <Text style={styles.pickerCheckmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {side === 'SELL' && assetsToShow.length === 0 && (
            <View style={styles.pickerEmptyState}>
              <Text style={styles.pickerEmptyText}>No assets to sell</Text>
              <Text style={styles.pickerEmptySubtext}>
                Buy some assets first to start trading
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING[2],
  },
  closeButton: {
    position: 'absolute',
    right: SPACING[4],
    top: SPACING[3],
  },
  closeButtonText: {
    color: COLORS.brand.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING[4],
    paddingBottom: SPACING[8],
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  assetIconText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  assetName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  assetPrice: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  assetArrow: {
    fontSize: 24,
    color: COLORS.text.secondary,
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[1],
    marginBottom: SPACING[4],
  },
  sideButton: {
    flex: 1,
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  sideButtonActive: {
    backgroundColor: COLORS.semantic.success,
  },
  sideButtonActiveSell: {
    backgroundColor: COLORS.semantic.error,
  },
  sideButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  sideButtonTextActive: {
    color: COLORS.text.inverse,
  },
  amountSection: {
    marginBottom: SPACING[4],
  },
  amountLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
  },
  amountInput: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  availableText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING[2],
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[4],
    gap: SPACING[2],
  },
  quickChip: {
    flex: 1,
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  previewSection: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[4],
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[3],
  },
  previewLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  previewValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  allocationPreview: {
    marginTop: SPACING[4],
    paddingTop: SPACING[4],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  allocationLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
  },
  allocationBars: {
    gap: SPACING[2],
  },
  allocationBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
  },
  allocationBarLabel: {
    width: 50,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  boundaryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING[3],
    borderRadius: RADIUS.lg,
    marginTop: SPACING[4],
  },
  boundaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[2],
  },
  boundaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  frictionCopy: {
    marginTop: SPACING[3],
    padding: SPACING[3],
    backgroundColor: COLORS.semanticBg.warning,
    borderRadius: RADIUS.lg,
  },
  frictionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.semantic.warning,
    marginBottom: SPACING[1],
  },
  errorSection: {
    backgroundColor: COLORS.semanticBg.error,
    borderRadius: RADIUS.lg,
    padding: SPACING[3],
    marginBottom: SPACING[4],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.semantic.error,
    marginBottom: SPACING[1],
  },
  footer: {
    padding: SPACING[4],
    paddingBottom: LAYOUT.totalBottomSpace,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmButton: {
    backgroundColor: COLORS.semantic.success,
    borderRadius: RADIUS.full,
    padding: SPACING[4],
    alignItems: 'center',
  },
  confirmButtonSell: {
    backgroundColor: COLORS.semantic.error,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.inverse,
  },
  // Asset Picker Styles
  pickerContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  pickerClose: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.brand.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  pickerScrollView: {
    flex: 1,
  },
  pickerLayerSection: {
    padding: SPACING[4],
  },
  pickerLayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  pickerLayerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING[2],
  },
  pickerLayerName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
  },
  pickerAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[2],
  },
  pickerAssetRowSelected: {
    borderWidth: 2,
    borderColor: COLORS.brand.primary,
  },
  pickerAssetInfo: {
    flex: 1,
  },
  pickerAssetName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  pickerAssetPrice: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  pickerHolding: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginRight: SPACING[2],
  },
  pickerCheckmark: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.brand.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  pickerEmptyState: {
    alignItems: 'center',
    padding: SPACING[8],
  },
  pickerEmptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  pickerEmptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});

export default TradeBottomSheet;
