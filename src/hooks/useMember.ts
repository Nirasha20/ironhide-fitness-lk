import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { Member } from '../types';

type MemberWithId = Member & { id: string };

export function useMember() {
  const { user } = useAuth();
  const [member, setMember] = useState<MemberWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'members', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // snap.data() returns DocumentData; cast via unknown to satisfy TypeScript
          setMember({ ...(data as unknown as Member), id: snap.id, uid: snap.id });
        } else {
          setMember(null);
        }
        setLoading(false);
      },
      () => {
        setError('Failed to load member data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { member, loading, error };
}