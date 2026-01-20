// Biometric Authentication Hook
// Based on PRD Section 13 - Security & Compliance
import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';
const AUTH_TOKEN_KEY = 'auth_token_secure';

interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

export const useBiometricAuth = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        // Check if hardware is available
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          setIsAvailable(false);
          setIsChecking(false);
          return;
        }

        // Check if enrolled
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsAvailable(isEnrolled);

        // Get supported types
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris');
        }

        // Check if user has enabled biometric auth
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        setIsEnabled(enabled === 'true');

        setIsChecking(false);
      } catch (error) {
        console.error('Failed to check biometric availability:', error);
        setIsAvailable(false);
        setIsChecking(false);
      }
    };

    checkBiometric();
  }, []);

  // Authenticate using biometrics
  const authenticate = useCallback(async (): Promise<BiometricAuthResult> => {
    if (!isAvailable) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Blu Markets',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error === 'user_cancel' ? 'Authentication cancelled' : 'Authentication failed',
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: 'Authentication error' };
    }
  }, [isAvailable]);

  // Enable biometric authentication
  const enableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      // First authenticate to confirm user identity
      const authResult = await authenticate();
      if (!authResult.success) {
        return false;
      }

      // Store preference
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  }, [authenticate]);

  // Disable biometric authentication
  const disableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(false);
      return true;
    } catch (error) {
      console.error('Failed to disable biometric:', error);
      return false;
    }
  }, []);

  // Store auth token securely
  const storeAuthToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      return true;
    } catch (error) {
      console.error('Failed to store auth token:', error);
      return false;
    }
  }, []);

  // Retrieve auth token (requires biometric if enabled)
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      // If biometric is enabled, require authentication first
      if (isEnabled) {
        const authResult = await authenticate();
        if (!authResult.success) {
          return null;
        }
      }

      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }, [isEnabled, authenticate]);

  // Clear auth token
  const clearAuthToken = useCallback(async (): Promise<boolean> => {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear auth token:', error);
      return false;
    }
  }, []);

  return {
    isAvailable,
    isEnabled,
    biometricType,
    isChecking,
    authenticate,
    enableBiometric,
    disableBiometric,
    storeAuthToken,
    getAuthToken,
    clearAuthToken,
  };
};

export default useBiometricAuth;
