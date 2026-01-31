/**
 * SuccessScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Redesigned to show actual portfolio holdings with asset breakdown
 * Changes:
 * - "You're all set!" title
 * - System attribution language
 * - USD equivalent display
 * - Full asset breakdown by layer
 * - Removed "First activity" card
 * - "View My Portfolio" CTA
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { initializePortfolio, logAction } from '../../store/slices/portfolioSlice';
import { resetOnboarding } from '../../store/slices/onboardingSlice';
import { completeOnboarding } from '../../store/slices/authSlice';
import { ASSETS, getAssetsByLayer } from '../../constants/assets';
import { DEFAULT_FX_RATE } from '../../constants/business';
import { ONBOARDING } from '../../constants/messages';
// BUG-021 FIX: Import prices selector to get actual fxRate

type SuccessScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Success'>;
};

// Layer configuration
const LAYER_CONFIG = {
  FOUNDATION: {
    color: COLORS.layers.foundation,
    label: 'Foundation',
    description: 'Stable assets for security',
  },
  GROWTH: {
    color: COLORS.layers.growth,
    label: 'Growth',
    description: 'Balanced growth potential',
  },
  UPSIDE: {
    color: COLORS.layers.upside,
    label: 'Upside',
    description: 'Higher risk, higher potential',
  },
} as const;

type LayerKey = keyof typeof LAYER_CONFIG;

// Format number with appropriate suffix
const formatValue = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

// Format USD amount
const formatUsd = (irrValue: number, fxRate: number): string => {
  const usd = irrValue / fxRate;
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(2)}M`;
  }
  if (usd >= 1_000) {
    return `$${(usd / 1_000).toFixed(1)}K`;
  }
  return `$${usd.toFixed(0)}`;
};

// Generate holdings based on allocation (for display when API doesn't return holdings)
// Shows ALL 15 assets distributed by layer weights per PRD
const generateDisplayHoldings = (
  totalInvestment: number,
  allocation: { FOUNDATION: number; GROWTH: number; UPSIDE: number }
) => {
  const holdings: Array<{
    assetId: string;
    name: string;
    symbol: string;
    valueIrr: number;
    layer: LayerKey;
  }> = [];

  // Helper to add assets from a layer using their weights
  const addLayerAssets = (layer: LayerKey, layerAmount: number) => {
    const assets = getAssetsByLayer(layer);
    if (assets.length === 0) return;

    // Normalize weights to sum to 1
    const totalWeight = assets.reduce((sum, a) => sum + a.layerWeight, 0);

    assets.forEach(asset => {
      const assetValue = layerAmount * (asset.layerWeight / totalWeight);
      holdings.push({
        assetId: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        valueIrr: assetValue,
        layer,
      });
    });
  };

  // Foundation: USDT (40%), PAXG (30%), IRR_FIXED_INCOME (30%)
  addLayerAssets('FOUNDATION', totalInvestment * allocation.FOUNDATION);

  // Growth: BTC (25%), ETH (20%), BNB (15%), XRP (10%), KAG (15%), QQQ (15%)
  addLayerAssets('GROWTH', totalInvestment * allocation.GROWTH);

  // Upside: SOL (20%), TON (18%), LINK (18%), AVAX (16%), MATIC (14%), ARB (14%)
  addLayerAssets('UPSIDE', totalInvestment * allocation.UPSIDE);

  return holdings;
};

// Confetti particle component (kept for celebration effect)
const ConfettiParticle: React.FC<{
  delay: number;
  color: string;
  startX: number;
}> = ({ delay, color, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 500,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() - 0.5) * 100,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    animation.start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          opacity,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
};

const SuccessScreen: React.FC<SuccessScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { riskProfile, initialInvestment } = useAppSelector(
    (state) => state.onboarding
  );
  // BUG-021 FIX: Use actual fxRate from prices slice, fallback to default
  const fxRate = useAppSelector((state) => state.prices.fxRate) || DEFAULT_FX_RATE;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
          duration: 400,
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
  }, []);

  const allocation = riskProfile?.targetAllocation || {
    FOUNDATION: 0.5,
    GROWTH: 0.35,
    UPSIDE: 0.15,
  };

  // Generate display holdings
  const holdings = generateDisplayHoldings(initialInvestment, allocation);

  // Group holdings by layer
  const groupedHoldings = {
    FOUNDATION: holdings.filter((h) => h.layer === 'FOUNDATION'),
    GROWTH: holdings.filter((h) => h.layer === 'GROWTH'),
    UPSIDE: holdings.filter((h) => h.layer === 'UPSIDE'),
  };

  // BUG-021 FIX: Calculate layer totals from display holdings
  // NOTE: These are UI-only values for the onboarding success animation
  // The actual portfolio will be created via backend API when user taps "View My Portfolio"
  // The holdings shown here are illustrative based on the backend-provided allocation percentages
  const layerTotals = {
    FOUNDATION: groupedHoldings.FOUNDATION.reduce((sum, h) => sum + h.valueIrr, 0),
    GROWTH: groupedHoldings.GROWTH.reduce((sum, h) => sum + h.valueIrr, 0),
    UPSIDE: groupedHoldings.UPSIDE.reduce((sum, h) => sum + h.valueIrr, 0),
  };

  const handleViewPortfolio = () => {
    // Initialize local portfolio state
    dispatch(
      initializePortfolio({
        cashIRR: initialInvestment,
        holdings: [],
        targetLayerPct: allocation,
        riskScore: riskProfile?.score,
        riskProfileName: riskProfile?.profileName,
      })
    );

    dispatch(
      logAction({
        type: 'PORTFOLIO_CREATED',
        boundary: 'SAFE',
        message: `Started with ${formatValue(initialInvestment)} IRR`,
        amountIRR: initialInvestment,
      })
    );

    dispatch(completeOnboarding());
    dispatch(resetOnboarding());
  };

  // Confetti particles
  const confettiColors = [
    COLORS.layers.foundation,
    COLORS.layers.growth,
    COLORS.layers.upside,
    COLORS.brand.primary,
    COLORS.semantic.success,
  ];

  const confettiParticles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length],
    startX: (i / 20) * 393 - 50,
    delay: Math.random() * 500,
  }));

  const renderLayerSection = (layerKey: LayerKey) => {
    const config = LAYER_CONFIG[layerKey];
    const layerHoldings = groupedHoldings[layerKey];
    const layerTotal = layerTotals[layerKey];
    const percentage = Math.round(allocation[layerKey] * 100);

    if (layerHoldings.length === 0) return null;

    return (
      <View style={styles.layerSection} key={layerKey}>
        {/* Layer Header */}
        <View style={styles.layerHeader}>
          <View style={styles.layerTitleRow}>
            <View style={[styles.layerDot, { backgroundColor: config.color }]} />
            <Text style={styles.layerTitle}>
              {config.label} ({percentage}%)
            </Text>
          </View>
          <Text style={[styles.layerTotal, { color: config.color }]}>
            {formatValue(layerTotal)} IRR
          </Text>
        </View>
        <Text style={styles.layerDescription}>{config.description}</Text>

        {/* Holdings List */}
        <View style={styles.holdingsCard}>
          {layerHoldings.map((holding, index) => {
            const isLast = index === layerHoldings.length - 1;

            return (
              <View
                key={holding.assetId}
                style={[
                  styles.holdingRow,
                  !isLast && styles.holdingRowBorder,
                ]}
              >
                <View style={styles.holdingInfo}>
                  <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                  <Text style={styles.holdingName}>{holding.name}</Text>
                </View>
                <Text style={styles.holdingValue}>
                  {formatValue(holding.valueIrr)} IRR
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Confetti */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiParticles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            color={particle.color}
            startX={particle.startX}
            delay={particle.delay}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.successIcon}>
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
        <Animated.View style={[styles.titleContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{ONBOARDING.success.title}</Text>
          <Text style={styles.subtitle}>
            Based on your answers, here's how the system allocated your investment:
          </Text>
        </Animated.View>

        {/* Total Investment Card */}
        <Animated.View style={[styles.totalCard, { opacity: fadeAnim }]}>
          <Text style={styles.totalLabel}>{ONBOARDING.success.invested.toUpperCase()}</Text>
          <Text style={styles.totalAmount}>
            {(initialInvestment || 0).toLocaleString()} IRR
          </Text>
          <Text style={styles.totalUsd}>
            ≈ {formatUsd(initialInvestment, fxRate)} USD
          </Text>

          {/* Allocation Bar */}
          <View style={styles.allocationBar}>
            <View
              style={[
                styles.barSegment,
                {
                  flex: allocation.FOUNDATION,
                  backgroundColor: LAYER_CONFIG.FOUNDATION.color,
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                {
                  flex: allocation.GROWTH,
                  backgroundColor: LAYER_CONFIG.GROWTH.color,
                },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                {
                  flex: allocation.UPSIDE,
                  backgroundColor: LAYER_CONFIG.UPSIDE.color,
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                },
              ]}
            />
          </View>
        </Animated.View>

        {/* Layer Sections with Holdings */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderLayerSection('FOUNDATION')}
          {renderLayerSection('GROWTH')}
          {renderLayerSection('UPSIDE')}
        </Animated.View>

        {/* Info Note */}
        <Animated.View style={[styles.infoCard, { opacity: fadeAnim }]}>
          <Text style={styles.infoIcon}>ⓘ</Text>
          <Text style={styles.infoText}>
            You can adjust your allocation or trade individual assets anytime from your portfolio.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewPortfolio}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{ONBOARDING.success.cta}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[6],
    paddingBottom: SPACING[4],
  },

  // Success Icon
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING[5],
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.semantic.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  checkmark: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Title
  titleContainer: {
    alignItems: 'center',
    marginBottom: SPACING[5],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING[2],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING[2],
  },

  // Total Card
  totalCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[5],
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 1,
    marginBottom: SPACING[2],
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalUsd: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginBottom: SPACING[4],
  },
  allocationBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },

  // Layer Section
  layerSection: {
    marginBottom: SPACING[4],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[1],
  },
  layerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING[2],
  },
  layerTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  layerTotal: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '700',
  },
  layerDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: 18,
    marginBottom: SPACING[2],
  },

  // Holdings Card
  holdingsCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
  },
  holdingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  holdingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holdingSymbol: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    width: 50,
  },
  holdingName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  holdingValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
    color: COLORS.text.primary,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.brand.primary}10`,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginTop: SPACING[2],
  },
  infoIcon: {
    fontSize: 16,
    color: COLORS.brand.primary,
    marginRight: SPACING[3],
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },

  // Footer
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[3],
    paddingBottom: LAYOUT.totalBottomSpace,
  },
  primaryButton: {
    backgroundColor: COLORS.brand.primary,
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
});

export default SuccessScreen;
