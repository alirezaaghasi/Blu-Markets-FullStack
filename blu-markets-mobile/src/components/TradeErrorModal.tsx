/**
 * TradeErrorModal
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Error modal shown when trade fails
 * Shows: Error icon, message, and retry option
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYOUT } from '../constants/layout';
import { Button } from './common';
import { TRADE, BUTTONS } from '../constants/messages';

interface TradeErrorModalProps {
  /** Visibility state */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Retry handler */
  onRetry?: () => void;
  /** Error message */
  message: string;
  /** Error details (optional) */
  details?: string;
}

export const TradeErrorModal: React.FC<TradeErrorModalProps> = ({
  visible,
  onClose,
  onRetry,
  message,
  details,
}) => {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Error Icon */}
              <View style={styles.iconContainer}>
                <View style={styles.errorCircle}>
                  <Text style={styles.errorIcon}>!</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.title}>{TRADE.error.title}</Text>

              {/* Error Message */}
              <View style={styles.messageContainer}>
                <Text style={styles.message}>{message}</Text>
                {details && (
                  <Text style={styles.details}>{details}</Text>
                )}
              </View>

              {/* Helpful Tips */}
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Try these steps:</Text>
                <Text style={styles.tipItem}>• Check your internet connection</Text>
                <Text style={styles.tipItem}>• Verify you have sufficient balance</Text>
                <Text style={styles.tipItem}>• Wait a moment and try again</Text>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {onRetry && (
                  <Button
                    label={BUTTONS.tryAgain}
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={onRetry}
                  />
                )}
                <Button
                  label={BUTTONS.close}
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={onClose}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[4],
  },
  container: {
    width: '100%',
    maxWidth: LAYOUT.modalMaxWidth,
    backgroundColor: COLORS.background.elevated,
    borderRadius: LAYOUT.modalRadius,
    padding: LAYOUT.modalPadding,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: SPACING[4],
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.semantic.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.semantic.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  errorIcon: {
    fontSize: 48,
    color: COLORS.text.inverse,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING[3],
  },
  messageContainer: {
    width: '100%',
    backgroundColor: COLORS.semanticBg.error,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.semantic.error,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  details: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginTop: SPACING[2],
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[5],
  },
  tipsTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
  },
  tipItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  actions: {
    width: '100%',
    gap: SPACING[3],
  },
});

export default TradeErrorModal;
