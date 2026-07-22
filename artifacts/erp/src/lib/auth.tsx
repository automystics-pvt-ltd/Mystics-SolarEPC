import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("mystics_token"));
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [location, setLocation] = useLocation();

  // Set the token getter for API calls immediately when token changes
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("mystics_token"));
  }, [token]);

  const { data: fetchedUser, isError, isLoading: isMeLoading } = useGetMe({
    query: {
      enabled: !!token && !user,
      retry: false,
    }
  });

  useEffect(() => {
    if (fetchedUser) {
      setUser(fetchedUser);
      setIsInitializing(false);
    }
    if (isError) {
      setToken(null);
      setUser(null);
      localStorage.removeItem("mystics_token");
      setIsInitializing(false);
    }
    if (!token) {
      setIsInitializing(false);
    }
  }, [fetchedUser, isError, token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("mystics_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("mystics_token");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  const isLoading = isInitializing || isMeLoading;

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
