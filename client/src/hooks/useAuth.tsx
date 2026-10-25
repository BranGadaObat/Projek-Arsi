import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserDto } from "shared";
import { api, getStoredToken, storeToken } from "../api/client";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getStoredToken() ? "loading" : "anonymous"));

  const logout = useCallback(() => {
    storeToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    let active = true;
    api
      .me()
      .then((response) => {
        if (!active) return;
        setUser(response.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        storeToken(null);
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    storeToken(response.token);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const response = await api.register(name, email, password);
    storeToken(response.token);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }
  return context;
}
