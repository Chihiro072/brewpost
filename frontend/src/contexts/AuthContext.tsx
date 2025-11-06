import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  user: AuthUser | null;
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
  const [user, setUser] = useState<AuthUser | null>(null);

  const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5044';

  const decodeJwtPayload = (token: string): AuthUser | null => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(b64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(json);

      const firstName: string | undefined = payload?.given_name || payload?.firstName;
      const lastName: string | undefined = payload?.family_name || payload?.lastName;
      const preferred: string | undefined = payload?.name || payload?.preferred_username;
      const name: string | undefined = preferred || (firstName && lastName ? `${firstName} ${lastName}` : undefined);

      return {
        id: payload?.sub || payload?.user_id,
        email: payload?.email,
        name,
        firstName,
        lastName,
      };
    } catch (e) {
      console.warn('[AuthContext] Failed to decode JWT payload', e);
      return null;
    }
  };

  const checkAuth = async () => {
    console.log('[AuthContext] Starting auth check...');
    try {
      const token = localStorage.getItem('authToken');
      console.log('[AuthContext] Found token?', !!token);
      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        // Ensure userId is cleared when no token is present
        try {
          localStorage.removeItem('userId');
          console.log('[AuthContext] No token: userId removed from localStorage');
        } catch {}
        setLoading(false);
        return;
      }

      // Decode user payload locally for immediate availability
      const decodedUser = decodeJwtPayload(token);
      if (decodedUser) {
        setUser(decodedUser);
        // Persist userId immediately so other contexts (e.g., Subscription) can react
        if (decodedUser.id) {
          try {
            localStorage.setItem('userId', decodedUser.id);
            console.log('[AuthContext] Stored userId in localStorage:', decodedUser.id);
          } catch {}
        } else {
          console.warn('[AuthContext] Decoded user has no id - not storing userId');
        }
      } else {
        console.warn('[AuthContext] Failed to decode token payload - clearing userId');
        try {
          localStorage.removeItem('userId');
        } catch {}
      }

      // Optimistically stop loading so UI doesn't get stuck
      // We'll verify with backend, but never block indefinitely
      setIsAuthenticated(true);
      setLoading(false);

      // Verify token with backend with a timeout
      const controller = new AbortController();
      const timeoutMs = 4000;
      const timeoutId = setTimeout(() => {
        console.warn('[AuthContext] Auth status request timed out after', timeoutMs, 'ms');
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('[AuthContext] status response ok?', response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log('[AuthContext] status payload:', data);
          setIsAuthenticated(!!data.authenticated);
          if (!data.authenticated) {
            console.warn('[AuthContext] Backend says not authenticated; clearing token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            setUser(null);
          }
        } else {
          console.warn('[AuthContext] Token invalid, clearing');
          localStorage.removeItem('authToken');
          localStorage.removeItem('userId');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn('[AuthContext] Auth status fetch aborted due to timeout');
        } else {
          console.error('[AuthContext] Auth check failed:', err);
          setIsAuthenticated(false);
          setUser(null);
          localStorage.removeItem('userId');
        }
      }
    } catch (error) {
      console.error('[AuthContext] Auth preparation failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('userId');
      setLoading(false);
    } finally {
      console.log('[AuthContext] Auth check finished. isAuthenticated=', isAuthenticated);
    }
  };

  const login = () => {
    // Navigate to local login page instead of backend route
    window.location.href = '/login';
  };

  const logout = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      console.log('[AuthContext] Logout: removed authToken and userId from localStorage');
    } catch {}
    setIsAuthenticated(false);
    setUser(null);
    // Hit backend logout route and then return to login
    fetch(`${BACKEND_URL}/api/auth/logout`, { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuth, user }}>
      {children}
    </AuthContext.Provider>
  );
};