/**
 * Modal Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Centered modal with overlay
 * Overlay: rgba(0,0,0,0.5)
 * Background: #1C2433
 * Border radius: 24px
 * Max width: 343pt
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button } from './Button';

interface ModalAction {
  /** Button label */
  label: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Press handler */
  onPress: () => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

interface ModalProps {
  /** Visibility state */
  visible: boolean;
  /** Close handler (called on backdrop press if dismissable) */
  onClose: () => void;
  /** Back handler for multi-step modals (UX-004) */
  onBack?: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children?: React.ReactNode;
  /** Action buttons */
  actions?: ModalAction[];
  /** Allow dismissing by tapping backdrop */
  dismissable?: boolean;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Icon or emoji to show above title */
  icon?: React.ReactNode;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  onBack,
  title,
  children,
  actions = [],
  dismissable = true,
  showCloseButton = false,
  icon,
  style,
  testID,
}) => {
  const handleBackdropPress = () => {
    if (dismissable) {
      onClose();
    }
  };

  return (
    <RNModal
      testID={testID}
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.container, style]}>
              {/* UX-004: Back button for multi-step modals */}
              {onBack && (
                <TouchableOpacity
                  onPress={onBack}
                  style={styles.backButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.backButtonText}>‹</Text>
                </TouchableOpacity>
              )}
              {/* Close button */}
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}

              {/* Icon */}
              {icon && <View style={styles.iconContainer}>{icon}</View>}

              {/* Title */}
              {title && <Text style={styles.title}>{title}</Text>}

              {/* Content */}
              {children && <View style={styles.content}>{children}</View>}

              {/* Actions */}
              {actions.length > 0 && (
                <View style={styles.actions}>
                  {actions.map((action, index) => (
                    <Button
                      key={index}
                      label={action.label}
                      variant={action.variant || 'primary'}
                      onPress={action.onPress}
                      loading={action.loading}
                      disabled={action.disabled}
                      fullWidth
                    />
                  ))}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

// Convenience components for common modal types

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
}) => (
  <Modal
    visible={visible}
    onClose={onClose}
    title={title}
    dismissable={!loading}
    actions={[
      {
        label: confirmLabel,
        variant: confirmVariant,
        onPress: onConfirm,
        loading,
      },
      {
        label: cancelLabel,
        variant: 'secondary',
        onPress: onClose,
        disabled: loading,
      },
    ]}
  >
    <Text style={styles.message}>{message}</Text>
  </Modal>
);

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttonLabel?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  onClose,
  title = 'Success',
  message,
  buttonLabel = 'Done',
}) => (
  <Modal
    visible={visible}
    onClose={onClose}
    title={title}
    icon={<Text style={styles.successIcon}>✓</Text>}
    actions={[
      {
        label: buttonLabel,
        variant: 'primary',
        onPress: onClose,
      },
    ]}
  >
    <Text style={styles.message}>{message}</Text>
  </Modal>
);

interface ErrorModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttonLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  onClose,
  title = 'Error',
  message,
  buttonLabel = 'Close',
  onRetry,
  retryLabel = 'Try Again',
}) => {
  const actions: ModalAction[] = onRetry
    ? [
        { label: retryLabel, variant: 'primary', onPress: onRetry },
        { label: buttonLabel, variant: 'secondary', onPress: onClose },
      ]
    : [{ label: buttonLabel, variant: 'secondary', onPress: onClose }];

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      icon={<Text style={styles.errorIcon}>!</Text>}
      actions={actions}
    >
      <Text style={styles.message}>{message}</Text>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: (393 - LAYOUT.modalMaxWidth) / 2, // 25pt on each side
  },
  container: {
    width: LAYOUT.modalMaxWidth,
    maxHeight: 600,
    backgroundColor: COLORS.background.elevated,
    borderRadius: LAYOUT.modalRadius,
    overflow: 'hidden',
    padding: LAYOUT.modalPadding,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING[4],
    right: SPACING[4],
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.muted,
  },
  // UX-004: Back button styles
  backButton: {
    position: 'absolute',
    top: SPACING[4],
    left: SPACING[4],
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text.muted,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING[4],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING[3],
  },
  content: {
    marginBottom: SPACING[5],
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  actions: {
    gap: SPACING[3],
  },
  successIcon: {
    fontSize: 48,
    color: COLORS.semantic.success,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    color: COLORS.semantic.error,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});

export default Modal;
