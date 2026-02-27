import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  handle?: string;
  email: string;
  status: string;
  role: string;
  organisation?: string;
  roleTitle?: string;
  bio?: string;
  avatarUrl?: string;
  contactVisibility?: string;
  createdAt?: string;
}

interface Profile {
  regions?: string[];
  interests?: string[];
  collaborationMode?: string;
  assistantActivityLevel?: string;
  introPreference?: string;
  profileSnapshot?: string;
  currentGoal?: string;
  onboardingComplete?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true, refetch: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);

  const initialLoadDone = useRef(false);

  const fetchMe = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      setUser(data.user);
      setProfile(data.profile);
      lastFetchRef.current = Date.now();
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setProfile(null);
    queryClient.clear();
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  useEffect(() => {
    const handleFocus = () => {
      const elapsed = Date.now() - lastFetchRef.current;
      if (elapsed > 60_000) {
        fetchMe();
      }
    };

    const handleOnline = () => {
      fetchMe();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchMe();
      }
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refetch: fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
