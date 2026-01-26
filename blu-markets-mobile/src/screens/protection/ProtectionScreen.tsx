// Protection Screen
// Based on PRD Section 9.3 - Protection Tab
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { Protection, AssetId, Holding } from '../../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../../constants/assets';
import { PROTECTION_PREMIUM_BY_LAYER } from '../../constants/business';
import { removeProtection } from '../../store/slices/portfolioSlice';
import ProtectionSheet from '../../components/ProtectionSheet';
import { EmptyState } from '../../components/EmptyState';
import { protection as protectionApi, ProtectionsResponse, EligibleAssetsResponse } from '../../services/api';

const ProtectionScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { holdings } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  const [showProtectionSheet, setShowProtectionSheet] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [showEducation, setShowEducation] = useState(true);

  // Backend data
  const [protections, setProtections] = useState<Protection[]>([]);
  // Use any[] type since getEligible may return different shapes
  const [eligibleAssets, setEligibleAssets] = useState<Array<{ assetId: AssetId; [key: string]: any }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from backend
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [protectionsRes, eligibleRes] = await Promise.all([
        protectionApi.getActive(),
        protectionApi.getEligible(),
      ]);
      // Handle both array and wrapped response formats
      setProtections(Array.isArray(protectionsRes) ? protectionsRes : (protectionsRes as any)?.protections || []);
      setEligibleAssets(eligibleRes?.assets || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load protection data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => fetchData(true);

  // Get eligible holdings for protection (combine local and backend data)
  // Filter out assets that already have active protections
  const protectedAssetIds = new Set(protections.map((p) => p.assetId));
  const eligibleHoldings = holdings.filter((h) => {
    const asset = ASSETS[h.assetId];
    const eligible = eligibleAssets.find((e) => e.assetId === h.assetId);
    return asset?.protectionEligible && eligible && !protectedAssetIds.has(h.assetId) && h.quantity > 0;
  });

  // Calculate days remaining for a protection
  const getDaysRemaining = (endISO: string): number => {
    const endDate = new Date(endISO);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Calculate progress percentage
  const getProgressPercentage = (startISO: string, endISO: string): number => {
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const now = Date.now();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  // Handle cancel protection
  const handleCancelProtection = (protection: Protection) => {
    Alert.alert(
      'Cancel Protection',
      `Are you sure you want to cancel protection for ${ASSETS[protection.assetId as keyof typeof ASSETS]?.name || protection.assetId}? The remaining premium will not be refunded.`,
      [
        { text: 'Keep Protection', style: 'cancel' },
        {
          text: 'Cancel Protection',
          style: 'destructive',
          onPress: async () => {
            try {
              await protectionApi.cancel(protection.id);
              dispatch(removeProtection(protection.id));
              // Refresh data
              fetchData();
              Alert.alert('Success', 'Protection cancelled successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel protection');
            }
          },
        },
      ]
    );
  };

  // Handle new protection
  const handleNewProtection = (holding: Holding) => {
    setSelectedHolding(holding);
    setShowProtectionSheet(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Protection</Text>
        <Text style={styles.subtitle}>
          Protect your assets against market downturns
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading protections...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Education Card (Collapsible) */}
        {showEducation && (
          <View style={styles.educationCard}>
            <View style={styles.educationHeader}>
              <Text style={styles.educationTitle}>How Protection Works</Text>
              <TouchableOpacity onPress={() => setShowEducation(false)}>
                <Text style={styles.educationClose}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.educationText}>
              Protection acts like insurance for your holdings. You pay a monthly premium
              based on the asset's layer, and if the price drops below your protection
              strike price during the coverage period, you're covered.
            </Text>
            <View style={styles.premiumRates}>
              <Text style={styles.premiumRatesTitle}>Premium Rates (Monthly)</Text>
              {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as const).map((layer) => (
                <View key={layer} style={styles.premiumRow}>
                  <View style={[styles.layerDot, { backgroundColor: LAYER_COLORS[layer] }]} />
                  <Text style={styles.premiumLabel}>{LAYER_NAMES[layer]}</Text>
                  <Text style={styles.premiumValue}>
                    {(PROTECTION_PREMIUM_BY_LAYER[layer] * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Active Protections */}
        {protections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Protections</Text>
            {protections.map((protection) => {
              const asset = ASSETS[protection.assetId as keyof typeof ASSETS];
              const startDate = protection.startISO || protection.startDate || new Date().toISOString();
              const endDate = protection.endISO || protection.expiryDate || new Date().toISOString();
              const daysRemaining = getDaysRemaining(endDate);
              const progress = getProgressPercentage(startDate, endDate);

              return (
                <View key={protection.id} style={styles.protectionCard}>
                  <View style={styles.protectionHeader}>
                    <View style={styles.protectionAsset}>
                      <View
                        style={[
                          styles.assetIcon,
                          { backgroundColor: asset ? `${LAYER_COLORS[asset.layer]}20` : colors.surfaceDark },
                        ]}
                      >
                        <Text style={styles.assetIconText}>
                          {asset?.symbol || protection.assetId}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.assetName}>
                          {asset?.name || protection.assetId}
                          <Text style={styles.assetSymbol}> | {asset?.symbol || ''}</Text>
                        </Text>
                      </View>
                    </View>
                    <View style={styles.protectionValue}>
                      <Text style={styles.protectionValueLabel}>Covered</Text>
                      <Text style={styles.protectionValueAmount}>
                        {(protection.notionalIRR ?? protection.notionalIrr ?? 0).toLocaleString()} IRR
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${progress}%` }]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {daysRemaining} days remaining
                    </Text>
                  </View>

                  {/* Premium Info */}
                  <View style={styles.premiumInfo}>
                    <Text style={styles.premiumInfoLabel}>Premium paid</Text>
                    <Text style={styles.premiumInfoValue}>
                      {(protection.premiumIRR ?? protection.premiumIrr ?? 0).toLocaleString()} IRR
                    </Text>
                  </View>

                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelProtection(protection)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel Protection</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Eligible Assets for Protection */}
        {eligibleHoldings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available to Protect</Text>
            {eligibleHoldings.map((holding) => {
              const asset = ASSETS[holding.assetId];
              const priceUSD = prices[holding.assetId] || 0;
              const valueIRR = holding.quantity * priceUSD * fxRate;

              return (
                <TouchableOpacity
                  key={holding.assetId}
                  style={styles.eligibleCard}
                  onPress={() => handleNewProtection(holding)}
                >
                  <View style={styles.eligibleAsset}>
                    <View
                      style={[
                        styles.assetIcon,
                        { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                      ]}
                    >
                      <Text style={styles.assetIconText}>
                        {asset.symbol}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.assetName}>
                        {asset.name}
                        <Text style={styles.assetSymbol}> | {asset.symbol}</Text>
                      </Text>
                      <Text style={styles.assetValue}>
                        {valueIRR.toLocaleString()} IRR
                      </Text>
                    </View>
                  </View>
                  <View style={styles.protectAction}>
                    <Text style={styles.protectActionText}>Protect</Text>
                    <Text style={styles.protectArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {protections.length === 0 && eligibleHoldings.length === 0 && (
          <EmptyState
            icon="shield-outline"
            title="No Active Protections"
            description={
              holdings.length === 0
                ? 'Add assets to your portfolio to protect them'
                : 'All your eligible assets are already protected'
            }
          />
        )}
      </ScrollView>
      )}

      {/* Protection Sheet */}
      {selectedHolding && (
        <ProtectionSheet
          visible={showProtectionSheet}
          onClose={() => {
            setShowProtectionSheet(false);
            setSelectedHolding(null);
          }}
          holding={selectedHolding}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  educationCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  educationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  educationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  educationClose: {
    fontSize: 24,
    color: colors.textSecondary,
    paddingHorizontal: spacing[2],
  },
  educationText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  premiumRates: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[3],
  },
  premiumRatesTitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  layerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  premiumLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
  },
  premiumValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  protectionCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  protectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  protectionAsset: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  assetIconText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  assetName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  assetSymbol: {
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  layerBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  layerBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  protectionValue: {
    alignItems: 'flex-end',
  },
  protectionValueLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  protectionValueAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  progressSection: {
    marginBottom: spacing[3],
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceDark,
    borderRadius: 3,
    marginBottom: spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  premiumInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    marginBottom: spacing[3],
  },
  premiumInfoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  premiumInfoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  cancelButton: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error,
  },
  eligibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  eligibleAsset: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  protectAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  protectActionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
    marginRight: spacing[1],
  },
  protectArrow: {
    fontSize: 20,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default ProtectionScreen;
