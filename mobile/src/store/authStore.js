/**
 * Redstring — Auth Store (Zustand)
 * ===================================
 * Global auth state + persisted token storage.
 */

import { create } from 'zustand';
import { storage } from '../services/storage';
import { apiClient } from '../services/apiClient';

export const useAuthStore = create((set, get) => ({
    user:       null,
    isLoggedIn: false,
    isLoading:  false,
    error:      null,

    // ── Boot: restore session from secure storage ──
    initAuth: async () => {
        try {
            const token = await storage.getItem('accessToken');
            const userRaw = await storage.getItem('user');
            if (token && userRaw) {
                const user = JSON.parse(userRaw);
                apiClient.setToken(token);
                set({ user, isLoggedIn: true });
            }
        } catch {
            set({ isLoggedIn: false });
        }
    },

    // ── Login ──────────────────────────────────────
    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const { user, accessToken, refreshToken } = await apiClient.post('/auth/login', { email, password });
            await storage.setItem('accessToken',  accessToken);
            await storage.setItem('refreshToken', refreshToken);
            await storage.setItem('user',         JSON.stringify(user));
            apiClient.setToken(accessToken);
            set({ user, isLoggedIn: true, isLoading: false });
        } catch (err) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    // ── Register ───────────────────────────────────
    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const { user, accessToken, refreshToken } = await apiClient.post('/auth/register', data);
            await storage.setItem('accessToken',  accessToken);
            await storage.setItem('refreshToken', refreshToken);
            await storage.setItem('user',         JSON.stringify(user));
            apiClient.setToken(accessToken);
            set({ user, isLoggedIn: true, isLoading: false });
        } catch (err) {
            set({ error: err.message, isLoading: false });
            throw err;
        }
    },

    // ── Logout ─────────────────────────────────────
    logout: async () => {
        try { await apiClient.post('/auth/logout'); } catch {}
        await storage.deleteItem('accessToken');
        await storage.deleteItem('refreshToken');
        await storage.deleteItem('user');
        apiClient.setToken(null);
        set({ user: null, isLoggedIn: false });
    },

    updateUser: (updates) => set(s => ({ user: { ...s.user, ...updates } })),
    clearError: ()        => set({ error: null }),
}));
