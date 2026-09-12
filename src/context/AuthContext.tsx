import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  role: 'customer' | 'admin' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null , role: null , loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'customer' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRole: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      unsubRole?.();

      if (u) {
        unsubRole = onSnapshot(doc(db, 'members', u.uid), (snap) => {
          setRole((snap.data()?.role as 'customer' | 'admin') ?? 'customer');
          setLoading(false);
        }, () => setLoading(false));
      } else {
        setRole(null);
        setLoading(false);
      }
    }, () => setLoading(false));

    return () => {
      unsubAuth();
      unsubRole?.();
    };
  }, []);

  return <AuthContext.Provider value={{ user, role, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
