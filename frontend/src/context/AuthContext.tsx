import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
  businessId: string | null;
  business?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<any>;
  logout: () => void;
  setupBusiness: (businessData: {
    name: string;
    gstin: string;
    address: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  }) => Promise<any>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    try {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        const res = await api.get('/auth/me');
        if (res.data && res.data.success) {
          setUser(res.data.data.user);
        } else {
          logout();
        }
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data && res.data.success) {
        const { accessToken, user: userData } = res.data.data;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        setUser(userData);
        // Sync API authorization header immediately
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        return res.data;
      }
      throw new Error(res.data.message || 'Login failed');
    } catch (err: any) {
      setLoading(false);
      throw err.response?.data || err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password, phone });
      if (res.data && res.data.success) {
        const { accessToken, user: userData } = res.data.data;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        setUser(userData);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        return res.data;
      }
      throw new Error(res.data.message || 'Registration failed');
    } catch (err: any) {
      setLoading(false);
      throw err.response?.data || err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const setupBusiness = async (businessData: {
    name: string;
    gstin: string;
    address: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  }) => {
    setLoading(true);
    try {
      const res = await api.post('/business/setup', businessData);
      if (res.data && res.data.success) {
        const { accessToken, user: userData } = res.data.data;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        setUser(userData);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        return res.data;
      }
      throw new Error(res.data.message || 'Business setup failed');
    } catch (err: any) {
      throw err.response?.data || err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        setupBusiness,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
