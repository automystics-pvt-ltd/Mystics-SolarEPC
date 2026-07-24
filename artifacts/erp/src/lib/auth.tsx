// @refresh reset
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setAuthTokenGetter, getGetMeQueryKey } from "@workspace/api-client-react";
import { useGetMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { clearRecentEntries } from "@/lib/recentHistory";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* ── Cached-user helpers ──────────────────────────────────────────────────
 * We persist the user object to localStorage so that on a direct-URL load
 * (or tab refresh) we can render instantly without waiting for /api/auth/me.
 * The cache is keyed by token so a different account on the same device
 * always gets a fresh fetch.  Entries older than 4 h force re-validation.
 * ─────────────────────────────────────────────────────────────────────── */
const USER_CACHE_KEY = "mystics_user_v2";
const CACHE_TTL_MS   = 4 * 60 * 60 * 1000; // 4 hours

function readUserCache(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const { user, ts } = JSON.parse(raw) as { user: User; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(USER_CACHE_KEY); return null; }
    return user;
  } catch { return null; }
}

function writeUserCache(user: User) {
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, ts: Date.now() })); } catch {}
}

function clearUserCache() {
  localStorage.removeItem(USER_CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mystics_token"));

  // Initialise from localStorage so returning users get an instant render
  // without any full-screen spinner. The /api/auth/me call below still fires
  // to re-validate; if it fails the cache is cleared and the user is logged out.
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem("mystics_token") ? readUserCache() : null
  );
  const [isInitializing, setIsInitializing] = useState(() => {
    // Skip the loading state if we have a fresh cached user
    const hasCache = !!localStorage.getItem("mystics_token") && !!readUserCache();
    return !hasCache;
  });
  const [, setLocation] = useLocation();

  // Set the token getter for API calls immediately when token changes
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("mystics_token"));
  }, [token]);

  // Only fetch /api/auth/me when we don't already have a user (first visit or
  // cache expired). Once user is set (from cache or fetch), skip the round-trip.
  const { data: fetchedUser, isError } = useGetMe({
    query: {
      enabled: !!token && !user,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (fetchedUser) {
      setUser(fetchedUser);
      writeUserCache(fetchedUser);
      setIsInitializing(false);
    }
    if (isError) {
      clearUserCache();
      setToken(null);
      setUser(null);
      localStorage.removeItem("mystics_token");
      setIsInitializing(false);
    }
    if (!token) {
      clearUserCache();
      setIsInitializing(false);
    }
  }, [fetchedUser, isError, token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("mystics_token", newToken);
    writeUserCache(newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    // Clear this user's navigation history before signing out so the next
    // user on a shared device starts with a clean command palette.
    if (user?.id) clearRecentEntries(user.id);
    localStorage.removeItem("mystics_token");
    clearUserCache();
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  const isLoading = isInitializing;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
