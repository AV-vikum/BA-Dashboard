import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { isInternalEmail, normalizeEmail, type AccessConfig } from '@ba/shared';
import { auth, db } from '@/lib/firebase';
import { AuthContext, type AuthContextValue, type AuthUser } from './AuthContext';

// Keyed by uid so a value fetched for the previous user is never shown
// against the current one (e.g. right after sign-out then sign-in).
interface LoadedFor<T> {
  uid: string;
  value: T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined); // undefined = not resolved yet
  const [accessConfig, setAccessConfig] = useState<LoadedFor<AccessConfig | null> | null>(null);
  const [adminCheck, setAdminCheck] = useState<LoadedFor<boolean> | null>(null);

  // Auth state: also handles the unverified-email case and the users/{uid} upsert.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        toast.error('Your Google account email is not verified.');
        await firebaseSignOut(auth);
        return;
      }
      setFirebaseUser(user);
      if (user) {
        try {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              email: normalizeEmail(user.email ?? ''),
              displayName: user.displayName,
              photoURL: user.photoURL,
              lastLoginAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {
          toast.error('Could not save your profile.');
        }
      }
    });
  }, []);

  // config/access — live, readable by any signed-in user.
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    return onSnapshot(
      doc(db, 'config', 'access'),
      (snap) => {
        setAccessConfig({ uid, value: snap.exists() ? (snap.data() as AccessConfig) : null });
      },
      () => {
        setAccessConfig({ uid, value: null });
      },
    );
  }, [firebaseUser]);

  // isAdmin: whether config/admins is readable. Re-checked whenever
  // config/access changes (access-config edits and admin-list edits often
  // happen together in Settings).
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    let cancelled = false;
    getDoc(doc(db, 'config', 'admins'))
      .then((snap) => {
        if (!cancelled) setAdminCheck({ uid, value: snap.exists() });
      })
      .catch(() => {
        if (!cancelled) setAdminCheck({ uid, value: false });
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, accessConfig]);

  const value = useMemo<AuthContextValue>(() => {
    if (firebaseUser === undefined) {
      return loadingValue;
    }
    if (firebaseUser === null) {
      return signedOutValue;
    }
    const uid = firebaseUser.uid;
    const accessConfigForUser = accessConfig?.uid === uid ? accessConfig.value : undefined;
    const isAdminForUser = adminCheck?.uid === uid ? adminCheck.value : undefined;
    // Wait for config/access and the admin check to resolve before
    // reporting signedIn, to avoid a flicker (e.g. Admin link popping in).
    if (accessConfigForUser === undefined || isAdminForUser === undefined) {
      return loadingValue;
    }
    const email = normalizeEmail(firebaseUser.email ?? '');
    const user: AuthUser = {
      uid,
      email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    };
    return {
      status: 'signedIn',
      user,
      accessConfig: accessConfigForUser,
      isInternal: accessConfigForUser
        ? isInternalEmail(email, accessConfigForUser.allowedDomains)
        : false,
      isAdmin: isAdminForUser,
      signIn,
      signOut,
    };
  }, [firebaseUser, accessConfig, adminCheck]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const loadingValue: AuthContextValue = {
  status: 'loading',
  user: null,
  accessConfig: null,
  isInternal: false,
  isAdmin: false,
  signIn,
  signOut,
};

const signedOutValue: AuthContextValue = {
  status: 'signedOut',
  user: null,
  accessConfig: null,
  isInternal: false,
  isAdmin: false,
  signIn,
  signOut,
};

async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  const hintDomain = import.meta.env.VITE_APP_HINT_DOMAIN;
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(hintDomain ? { hd: hintDomain } : {}),
  });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (isFirebaseError(error) && error.code === 'auth/popup-closed-by-user') {
      return;
    }
    toast.error('Sign-in failed. Please try again.');
  }
}

async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

function isFirebaseError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
