/**
 * Redstring — API Client
 * ========================
 * Thin wrapper over fetch with:
 *  - Auto-prepend of base URL
 *  - JWT Bearer token injection
 *  - Automatic token refresh on 401
 *  - Consistent error format
 */

import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiClient {
    constructor() {
        this.token = null;
        this.refreshing = false;
    }

    setToken(token) { this.token = token; }

    async request(method, path, body) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        };

        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        // Auto-refresh on 401
        if (res.status === 401 && !this.refreshing) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                headers.Authorization = `Bearer ${this.token}`;
                const retry = await fetch(`${BASE_URL}${path}`, {
                    method, headers,
                    ...(body ? { body: JSON.stringify(body) } : {}),
                });
                return this.parseResponse(retry);
            }
        }

        return this.parseResponse(res);
    }

    async parseResponse(res) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.data   = data;
            throw err;
        }
        return data;
    }

    async refreshToken() {
        try {
            this.refreshing = true;
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!refreshToken) return false;

            const res = await fetch(`${BASE_URL}/auth/refresh`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ refreshToken }),
            });
            const data = await res.json();
            if (!res.ok) return false;

            await SecureStore.setItemAsync('accessToken', data.accessToken);
            await SecureStore.setItemAsync('refreshToken', data.refreshToken);
            this.token = data.accessToken;
            return true;
        } catch { return false; }
        finally { this.refreshing = false; }
    }

    get(path)          { return this.request('GET',    path); }
    post(path, body)   { return this.request('POST',   path, body); }
    patch(path, body)  { return this.request('PATCH',  path, body); }
    delete(path)       { return this.request('DELETE', path); }
}

export const apiClient = new ApiClient();