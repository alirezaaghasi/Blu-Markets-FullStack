// Protection Tab - Part of Services Screen
// Based on UI Restructure Specification Section 3

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { Protection } from '../../types';
import { ASSETS } from '../../constants/assets';

interface ProtectionTabProps {
  protectionId?: string;
}

export function ProtectionTab({ protectionId }: ProtectionTabProps) {
  const protections = useAppSelector((state) => state.portfolio.protections);
  const holdings = useAppSelector((state) => state.portfolio.holdings);
  const hasProtections = protections.length > 0;

  // Get eligible assets for protection (non-frozen, eligible per PRD)
  const eligibleHoldings = holdings.filter((h) => {
    const asset = ASSETS[h.assetId as keyof typeof ASSETS];
    return asset?.protectionEligible && !h.frozen;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Active Protections */}
      {hasProtections && (
        <>
          <Text style={styles.sectionTitle}>Active Protections</Text>
          {protections.map((protection) => (
            <ProtectionCard
              key={protection.id}
              protection={protection}
              highlighted={protection.id === protectionId}
            />
          ))}
        </>
      )}

      {/* Eligible Assets */}
      <Text style={[styles.sectionTitle, hasProtections && { marginTop: SPACING[6] }]}>
        Protect Your Assets
      </Text>
      {eligibleHoldings.length > 0 ? (
        <EligibleAssetsGrid holdings={eligibleHoldings} />
      ) : (
        <View style={styles.noEligible}>
          <Text style={styles.noEligibleText}>
            No eligible assets to protect. Add holdings to get started.
          </Text>
        </View>
      )}

      {!hasProtections && eligibleHoldings.length === 0 && (
        <ProtectionEmptyState />
      )}
    </ScrollView>
  );
}

function ProtectionCard({ protection, highlighted }: { protection: Protection; highlighted: boolean }) {
  const asset = ASSETS[protection.assetId];

  // Calculate days remaining from endISO
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(protection.endISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Determine status based on dates
  const isActive = new Date(protection.endISO).getTime() > Date.now();

  return (
    <View style={[styles.protectionCard, highlighted && styles.protectionCardHighlighted]}>
      <View style={styles.protectionHeader}>
        <View style={styles.protectionAsset}>
          <Text style={styles.protectionAssetIcon}>{asset?.symbol?.slice(0, 2) || '?'}</Text>
          <View>
            <Text style={styles.protectionAssetName}>{asset?.name || protection.assetId}</Text>
            <Text style={styles.protectionAssetSymbol}>{protection.assetId}</Text>
          </View>
        </View>
        <View style={styles.protectionStatus}>
          <Text style={styles.protectionStatusText}>{isActive ? 'ACTIVE' : 'EXPIRED'}</Text>
        </View>
      </View>

      <View style={styles.protectionDetails}>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Protected Value</Text>
          <Text style={styles.protectionDetailValue}>
            {protection.notionalIRR.toLocaleString()} IRR
          </Text>
        </View>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Premium Paid</Text>
          <Text style={styles.protectionDetailValue}>
            {protection.premiumIRR.toLocaleString()} IRR
          </Text>
        </View>
        <View style={styles.protectionDetailRow}>
          <Text style={styles.protectionDetailLabel}>Days Remaining</Text>
          <Text style={styles.protectionDetailValue}>{daysRemaining} days</Text>
        </View>
      </View>

      <View style={styles.protectionActions}>
        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel Protection</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EligibleAssetsGrid({ holdings }: { holdings: { assetId: string; quantity: number }[] }) {
  return (
    <View style={styles.eligibleGrid}>
      {holdings.map((holding) => {
        const asset = ASSETS[holding.assetId as keyof typeof ASSETS];
        return (
          <TouchableOpacity key={holding.assetId} style={styles.eligibleCard}>
            <Text style={styles.eligibleIcon}>{asset?.symbol?.slice(0, 2) || '?'}</Text>
            <Text style={styles.eligibleName}>{asset?.name || holding.assetId}</Text>
            <Text style={styles.eligibleQuantity}>
              {holding.quantity} {asset?.symbol}
            </Text>
            <TouchableOpacity style={styles.protectButton}>
              <Text style={styles.protectButtonText}>Protect</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ProtectionEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🛡️</Text>
      <Text style={styles.emptyTitle}>Protect Your Portfolio</Text>
      <Text style={styles.emptySubtitle}>
        Guard against downside risk while keeping your upside potential
      </Text>
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
  protectionStatusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.semantic.success,
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
  eligibleQuantity: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
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
  noEligible: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    alignItems: 'center',
  },
  noEligibleText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[8],
    marginTop: SPACING[10],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING[4],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});

export default ProtectionTab;
