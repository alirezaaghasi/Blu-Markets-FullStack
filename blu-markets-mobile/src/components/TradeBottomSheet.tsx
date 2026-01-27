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
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { COLORS, BOUNDARY_BG } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYOUT } from '../constants/layout';
import { Button } from './common';
import { AssetId, Boundary, Holding, TradePreview } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { MIN_TRADE_AMOUNT, SPREAD_BY_LAYER } from '../constants/business';
import { calculateFixedIncomeValue } from '../utils/fixedIncome';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { updateHoldingFromTrade, updateCash, logAction, setStatus, setPortfolioValues } from '../store/slices/portfolioSlice';
import {
  validateBuyTrade,
  validateSellTrade,
} from '../utils/tradeValidation';
import AllocationBar from './AllocationBar';
import { trade, portfolio as portfolioApi } from '../services/api';
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
// MIN_TRADE_AMOUNT imported from business.ts (100,000 IRR per PRD)
// No minimum for sells - user can sell any amount

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

// BUG-1 FIX: Format IRR with compact notation (matching HoldingCard format)
const formatIRRCompact = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
};

// BUG-1 FIX: Calculate holding value for display (matches HoldingCard logic)
// Updated to prefer direct IRR prices from backend over USD * fxRate calculation
const getHoldingValueIRR = (
  h: Holding,
  prices: Record<string, number>,
  pricesIrr: Record<string, number>,
  fxRate: number
): number => {
  if (h.assetId === 'IRR_FIXED_INCOME') {
    const breakdown = calculateFixedIncomeValue(h.quantity, h.purchasedAt);
    return breakdown?.total || h.quantity;
  }
  // Prefer direct IRR price from backend, fallback to USD * fxRate
  const priceIrr = pricesIrr?.[h.assetId];
  if (priceIrr && priceIrr > 0) {
    return h.quantity * priceIrr;
  }
  const priceUsd = prices[h.assetId] || 0;
  return h.quantity * priceUsd * fxRate;
};

export const TradeBottomSheet: React.FC<TradeBottomSheetProps> = ({
  visible,
  onClose,
  initialAssetId = 'BTC',
  initialSide = 'BUY',
}) => {
  const dispatch = useAppDispatch();
  const { holdings, cashIRR, targetLayerPct } = useAppSelector((state) => state.portfolio);
  const { prices, pricesIrr, fxRate } = useAppSelector((state) => state.prices);

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
  // Guard: If asset not found, use defaults to prevent crashes
  const assetLayer = asset?.layer || 'GROWTH';
  const assetSymbol = asset?.symbol || '';
  const assetName = asset?.name || 'Unknown';
  const priceUSD = prices[assetId] || 0;
  // Prefer direct IRR price from backend, fallback to USD * fxRate
  const priceIRR = (pricesIrr?.[assetId] && pricesIrr[assetId] > 0)
    ? pricesIrr[assetId]
    : priceUSD * fxRate;

  // Find holding for selected asset
  const holding = holdings.find((h) => h.assetId === assetId);
  const holdingQuantity = holding?.quantity || 0;
  const holdingValue = holdingQuantity * priceIRR;

  // BUG-006 FIX: Client-side holding values are for UI display ONLY
  // Backend trade.preview API is AUTHORITATIVE for all trade decisions.
  // Calculate holding values map (UI estimate only)
  const holdingValues = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      // Prefer direct IRR price from backend, fallback to USD * fxRate
      const pIrr = pricesIrr?.[h.assetId];
      const valueIrr = (pIrr && pIrr > 0)
        ? h.quantity * pIrr
        : h.quantity * (prices[h.assetId] || 0) * fxRate;
      map.set(h.assetId, valueIrr);
    });
    return map;
  }, [holdings, prices, pricesIrr, fxRate]);

  // BUG-006 FIX: Client-side allocation is for UI display ONLY
  // Backend trade.preview provides authoritative before/after allocations
  // Current allocation (UI estimate only)
  const currentAllocation = useMemo(() => {
    const layerValues = { FOUNDATION: cashIRR, GROWTH: 0, UPSIDE: 0 };
    holdingValues.forEach((value, id) => {
      const a = ASSETS[id as AssetId];
      if (a) layerValues[a.layer] += value;
    });
    const total = layerValues.FOUNDATION + layerValues.GROWTH + layerValues.UPSIDE;
    if (total === 0) return { FOUNDATION: 1, GROWTH: 0, UPSIDE: 0 };
    // UI ESTIMATE ONLY - backend preview is authoritative
    return {
      FOUNDATION: layerValues.FOUNDATION / total,
      GROWTH: layerValues.GROWTH / total,
      UPSIDE: layerValues.UPSIDE / total,
    };
  }, [holdingValues, cashIRR]);

  // Parse amount
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  // BUG-006 FIX: Client-side quantity calculation is for UI preview ONLY
  // Backend trade.preview provides authoritative quantity after spread
  // Calculate quantity from IRR amount (UI estimate only)
  const tradeQuantity = priceIRR > 0 ? amountIRR / priceIRR : 0;

  // Available balance for current side
  const availableBalance = side === 'BUY' ? cashIRR : holdingValue;

  // Enhanced validation with clearer error messages
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (side === 'BUY') {
      // Buy validation
      if (amountIRR > 0 && amountIRR < MIN_TRADE_AMOUNT) {
        errors.push(`Minimum trade is ${MIN_TRADE_AMOUNT.toLocaleString()} IRR`);
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
        // No minimum for sells - user can sell any quantity
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
  }, [side, amountIRR, cashIRR, assetId, holding, holdingQuantity, tradeQuantity, asset?.symbol, availableBalance]);

  // Backend-derived trade preview
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Fetch preview from backend when trade parameters change
  useEffect(() => {
    if (amountIRR < MIN_TRADE_AMOUNT) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    // Debounce API call
    const timeoutId = setTimeout(async () => {
      if (!isMounted) return;
      setIsLoadingPreview(true);
      try {
        const previewData = await trade.preview(assetId, side, amountIRR);
        if (isMounted) setPreview(previewData);
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch trade preview:', error);
        if (isMounted) setPreview(null);
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [side, assetId, amountIRR]);

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
    // BUG-2 FIX: Provide feedback instead of silently returning
    if (isLoadingPreview) {
      Alert.alert('Please Wait', 'Loading trade preview...');
      return;
    }
    if (!validation.ok) {
      Alert.alert('Invalid Trade', validation.errors.join('\n') || 'Please check your trade details.');
      return;
    }
    if (!preview) {
      Alert.alert('Preview Not Ready', 'Unable to get trade preview. Please try again.');
      return;
    }
    if ((preview.quantity ?? 0) <= 0) {
      Alert.alert('Invalid Amount', 'Trade quantity is too small. Please enter a larger amount.');
      return;
    }
    setShowConfirmModal(true);
  };

  // Step 2: Execute trade after confirmation
  const handleConfirmTrade = async () => {
    if (!preview) return;

    setIsSubmitting(true);
    try {
      // Execute trade via API
      const response = await trade.execute(assetId, side, amountIRR);

      // BUG-017 FIX: Use backend-provided values only (no local calculations)
      // BUG-CASH FIX: Extract values from either root level aliases or nested newBalance object
      const newCash = response.newCashIrr ?? (response as any).newBalance?.cashIrr ?? cashIRR;
      const newHoldingQty = response.newHoldingQuantity ?? (response as any).newBalance?.holdingQuantity ?? 0;

      // Update holding quantity from backend response
      dispatch(updateHoldingFromTrade({
        assetId,
        quantity: newHoldingQty,
        side,
      }));
      // Update cash from backend (includes spread/fees)
      dispatch(updateCash(newCash));

      // BUG-STATUS FIX: Refresh portfolio status after trade to update badge and rebalance button
      try {
        const portfolioData = await portfolioApi.get();
        console.log('[TradeBottomSheet] Post-trade portfolio status:', portfolioData.status);
        console.log('[TradeBottomSheet] Post-trade allocation:', portfolioData.allocation);
        console.log('[TradeBottomSheet] Post-trade driftPct:', portfolioData.driftPct);
        dispatch(setStatus(portfolioData.status));
        dispatch(setPortfolioValues({
          totalValueIrr: portfolioData.totalValueIrr || 0,
          holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
          currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
          driftPct: portfolioData.driftPct || 0,
          status: portfolioData.status || 'BALANCED',
        }));
        console.log('[TradeBottomSheet] Dispatched status update:', portfolioData.status);
      } catch (e) {
        // Non-fatal - status will update on next refresh
        console.warn('Failed to refresh portfolio status after trade:', e);
      }

      // Log action to activity feed
      dispatch(logAction({
        type: 'TRADE',
        boundary: preview?.boundary ?? 'SAFE',
        message: `${side === 'BUY' ? 'Bought' : 'Sold'} ${(preview?.quantity ?? 0).toFixed(6)} ${asset?.symbol ?? ''}`,
        amountIRR: amountIRR,
      }));

      // Set trade result for success modal (using backend values)
      setTradeResult({
        side,
        assetId,
        amountIRR,
        quantity: preview.quantity ?? 0,
        newCashBalance: newCash,
        newHoldingQuantity: newHoldingQty,
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
  // BUG FIX: Close inner modal first, then parent with delay
  // React Native's Modal touch handling gets confused when nested modals close simultaneously
  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setTradeResult(null);
    setAmountInput('');
    // Delay parent modal close to allow inner modal to properly unmount
    setTimeout(() => {
      onClose();
    }, 150);
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
                <View style={[styles.assetIcon, { backgroundColor: `${LAYER_COLORS[assetLayer]}20` }]}>
                  <Text style={styles.assetIconText}>{assetSymbol}</Text>
                </View>
                <View>
                  <Text style={styles.assetName}>{assetName}</Text>
                  <Text style={styles.assetPrice}>
                    {/* BUG-DISPLAY FIX: Show holding value for SELL, price per unit for BUY */}
                    {side === 'SELL' && holdingValue > 0
                      ? `You own: ${formatIRRCompact(holdingValue)} IRR`
                      : `${formatNumber(priceIRR)} IRR (${(priceUSD || 0).toLocaleString()})`}
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
                    {(preview.quantity ?? 0).toFixed(6)} {asset?.symbol ?? ''}
                  </Text>
                </View>

                {/* Spread */}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Spread ({((preview.spread ?? 0) * 100).toFixed(2)}%)</Text>
                  <Text style={styles.previewValue}>
                    {formatNumber(Math.round(amountIRR * (preview.spread ?? 0)))} IRR
                  </Text>
                </View>

                {/* Allocation Preview */}
                {preview.before && preview.after && (
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
                )}

                {/* Boundary Indicator */}
                {preview.boundary && BOUNDARY_COLORS[preview.boundary] && (
                <View style={[styles.boundaryIndicator, { backgroundColor: `${BOUNDARY_COLORS[preview.boundary]}20` }]}>
                  <View style={[styles.boundaryDot, { backgroundColor: BOUNDARY_COLORS[preview.boundary] }]} />
                  <Text style={[styles.boundaryText, { color: BOUNDARY_COLORS[preview.boundary] }]}>
                    {preview.boundary} {preview.movesTowardTarget ? '(moves toward target)' : ''}
                  </Text>
                </View>
                )}

                {/* Friction Copy */}
                {Array.isArray(preview.frictionCopy) && preview.frictionCopy.length > 0 && (
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
                (!validation.ok || isLoadingPreview) && styles.confirmButtonDisabled,
              ]}
              onPress={handleReviewTrade}
              disabled={!validation.ok || isLoadingPreview}
            >
              <Text style={styles.confirmButtonText}>
                {isLoadingPreview ? 'Loading...' : 'Review Trade'}
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
          pricesIrr={pricesIrr}
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
  pricesIrr: Record<string, number>;
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
  pricesIrr,
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
      if (asset && asset.layer && grouped[asset.layer]) {
        grouped[asset.layer].push(asset);
      }
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
                  // Prefer direct IRR price from backend, fallback to USD * fxRate
                  const pIrr = pricesIrr?.[asset.id];
                  const priceIRR = (pIrr && pIrr > 0) ? pIrr : priceUSD * fxRate;
                  const holding = holdings.find((h) => h.assetId === asset.id);
                  const isSelected = asset.id === currentAssetId;

                  // BUG-1 FIX: In SELL mode, show holding VALUE (matches Portfolio)
                  // In BUY mode, show price per unit
                  const isFixedIncome = asset.id === 'IRR_FIXED_INCOME';
                  const holdingValueIRR = holding ? getHoldingValueIRR(holding, prices, pricesIrr, fxRate) : 0;

                  // Display text based on mode
                  const displayValue = side === 'SELL' && holding
                    ? `${formatIRRCompact(holdingValueIRR)} IRR`  // Show VALUE for SELL
                    : isFixedIncome
                      ? 'Fixed 30% APR'  // Fixed Income has no price per unit
                      : `${formatIRRCompact(priceIRR)} IRR/unit`;  // Show price for BUY

                  return (
                    <TouchableOpacity
                      key={asset.id}
                      style={[styles.pickerAssetRow, isSelected && styles.pickerAssetRowSelected]}
                      onPress={() => onSelect(asset.id)}
                    >
                      <View style={styles.pickerAssetInfo}>
                        <Text style={styles.pickerAssetName}>{asset?.name || 'Unknown'}</Text>
                        <Text style={styles.pickerAssetPrice}>
                          {displayValue}
                        </Text>
                      </View>
                      {holding && holding.quantity > 0 && (
                        <Text style={styles.pickerHolding}>
                          {side === 'SELL'
                            ? `${holding.quantity.toFixed(isFixedIncome ? 0 : 4)} ${asset?.symbol || ''}`
                            : `You own: ${holding.quantity.toFixed(isFixedIncome ? 0 : 4)}`}
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
