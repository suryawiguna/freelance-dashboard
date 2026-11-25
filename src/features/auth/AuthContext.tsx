import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, USE_EMULATOR } from "../../data/firebase";
import { OWNER_UID } from "../../owner";

interface AuthState {
  loading: boolean;
  user: User | null;
  /** True bila user adalah pemilik. Rules tetap penjaga sebenarnya. */
  isOwner: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  /** Hanya di emulator: masuk dengan UID pemilik tanpa akun Google. */
  signInAsOwnerEmulator?: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const IGNORED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);
const USE_REDIRECT = new Set(["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"]);

function errorText(e: unknown): string {
  if (e instanceof FirebaseError && e.code === "auth/network-request-failed") {
    return "Tidak ada koneksi. Coba lagi setelah online.";
  }
  return "Gagal masuk. Coba lagi.";
}

/**
 * Token kustom tanpa tanda tangan. Hanya diterima Auth emulator, tidak pernah
 * oleh Firebase asli, jadi aman walau ada di bundle.
 */
function unsignedToken(uid: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: "emulator",
    sub: "emulator",
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
  })}.`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo<AuthState>(() => {
    const signInWithGoogle = async () => {
      setError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        if (e instanceof FirebaseError && IGNORED.has(e.code)) return;
        if (e instanceof FirebaseError && USE_REDIRECT.has(e.code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        setError(errorText(e));
      }
    };
    return {
      loading,
      user,
      isOwner: user?.uid === OWNER_UID,
      error,
      signInWithGoogle,
      signInAsOwnerEmulator: USE_EMULATOR
        ? async () => {
            setError(null);
            try {
              await signInWithCustomToken(auth, unsignedToken(OWNER_UID));
            } catch (e) {
              setError(errorText(e));
            }
          }
        : undefined,
      logout: () => signOut(auth),
    };
  }, [loading, user, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth di luar AuthProvider");
  return ctx;
}
