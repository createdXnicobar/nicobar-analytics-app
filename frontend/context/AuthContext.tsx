import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const LOGIN_URL = 'https://bronco.nicobar.com/api/storeUserLogin';
const USER_AUTH_URL = 'https://bronco.nicobar.com/api/userAuth';

export type AuthUser = {
  fullName: string;
  storeCode: string;
  email: string;
};

export type LoginResult = { ok: boolean; message?: string };

export type AuthContextType = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        if (storedToken && storedUser) {
          // Optionally verify auth on startup
          const verified = await verifyUserAuth(storedToken);
          if (verified) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
          }
        }
      } catch (e) {
        console.log('[Auth] restore error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const verifyUserAuth = useCallback(async (authToken: string): Promise<boolean> => {
    try {
      console.log('[Auth] GET', USER_AUTH_URL);
      const res = await fetch(USER_AUTH_URL, {
        method: 'GET',
        headers: { 'X-Auth-Token': authToken },
      });
      const json = await res.json();
      console.log('[Auth] userAuth response:', json);
      if (json?.status !== true) return false; // service error
      return json?.userAuth === true;
    } catch (e) {
      console.log('[Auth] userAuth error', e);
      return false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      setLoading(true);
      console.log('[Auth] POST', LOGIN_URL, { email });
      console.log("password", password);
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      console.log('[Auth] login response:', json);

      if (json?.status !== true) {
        return { ok: false, message: json?.message || 'Login failed' };
      }

      const authToken: string | undefined = json?.data?.token;
      const storeCode: string | undefined = json?.data?.storeCode;
      const fullName: string | undefined = json?.data?.fullName;
      if (!authToken) return { ok: false, message: 'Missing token' };

      const verified = await verifyUserAuth(authToken);
      if (!verified) return { ok: false, message: 'User not authorised' };

      const authUser: AuthUser = {
        fullName: fullName || email,
        storeCode: storeCode || '',
        email,
      };

      setToken(authToken);
      setUser(authUser);
      await SecureStore.setItemAsync(TOKEN_KEY, authToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser));
      return { ok: true };
    } catch (e) {
      console.log('[Auth] login error', e);
      return { ok: false, message: 'Network or server error' };
    } finally {
      setLoading(false);
    }
  }, [verifyUserAuth]);

  const logout = useCallback(async () => {
    try {
      setToken(null);
      setUser(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {
      console.log('[Auth] logout error', e);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated: !!token,
    user,
    loading,
    login,
    logout,
  }), [token, user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // graceful fallback if provider not yet mounted
    return {
      isAuthenticated: false,
      user: null,
      loading: false,
      login: async () => ({ ok: false, message: 'Auth not initialised' }),
      logout: async () => {},
    } as AuthContextType;
  }
  return ctx;
};
