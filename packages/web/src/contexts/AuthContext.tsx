import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Use api.diastack.com in production, allow override via env var for local dev
const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://api.diastack.com/api/v1' : '/api/v1');
const TOKEN_KEY = 'diastack-session-token';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to get stored token
function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Helper to store token
function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

// Helper to clear token
function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Helper to make authenticated fetch requests
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Still include cookies as fallback
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Handle token from URL on mount (after OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // Store the token
      storeToken(token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authFetch(`${API_BASE}/auth/me`);

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = `${API_BASE}/auth/google`;
  };

  const logout = async () => {
    try {
      await authFetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
      });
      clearToken();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export authFetch for use in other parts of the app
export { authFetch };
