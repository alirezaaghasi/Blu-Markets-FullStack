// Trade Bottom Sheet Component
// Based on PRD Section 9.2 - Trade Bottom Sheet
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
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { AssetId, Boundary, Holding, TradePreview } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { MIN_TRADE_AMOUNT, SPREAD_BY_LAYER } from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { executeTrade } from '../store/slices/portfolioSlice';
import {
  validateBuyTrade,
  validateSellTrade,
  generateTradePreview,
} from '../utils/tradeValidation';
import AllocationBar from './AllocationBar';

interface TradeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  initialAssetId?: AssetId;
  initialSide?: 'BUY' | 'SELL';
}

// Quick amount chips as percentages
const QUICK_AMOUNTS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.50 },
  { label: '75%', value: 0.75 },
  { label: 'Max', value: 1.0 },
];

// Boundary indicator colors
const BOUNDARY_COLORS: Record<Boundary, string> = {
  SAFE: colors.boundarySafe,
  DRIFT: colors.boundaryDrift,
  STRUCTURAL: colors.boundaryStructural,
  STRESS: colors.boundaryStress,
};

export const TradeBottomSheet: React.FC<TradeBottomSheetProps> = ({
  visible,
  onClose,
  initialAssetId = 'BTC',
  initialSide = 'BUY',
}) => {
  const dispatch = useAppDispatch();
  const { holdings, cashIRR, targetLayerPct } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [assetId, setAssetId] = useState<AssetId>(initialAssetId);
  const [amountInput, setAmountInput] = useState('');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const asset = ASSETS[assetId];
  const priceUSD = prices[assetId] || 0;
  const priceIRR = priceUSD * fxRate;

  // Find holding for selected asset
  const holding = holdings.find((h) => h.assetId === assetId);
  const holdingValue = holding ? holding.quantity * priceIRR : 0;

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

  // Available balance for current side
  const availableBalance = side === 'BUY' ? cashIRR : holdingValue;

  // Validate trade
  const validation = useMemo(() => {
    if (side === 'BUY') {
      return validateBuyTrade(amountIRR, cashIRR, assetId);
    } else {
      return validateSellTrade(amountIRR, holding, holdingValue);
    }
  }, [side, amountIRR, cashIRR, assetId, holding, holdingValue]);

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

  // Handle trade confirmation
  const handleConfirm = async () => {
    if (!validation.ok || !preview) return;

    // Show warning for non-SAFE boundaries
    if (preview.boundary !== 'SAFE') {
      Alert.alert(
        preview.boundary === 'STRESS' ? 'High Risk Trade' : 'Trade Warning',
        preview.frictionCopy.join('\n\n'),
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed',
            style: preview.boundary === 'STRESS' ? 'destructive' : 'default',
            onPress: executeTradeFn,
          },
        ]
      );
    } else {
      executeTradeFn();
    }
  };

  const executeTradeFn = async () => {
    setIsSubmitting(true);
    try {
      dispatch(executeTrade({
        side,
        assetId,
        amountIRR,
        priceUSD,
        fxRate,
      }));
      onClose();
      setAmountInput('');
    } catch (error) {
      Alert.alert('Error', 'Failed to execute trade. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                placeholderTextColor={colors.textSecondary}
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

          {/* Confirm Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                side === 'SELL' && styles.confirmButtonSell,
                (!validation.ok || isSubmitting) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!validation.ok || isSubmitting}
            >
              <Text style={styles.confirmButtonText}>
                {isSubmitting ? 'Processing...' : `Confirm ${side === 'BUY' ? 'Buy' : 'Sell'}`}
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
    backgroundColor: colors.bgDark,
  },
  keyboardView: {
    flex: 1,
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
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
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
  assetPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  assetArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[1],
    marginBottom: spacing[4],
  },
  sideButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  sideButtonActive: {
    backgroundColor: colors.success,
  },
  sideButtonActiveSell: {
    backgroundColor: colors.error,
  },
  sideButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  sideButtonTextActive: {
    color: colors.textPrimaryDark,
  },
  amountSection: {
    marginBottom: spacing[4],
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  amountInput: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
  },
  availableText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  quickChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  quickChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  previewSection: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  previewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[4],
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  previewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  previewValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  allocationPreview: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  allocationLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[3],
  },
  allocationBars: {
    gap: spacing[2],
  },
  allocationBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  allocationBarLabel: {
    width: 50,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  boundaryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.default,
    marginTop: spacing[4],
  },
  boundaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  boundaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  frictionCopy: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.default,
  },
  frictionText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    marginBottom: spacing[1],
  },
  errorSection: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginBottom: spacing[1],
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
    padding: spacing[4],
    alignItems: 'center',
  },
  confirmButtonSell: {
    backgroundColor: colors.error,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  // Asset Picker Styles
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  pickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  pickerClose: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  pickerScrollView: {
    flex: 1,
  },
  pickerLayerSection: {
    padding: spacing[4],
  },
  pickerLayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  pickerLayerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
  },
  pickerLayerName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  pickerAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  pickerAssetRowSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pickerAssetInfo: {
    flex: 1,
  },
  pickerAssetName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  pickerAssetPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pickerHolding: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing[2],
  },
  pickerCheckmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  pickerEmptyState: {
    alignItems: 'center',
    padding: spacing[8],
  },
  pickerEmptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
  },
  pickerEmptySubtext: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default TradeBottomSheet;
