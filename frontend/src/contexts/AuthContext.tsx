import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://54.242.36.109';

  const checkAuth = async () => {
    // Skip authentication check - allow anonymous access
    setIsAuthenticated(true);
    setLoading(false);
  };

  const login = () => {
    window.location.href = `${BACKEND_URL}/api/auth/login`;
  };

  const logout = () => {
    window.location.href = `${BACKEND_URL}/api/auth/logout`;
  };

  useEffect(() => {

    // With auth check
    // try {
    //   const response = await fetch(`${BACKEND_URL}/api/auth/status`, {
    //     credentials: 'include',
    //   });
    //   const data = await response.json();
    //   setIsAuthenticated(data.authenticated);
    // } catch (error) {
    //   console.error('Auth check failed:', error);
    //   setIsAuthenticated(false);
    // }
      

    // Skip auth check - set as authenticated immediately
    setIsAuthenticated(true);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};