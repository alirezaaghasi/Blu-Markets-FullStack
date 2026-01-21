// Market Screen
// Based on CLAUDE_CODE_HANDOFF.md - Asset browser
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { ASSETS } from '../../constants/assets';
import { Layer } from '../../types';

// Layer filter options
const LAYER_FILTERS: Array<{ key: 'ALL' | Layer; label: string; color?: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'FOUNDATION', label: 'Foundation', color: COLORS.layers.foundation },
  { key: 'GROWTH', label: 'Growth', color: COLORS.layers.growth },
  { key: 'UPSIDE', label: 'Upside', color: COLORS.layers.upside },
];

// Asset icon mapping
const ASSET_ICONS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '$',
  BNB: '◈',
  XRP: '✕',
  SOL: '◎',
  TON: '💎',
  LINK: '⬡',
  AVAX: '△',
  MATIC: '⬡',
  ARB: '🔵',
  PAXG: '🥇',
  KAG: '🥈',
  QQQ: '📈',
  IRR_FIXED_INCOME: '💵',
};

const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return price.toFixed(4);
};

const formatChange = (change: number | undefined): string => {
  if (change === undefined) return '--';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
};

const MarketScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<'ALL' | Layer>('ALL');

  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Get all assets with their data
  const assetsWithPrices = Object.values(ASSETS).map((asset) => ({
    ...asset,
    priceUSD: prices[asset.id] || 0,
    priceIRR: (prices[asset.id] || 0) * fxRate,
    change24h: undefined, // TODO: Get from API
  }));

  // Filter assets
  const filteredAssets = assetsWithPrices.filter((asset) => {
    const matchesSearch =
      searchQuery === '' ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLayer =
      selectedLayer === 'ALL' || asset.layer === selectedLayer;

    return matchesSearch && matchesLayer;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest prices
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Market</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search assets..."
          placeholderTextColor={COLORS.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Layer Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {LAYER_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              selectedLayer === filter.key && styles.filterChipActive,
              filter.color && selectedLayer === filter.key && { backgroundColor: filter.color },
            ]}
            onPress={() => setSelectedLayer(filter.key as 'ALL' | Layer)}
          >
            <Text
              style={[
                styles.filterText,
                selectedLayer === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Asset List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {filteredAssets.map((asset) => (
          <TouchableOpacity
            key={asset.id}
            style={styles.assetRow}
            activeOpacity={0.7}
          >
            <View style={styles.assetLeft}>
              <View style={styles.assetIcon}>
                <Text style={styles.assetIconText}>{ASSET_ICONS[asset.id] || asset.symbol.charAt(0)}</Text>
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <View style={styles.assetMeta}>
                  <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                  <View
                    style={[
                      styles.layerBadge,
                      { backgroundColor: COLORS.layers[asset.layer.toLowerCase() as keyof typeof COLORS.layers] + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.layerBadgeText,
                        { color: COLORS.layers[asset.layer.toLowerCase() as keyof typeof COLORS.layers] },
                      ]}
                    >
                      {asset.layer}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.assetRight}>
              <Text style={styles.assetPrice}>${formatPrice(asset.priceUSD)}</Text>
              <Text
                style={[
                  styles.assetChange,
                  asset.change24h && asset.change24h >= 0
                    ? styles.changePositive
                    : styles.changeNegative,
                ]}
              >
                {formatChange(asset.change24h)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {filteredAssets.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No assets found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[4],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  searchContainer: {
    paddingHorizontal: SPACING[4],
    marginBottom: SPACING[3],
  },
  searchInput: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filtersContainer: {
    marginBottom: SPACING[4],
  },
  filtersContent: {
    paddingHorizontal: SPACING[4],
    gap: SPACING[2],
  },
  filterChip: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background.surface,
    marginRight: SPACING[2],
  },
  filterChipActive: {
    backgroundColor: COLORS.brand.primary,
  },
  filterText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterTextActive: {
    color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING[4],
    paddingBottom: 100,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.md,
    padding: SPACING[4],
    marginBottom: SPACING[2],
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  assetIconText: {
    fontSize: 20,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  assetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetSymbol: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginRight: SPACING[2],
  },
  layerBadge: {
    paddingHorizontal: SPACING[2],
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  layerBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  assetChange: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  changePositive: {
    color: COLORS.semantic.success,
  },
  changeNegative: {
    color: COLORS.semantic.error,
  },
  emptyState: {
    paddingVertical: SPACING[10],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.muted,
  },
});

export default MarketScreen;
