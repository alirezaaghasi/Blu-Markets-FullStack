// Protection Tab - Part of Services Screen
// Based on UI Restructure Specification Section 3
// Updated to use API hooks for backend integration

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useProtections } from '../../hooks/useProtections';
import { Protection, AssetId } from '../../types';
import { ASSETS } from '../../constants/assets';
import { EmptyState } from '../../components/EmptyState';

interface ProtectionTabProps {
  protectionId?: string;
}

export function ProtectionTab({ protectionId }: ProtectionTabProps) {
  const {
    protections,
    eligibleAssets,
    isLoading,
    isRefreshing,
    error,
    refresh,
    quickPurchaseProtection,
    cancelProtection,
  } = useProtections();

  const hasProtections = protections.length > 0;

  if (isLoading && protections.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={COLORS.brand.primary}
        />
      }
    >
      {/* Active Protections */}
      {hasProtections && (
        <>
          <Text style={styles.sectionTitle}>Active Protections</Text>
          {protections.map((protection) => (
            <ProtectionCard
              key={protection.id}
              protection={protection}
              highlighted={protection.id === protectionId}
              onCancel={() => cancelProtection(protection.id)}
            />
          ))}
        </>
      )}

      {/* Eligible Assets - filter out zero-balance holdings */}
      <Text style={[styles.sectionTitle, hasProtections && { marginTop: SPACING[6] }]}>
        Protect Your Assets
      </Text>
      {eligibleAssets.filter(a => (a.quantity ?? 0) > 0).length > 0 ? (
        <EligibleAssetsGrid
          assets={eligibleAssets.filter(a => (a.quantity ?? 0) > 0)}
          onProtect={(holdingId) => quickPurchaseProtection(holdingId, 30)}
        />
      ) : (
        <EmptyState
          icon="shield-outline"
          title="No Assets to Protect"
          description="Add crypto holdings to your portfolio to enable downside protection"
          compact
        />
      )}

      {!hasProtections && eligibleAssets.length === 0 && (
        <EmptyState
          icon="shield-outline"
          title="Protect Your Portfolio"
          description="Guard against downside risk while keeping your upside potential"
        />
      )}
    </ScrollView>
  );
}

function ProtectionCard({
  protection,
  highlighted,
  onCancel,
}: {
  protection: Protection;
  highlighted: boolean;
  onCancel: () => void;
}) {
  const asset = ASSETS[protection.assetId];

  // Use backend-provided daysRemaining, with fallback calculation
  const expiryDate = protection.endISO || protection.expiryDate;
  const daysRemaining = protection.daysRemaining ?? (expiryDate ? Math.max(
    0,
    Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  ) : 0);

  // Determine status based on dates or backend status
  const isActive = protection.status === 'ACTIVE' || (expiryDate ? new Date(expiryDate).getTime() > Date.now() : false);

  return (
    <View style={[styles.protectionCard, highlighted && styles.protectionCardHighlighted]}>
      <View style={styles.protectionHeader}>
        <View style={styles.protectionAsset}>
          <Text style={styles.protectionAssetIcon}>{asset?.symbol || protection.assetId}</Text>
          <View>
            <Text style={styles.protectionAssetName}>
              {asset?.name || protection.assetId}
              <Text style={styles.protectionAssetSymbolInline}> | {asset?.symbol || ''}</Text>
            </Text>
          </View>
        </View>
        <View style={[
          styles.protectionStatus,
          !isActive && styles.protectionStatusExpired,
        ]}>
          <Text style={[
            styles.protectionStatusText,
            !isActive && styles.protectionStatusTextExpired,
          ]}>
            {isActive ? 'ACTIVE' : 'EXPIRED'}
          </Text>
        </View>
      </View>

      <View style={styles.protectionDetails}>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Protected Value</Text>
          <Text style={styles.protectionDetailValue}>
            {protection.notionalIRR?.toLocaleString() || '0'} IRR
          </Text>
        </View>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Premium Paid</Text>
          <Text style={styles.protectionDetailValue}>
            {protection.premiumIRR?.toLocaleString() || '0'} IRR
          </Text>
        </View>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Days Remaining</Text>
          <Text style={styles.protectionDetailValue}>{daysRemaining} days</Text>
        </View>
      </View>

      {/* Cancel functionality is disabled until backend supports it.
          Backend currently returns 501 NOT_IMPLEMENTED for cancellation.
          TODO: Re-enable when protection cancellation is implemented.
      {isActive && (
        <View style={styles.protectionActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel Protection</Text>
          </TouchableOpacity>
        </View>
      )}
      */}
    </View>
  );
}

function EligibleAssetsGrid({
  assets,
  onProtect,
}: {
  assets: Array<{
    holdingId?: string;
    assetId: AssetId;
    quantity?: number;
    valueIrr?: number;
    indicativePremium?: {
      thirtyDayPct: number;
      thirtyDayIrr: number;
    };
  }>;
  onProtect: (holdingId: string) => void;
}) {
  return (
    <View style={styles.eligibleGrid}>
      {assets.map((item) => {
        const asset = ASSETS[item.assetId];
        const quantity = item.quantity ?? 0;
        const premiumIrr = item.indicativePremium?.thirtyDayIrr ?? 0;
        // Use holdingId if available, otherwise skip items without it
        const holdingId = item.holdingId;
        if (!holdingId) return null;
        return (
          <View key={holdingId} style={styles.eligibleCard}>
            <Text style={styles.eligibleIcon}>{asset?.symbol || item.assetId}</Text>
            <Text style={styles.eligibleName}>
              {asset?.name || item.assetId}
              <Text style={styles.eligibleSymbol}> | {asset?.symbol || ''}</Text>
            </Text>
            <Text style={styles.eligibleQuantity}>
              {quantity.toFixed(4)} {asset?.symbol}
            </Text>
            <Text style={styles.eligiblePremium}>
              ~{premiumIrr.toLocaleString()} IRR/mo
            </Text>
            <TouchableOpacity
              style={styles.protectButton}
              onPress={() => onProtect(holdingId)}
            >
              <Text style={styles.protectButtonText}>Protect</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING[5],
    paddingBottom: SPACING[10],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[5],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.semantic.error,
    textAlign: 'center',
    marginBottom: SPACING[4],
  },
  retryButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    marginBottom: SPACING[3],
  },
  protectionCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[3],
  },
  protectionCardHighlighted: {
    borderWidth: 2,
    borderColor: COLORS.brand.primary,
  },
  protectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[4],
  },
  protectionAsset: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  protectionAssetIcon: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background.surface,
    width: 44,
    height: 44,
    textAlign: 'center',
    lineHeight: 44,
    borderRadius: 22,
    marginRight: SPACING[3],
    overflow: 'hidden',
  },
  protectionAssetName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  protectionAssetSymbolInline: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  protectionAssetSymbol: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  protectionStatus: {
    backgroundColor: `${COLORS.semantic.success}20`,
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm,
  },
  protectionStatusExpired: {
    backgroundColor: `${COLORS.text.muted}20`,
  },
  protectionStatusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.semantic.success,
  },
  protectionStatusTextExpired: {
    color: COLORS.text.muted,
  },
  protectionDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING[3],
    marginBottom: SPACING[3],
  },
  protectionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[2],
  },
  protectionDetailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  protectionDetailValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  protectionActions: {
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.semantic.error,
  },
  eligibleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING[3],
  },
  eligibleCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    width: '47%',
    alignItems: 'center',
  },
  eligibleIcon: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  eligibleName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  eligibleSymbol: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  eligibleQuantity: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING[1],
  },
  eligiblePremium: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginBottom: SPACING[3],
  },
  protectButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
  },
  protectButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.inverse,
  },
});

export default ProtectionTab;
