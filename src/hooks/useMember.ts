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

    let primaryUnsubscribe: (() => void) | undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'members', user.uid),
      (snap) => {
        if (!snap.exists()) {
          setMember(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as unknown as Member;
        const currentMember = { ...(data as Member), id: snap.id, uid: snap.id } as MemberWithId;

        if (data.isSecondaryMember && data.linkedPrimaryUid) {
          primaryUnsubscribe?.();
          primaryUnsubscribe = onSnapshot(doc(db, 'members', data.linkedPrimaryUid), (primarySnap) => {
            const primaryData = primarySnap.exists() ? (primarySnap.data() as unknown as Member) : null;
            const primaryStatus = primaryData?.membershipStatus;
            const currentStatus = currentMember.membershipStatus;
            const membershipStatus =
              primaryStatus === 'expired' || primaryStatus === 'rejected'
                ? primaryStatus
                : currentStatus !== 'active'
                  ? currentStatus
                  : primaryStatus ?? currentStatus;

            setMember({
              ...currentMember,
              membershipStatus,
              membershipTier: primaryData?.membershipTier ?? currentMember.membershipTier,
              membershipExpiry: (primaryData as Member | null)?.membershipExpiry ?? currentMember.membershipExpiry,
            });
          }, () => {
            setError('Failed to load primary member data');
          });
        } else {
          primaryUnsubscribe?.();
          setMember(currentMember);
        }

        setLoading(false);
      },
      () => {
        setError('Failed to load member data');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      primaryUnsubscribe?.();
    };
  }, [user]);

  return { member, loading, error };
}