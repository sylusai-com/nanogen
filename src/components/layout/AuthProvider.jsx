"use client";

// Phase 2 stub: an in-memory auth provider that mimics Supabase's API surface
// so wiring real auth later is mostly a swap of this file.
//
// User shape: { id, name, email, avatarUrl?, role: "user" | "admin" }

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext({
  user: null,
  isLoading: true,
  isAdmin: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
});

const STORAGE_KEY = "nanogen-auth-user";

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(user) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function inferRole(email) {
  return /admin@|@nanogen\./i.test(email || "") ? "admin" : "user";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(readStored());
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async ({ email, name }) => {
    const next = {
      id: `usr_${Math.random().toString(36).slice(2, 10)}`,
      name: name || (email?.split("@")[0] ?? "Member"),
      email,
      role: inferRole(email),
      createdAt: new Date().toISOString(),
    };
    setUser(next);
    writeStored(next);
    return next;
  }, []);

  const signUp = useCallback(async ({ email, name }) => {
    return signIn({ email, name });
  }, [signIn]);

  const signOut = useCallback(() => {
    setUser(null);
    writeStored(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "admin",
      signIn,
      signUp,
      signOut,
    }),
    [user, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
