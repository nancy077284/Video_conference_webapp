import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { disconnectSocket, refreshSocketAuth } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearSession = useCallback(() => {
    api.clearToken();
    disconnectSocket();
    if (mountedRef.current) {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      if (!mountedRef.current) return;
      setUser(data.user || null);
      if (!data.user) clearSession();
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.status === 401) clearSession();
      else if (err?.status === 403) {
        clearSession();
        setSessionExpired(true);
      } else if (err?.code === 'NETWORK') {
        // keep the token, retry on next navigation
        setUser(null);
      } else {
        clearSession();
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Session expiry from any API call (any tab)
  useEffect(() => {
    const onExpired = () => {
      if (!api.getToken()) return;
      clearSession();
      setSessionExpired(true);
    };
    const onStorage = (e) => {
      if (e.key !== 'token') return;
      if (!e.newValue) {
        setUser(null);
        disconnectSocket();
      } else {
        bootstrap();
      }
    };
    window.addEventListener('auth:expired', onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:expired', onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, [clearSession, bootstrap]);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    api.setToken(data.token);
    refreshSocketAuth();
    setUser(data.user);
    setSessionExpired(false);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    api.setToken(data.token);
    refreshSocketAuth();
    setUser(data.user);
    setSessionExpired(false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    clearSession();
    setSessionExpired(false);
  }, [clearSession]);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = {
    user,
    loading,
    sessionExpired,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    updateUser,
    refreshUser: bootstrap,
    clearSession,
    dismissSessionExpired: () => setSessionExpired(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
