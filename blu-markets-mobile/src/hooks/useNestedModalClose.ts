/**
 * useNestedModalClose Hook
 *
 * Handles the common pattern of closing nested modals with a delay
 * to prevent visual glitches from simultaneous modal transitions.
 *
 * Problem: When closing an inner modal (e.g., success confirmation) and
 * immediately closing the outer modal (e.g., bottom sheet), the animations
 * can conflict causing visual artifacts.
 *
 * Solution: This hook provides a delayed close that:
 * 1. Closes the inner modal immediately
 * 2. Waits for the animation to complete (150ms default)
 * 3. Then closes the outer modal
 *
 * Usage:
 * ```typescript
 * const { handleSuccessClose, handleErrorClose } = useNestedModalClose({
 *   onClose,
 *   setShowSuccess: setShowSuccessModal,
 *   setShowError: setShowErrorModal,
 * });
 *
 * // In success modal:
 * <Button onPress={handleSuccessClose} />
 * ```
 */
import { useCallback, useRef, useEffect } from 'react';

interface UseNestedModalCloseOptions {
  /**
   * Function to close the outer/parent modal
   */
  onClose: () => void;

  /**
   * State setter for success modal visibility (optional)
   */
  setShowSuccess?: (visible: boolean) => void;

  /**
   * State setter for error modal visibility (optional)
   */
  setShowError?: (visible: boolean) => void;

  /**
   * Delay in ms before closing outer modal (default: 150)
   */
  delay?: number;
}

interface UseNestedModalCloseReturn {
  /**
   * Close success modal then outer modal with delay
   */
  handleSuccessClose: () => void;

  /**
   * Close error modal then outer modal with delay
   */
  handleErrorClose: () => void;

  /**
   * Generic close with custom inner modal setter
   */
  closeWithDelay: (setInnerVisible: (v: boolean) => void) => void;
}

export function useNestedModalClose({
  onClose,
  setShowSuccess,
  setShowError,
  delay = 150,
}: UseNestedModalCloseOptions): UseNestedModalCloseReturn {
  // Track pending timeouts for cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Generic close with delay
   */
  const closeWithDelay = useCallback(
    (setInnerVisible: (v: boolean) => void) => {
      // Close inner modal immediately
      setInnerVisible(false);

      // Schedule outer modal close after animation completes
      timeoutRef.current = setTimeout(() => {
        onClose();
      }, delay);
    },
    [onClose, delay]
  );

  /**
   * Close success modal then outer modal
   */
  const handleSuccessClose = useCallback(() => {
    if (setShowSuccess) {
      closeWithDelay(setShowSuccess);
    } else {
      // If no success setter provided, just close outer modal
      onClose();
    }
  }, [closeWithDelay, setShowSuccess, onClose]);

  /**
   * Close error modal then outer modal
   */
  const handleErrorClose = useCallback(() => {
    if (setShowError) {
      closeWithDelay(setShowError);
    } else {
      // If no error setter provided, just close outer modal
      onClose();
    }
  }, [closeWithDelay, setShowError, onClose]);

  return {
    handleSuccessClose,
    handleErrorClose,
    closeWithDelay,
  };
}

export default useNestedModalClose;
