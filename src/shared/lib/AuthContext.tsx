import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, getMe, logout as apiLogout } from "@/shared/api";
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush } from "@/shared/lib/push";

type AuthState = {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerServiceWorker();
    getMe()
      .then((u) => {
        setUser(u);
        if (u) subscribeToPush().catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await unsubscribeFromPush();
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}