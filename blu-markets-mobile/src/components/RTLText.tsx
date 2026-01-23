// RTL-Aware Text Component
// Automatically detects Persian/Arabic text and applies RTL styling

import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface RTLTextProps extends TextProps {
  children: React.ReactNode;
  forceRTL?: boolean;
}

/**
 * Helper to detect Persian/Arabic characters in text
 */
export function containsPersian(text: React.ReactNode): boolean {
  if (typeof text !== 'string') return false;
  // Persian/Arabic Unicode ranges
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Text component that automatically applies RTL styling for Persian/Arabic text
 */
export function RTLText({ children, style, forceRTL = false, ...props }: RTLTextProps) {
  const isRTL = forceRTL || containsPersian(children);

  return (
    <Text
      {...props}
      style={[
        isRTL && styles.rtlText,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default RTLText;
