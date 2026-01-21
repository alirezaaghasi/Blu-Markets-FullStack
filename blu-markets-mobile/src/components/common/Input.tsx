/**
 * Input Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Variants: text, phone, otp, amount, search
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type InputVariant = 'text' | 'phone' | 'search';

interface BaseInputProps {
  /** Input value */
  value: string;
  /** Change handler */
  onChangeText: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Auto focus */
  autoFocus?: boolean;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

interface TextInputComponentProps extends BaseInputProps {
  variant?: 'text' | 'search';
  /** Left icon component */
  leftIcon?: React.ReactNode;
  /** Right icon component */
  rightIcon?: React.ReactNode;
  /** Keyboard type */
  keyboardType?: TextInputProps['keyboardType'];
  /** Return key type */
  returnKeyType?: TextInputProps['returnKeyType'];
  /** On submit handler */
  onSubmitEditing?: () => void;
  /** Max length */
  maxLength?: number;
  /** Secure text entry */
  secureTextEntry?: boolean;
}

interface PhoneInputProps extends BaseInputProps {
  variant: 'phone';
  /** Country code prefix (default: +98) */
  prefix?: string;
}

interface OTPInputProps {
  /** Number of digits */
  length?: number;
  /** Current value */
  value: string;
  /** Change handler */
  onChangeText: (value: string) => void;
  /** Called when all digits entered */
  onComplete?: (value: string) => void;
  /** Error message */
  error?: string;
  /** Auto focus */
  autoFocus?: boolean;
  /** Test ID */
  testID?: string;
}

type InputProps = TextInputComponentProps | PhoneInputProps;

// Standard Text/Search Input
export const Input: React.FC<InputProps> = (props) => {
  const [isFocused, setIsFocused] = useState(false);

  if (props.variant === 'phone') {
    return <PhoneInput {...props} />;
  }

  const {
    value,
    onChangeText,
    placeholder,
    error,
    disabled,
    autoFocus,
    style,
    testID,
    leftIcon,
    rightIcon,
    keyboardType,
    returnKeyType,
    onSubmitEditing,
    maxLength,
    secureTextEntry,
    variant = 'text',
  } = props as TextInputComponentProps;

  const getBorderColor = () => {
    if (error) return COLORS.semantic.error;
    if (isFocused) return COLORS.brand.primary;
    return 'transparent';
  };

  return (
    <View style={style}>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.muted}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            rightIcon ? styles.inputWithRightIcon : null,
          ]}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// Phone Input with Country Prefix
const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  placeholder = '912 345 6789',
  error,
  disabled,
  autoFocus,
  style,
  testID,
  prefix = '+98',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return COLORS.semantic.error;
    if (isFocused) return COLORS.brand.primary;
    return 'transparent';
  };

  // Format phone number with spaces
  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  return (
    <View style={style}>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.phonePrefix}>
          <Text style={styles.phonePrefixText}>{prefix}</Text>
        </View>
        <View style={styles.phoneDivider} />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(text) => onChangeText(formatPhone(text))}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.muted}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="phone-pad"
          maxLength={10}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.phoneInput}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// OTP Input (6 digit boxes)
export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChangeText,
  onComplete,
  error,
  autoFocus = true,
  testID,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (value.length === length && onComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete(value);
    } else if (value.length < length) {
      hasCompletedRef.current = false;
    }
  }, [value, length, onComplete]);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
  };

  const getBorderColor = (index: number) => {
    if (error) return COLORS.semantic.error;
    if (isFocused && index === value.length) return COLORS.brand.primary;
    if (value[index]) return COLORS.border;
    return 'transparent';
  };

  return (
    <View>
      <TouchableOpacity
        testID={testID}
        onPress={handlePress}
        activeOpacity={1}
        style={styles.otpContainer}
      >
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.otpBox,
              {
                borderColor: getBorderColor(index),
              },
            ]}
          >
            <Text style={styles.otpDigit}>{value[index] || ''}</Text>
          </View>
        ))}
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
      />
      {error && <Text style={[styles.errorText, styles.otpError]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  // Standard Input
  inputContainer: {
    height: 52,
    backgroundColor: COLORS.background.input,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
  },
  input: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.md,
    height: '100%',
  },
  inputWithLeftIcon: {
    marginLeft: SPACING[2],
  },
  inputWithRightIcon: {
    marginRight: SPACING[2],
  },
  iconLeft: {
    marginRight: SPACING[2],
  },
  iconRight: {
    marginLeft: SPACING[2],
  },
  errorText: {
    color: COLORS.semantic.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING[1],
  },

  // Phone Input
  phonePrefix: {
    paddingRight: SPACING[3],
  },
  phonePrefixText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    marginRight: SPACING[3],
  },
  phoneInput: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.md,
    height: '100%',
  },

  // OTP Input
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING[2],
  },
  otpBox: {
    width: 48,
    height: 56,
    backgroundColor: COLORS.background.input,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    color: COLORS.text.primary,
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  otpError: {
    textAlign: 'center',
    marginTop: SPACING[3],
  },
});

export default Input;
