"use client";

import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Every visitor gets an anonymous Firebase identity automatically (listeners
 * never see a login screen). Hosts can optionally upgrade to Google — we try
 * `linkWithPopup` first so the anonymous uid (and any room ownership) is kept.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (e) {
        setError(
          (e as Error).message.includes("admin-restricted-operation")
            ? "Anonymous sign-in is disabled in your Firebase project."
            : (e as Error).message,
        );
        setLoading(false);
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      if (auth.currentUser?.isAnonymous) {
        try {
          const cred = await linkWithPopup(auth.currentUser, provider);
          setUser(cred.user);
          return;
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code !== "auth/credential-already-in-use" && code !== "auth/email-already-in-use") {
            throw e;
          }
        }
      }
      const cred = await signInWithPopup(auth, provider);
      setUser(cred.user);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError((e as Error).message);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, configured: isFirebaseConfigured, signInWithGoogle, signOut }),
    [user, loading, error, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
