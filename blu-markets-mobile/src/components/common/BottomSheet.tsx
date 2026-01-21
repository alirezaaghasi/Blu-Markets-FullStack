/**
 * BottomSheet Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Uses @gorhom/bottom-sheet library
 * Snap points: ['50%', '90%']
 * Background: #151C28
 * Handle: #6B7280, 36pt wide, 4pt tall
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';

interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Snap points (default: ['50%', '90%']) */
  snapPoints?: (string | number)[];
  /** Sheet content */
  children: React.ReactNode;
  /** Optional title in header */
  title?: string;
  /** Show drag handle indicator */
  showHandle?: boolean;
  /** Enable scrollable content */
  scrollable?: boolean;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Enable keyboard avoiding behavior */
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
}

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(
  (
    {
      isOpen,
      onClose,
      snapPoints: customSnapPoints,
      children,
      title,
      showHandle = true,
      scrollable = false,
      showCloseButton = false,
      keyboardBehavior = 'interactive',
    },
    ref
  ) => {
    // Default snap points per spec
    const snapPoints = useMemo(
      () => customSnapPoints || ['50%', '90%'],
      [customSnapPoints]
    );

    // Handle sheet changes
    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) {
          Keyboard.dismiss();
          onClose();
        }
      },
      [onClose]
    );

    // Custom backdrop
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      []
    );

    // Custom handle
    const renderHandle = useCallback(
      () => (
        <View style={styles.handleContainer}>
          {showHandle && <View style={styles.handle} />}
        </View>
      ),
      [showHandle]
    );

    // Don't render if not open
    if (!isOpen) {
      return null;
    }

    const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
      <GorhomBottomSheet
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        handleComponent={renderHandle}
        backgroundStyle={styles.background}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
      >
        {/* Header with title */}
        {(title || showCloseButton) && (
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              {title && <Text style={styles.headerTitle}>{title}</Text>}
            </View>
            {showCloseButton && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        <ContentWrapper style={styles.content}>{children}</ContentWrapper>
      </GorhomBottomSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';

const styles = StyleSheet.create({
  background: {
    backgroundColor: COLORS.background.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: SPACING[2],
    paddingBottom: SPACING[1],
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.text.muted,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[2],
    paddingBottom: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: SPACING[4],
    padding: SPACING[1],
  },
  closeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.muted,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[4],
    paddingBottom: LAYOUT.totalBottomSpace,
  },
});

export default BottomSheet;
