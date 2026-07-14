// pages/admin/AdminMembershipsPage.tsx — skeleton, reuse your existing patterns
import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { updateMember } from '../../lib/memberService';
import type { Member } from '../../types';

type AdminMemberRow = Pick<Member, 'uid' | 'fullName' | 'email' | 'membershipTier' | 'membershipStatus' | 'createdAt'> & {
  membershipId: string;
};

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(value as string | number);
}

function AdminMembershipsContent() {
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadMembers = async () => {
      const membersQuery = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(membersQuery);
      const rows = snap.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          uid: doc.id,
          membershipId: doc.id.slice(0, 12).toUpperCase(),
          fullName: String(data.fullName || ''),
          email: String(data.email || ''),
          membershipTier: String(data.membershipTier || ''),
          membershipStatus: (data.membershipStatus as Member['membershipStatus']) || 'active',
          createdAt: toDate(data.createdAt),
        };
      });
      setMembers(rows);
    };

    void loadMembers();
  }, []);

  const deactivateMember = async (uid: string) => {
    try {
      await updateMember(uid, { membershipStatus: 'expired' });
      setMembers((current) => current.map((member) => member.uid === uid ? { ...member, membershipStatus: 'expired' } : member));
    } catch (error) {
      console.error('[AdminMembershipsPage] deactivateMember failed:', error);
    }
  };

  const handleDeactivateClick = (uid: string) => {
    const confirmed = window.confirm('Are you sure you want to deactivate this membership?');
    if (!confirmed) return;
    void deactivateMember(uid);
  };

  const filtered = members.filter(m =>
    !search.trim() ||
    m.fullName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-12 space-y-8">
      <h1 className="font-display text-headline-lg uppercase mb-4">MEMBERSHIP MANAGEMENT</h1>
      <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
      <table className="w-full text-left">
        <thead>
          <tr className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-border-default">
            <th className="py-3 pr-4">Membership ID</th>
            <th className="py-3 pr-4">Member</th>
            <th className="py-3 pr-4">Plan</th>
            <th className="py-3 pr-4">Email</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Joined</th>
            <th className="py-3 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.uid} className="border-b border-border-default/50">
              <td className="py-4 pr-4">{m.membershipId}</td>
              <td className="py-4 pr-4">{m.fullName}</td>
              <td className="py-4 pr-4">{m.membershipTier || '—'}</td>
              <td className="py-4 pr-4">{m.email}</td>
              <td className="py-4 pr-4"><Badge status={m.membershipStatus} /></td>
              <td className="py-4 pr-4">{m.createdAt.toLocaleDateString()}</td>
              <td className="py-4 pr-4">
                <Button
                  variant={m.membershipStatus === 'expired' ? 'ghost' : 'secondary'}
                  size="sm"
                  disabled={m.membershipStatus === 'expired'}
                  onClick={() => handleDeactivateClick(m.uid)}
                  className="min-w-[120px]"
                >
                  {m.membershipStatus === 'expired' ? 'Deactivated' : 'Deactivate'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminMembershipsPage() {
  return <AdminMembershipsContent />;
}