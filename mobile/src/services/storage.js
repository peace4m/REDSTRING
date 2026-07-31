/**
 * RedString — Cross-Platform Secure Storage
 * ============================================
 * On native (iOS/Android): uses expo-secure-store (encrypted keychain)
 * On web: uses localStorage (not encrypted, but functional for web)
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
    async getItem(key) {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return SecureStore.getItemAsync(key);
    },

    async setItem(key, value) {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
            return;
        }
        return SecureStore.setItemAsync(key, value);
    },

    async deleteItem(key) {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
            return;
        }
        return SecureStore.deleteItemAsync(key);
    },
};