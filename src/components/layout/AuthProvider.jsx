// src/components/layout/AuthProvider.jsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

// Public shape consumed by useAuth() — kept stable so callers don't change.
//   { user: { id, email, name, role, avatarUrl } | null,
//     supabase, session,
//     isLoading, isAdmin,
//     signIn({ email, password }),
//     signUp({ email, password, name }),
//     signInWithOAuth(provider),
//     signOut() }

const AuthContext = createContext({
  user: null,
  supabase: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithOAuth: async () => {},
  signOut: async () => {},
});

function shapeUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    name:
      profile?.name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Member",
    role: profile?.role || "user",
    plan: profile?.plan || "free",
    avatarUrl: profile?.avatar_url || null,
  };
}

export function AuthProvider({ children }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks the profile fetch separately so RouteGuard can wait for the role
  // before deciding admin access. Without this, admin briefly looks like a
  // regular user right after login and gets redirected away.
  const [pendingProfile, setPendingProfile] = useState(false);

  // Fetch profile for the current auth user (id only).
  const loadProfile = useCallback(
    async (authUserId) => {
      if (!authUserId) {
        setProfile(null);
        return;
      }
      setPendingProfile(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, email, role, plan, avatar_url")
          .eq("id", authUserId)
          .maybeSingle();
        setProfile(data || null);
      } finally {
        setPendingProfile(false);
      }
    },
    [supabase],
  );

  // Bootstrap session on mount + subscribe to auth state changes.
  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id);
      }
      if (!active) return;
      setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user?.id) loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signIn = useCallback(
    async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
    [supabase],
  );

  const signUp = useCallback(
    async ({ email, password, name }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    [supabase],
  );

  const signInWithOAuth = useCallback(
    async (provider) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [supabase]);

  const user = shapeUser(session?.user, profile);

  // Bundle profile fetching into the public isLoading so callers (e.g.
  // RouteGuard) wait for the role before making admin/non-admin decisions.
  const loading = isLoading || pendingProfile;

  const value = useMemo(
    () => ({
      user,
      supabase,
      session,
      isLoading: loading,
      isAdmin: user?.role === "admin",
      signIn,
      signUp,
      signInWithOAuth,
      signOut,
    }),
    [user, supabase, session, loading, signIn, signUp, signInWithOAuth, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
