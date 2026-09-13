// components/CashManagementTab.tsx
import { useMemo, useState, useEffect } from 'react';
import RecordDepositModal from './Recorddepositmodal';
import DepositDetailsModal from './DepositDetailsModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  BankDeposit,
  CashPayment,
  DailyLedgerEntry,
  DepositFormValues,
  LedgerStatus,
} from '../../types/cashManagement';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, collectionGroup, getDocs, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, storage } from '../../lib/firebase';


function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRs(n: number) {
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

function addDays(iso: string, delta: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

// ---- Firestore data fetching ------------------------------

const TODAY = toISODate(new Date());

// Fetch cash payments for a specific date from Firestore
async function getCashPaymentsForDate(date: string): Promise<CashPayment[]> {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  try {
    const paymentsRef = collectionGroup(db, 'payments');
    const q = query(
      paymentsRef,
      where('method', '==', 'cash'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? toISODate(data.createdAt.toDate())
        : date;

      return {
        id: doc.id,
        reference: data.reference || `PAY-${doc.id.slice(-6)}`,
        memberName: data.memberName || 'Unknown',
        planLabel: data.plan || 'N/A',
        durationLabel: data.duration || 'N/A',
        amount: Number(data.amount) || 0,
        status: data.status === 'confirmed' ? 'deposited' : 'pending',
        createdAt,
      } as CashPayment;
    });
  } catch (err) {
    console.warn('Error fetching cash payments:', err);
    return [];
  }
}

async function getCashPaymentsForRange(startDate: string, endDate: string): Promise<Record<string, CashPayment[]>> {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);

  try {
    const paymentsRef = collectionGroup(db, 'payments');
    const q = query(
      paymentsRef,
      where('method', '==', 'cash'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
    );
    const snapshot = await getDocs(q);

    const grouped: Record<string, CashPayment[]> = {};

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as any;
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? toISODate(data.createdAt.toDate())
        : '';

      if (!createdAt) return;

      const payment: CashPayment = {
        id: doc.id,
        reference: data.reference || `PAY-${doc.id.slice(-6)}`,
        memberName: data.memberName || 'Unknown',
        planLabel: data.plan || 'N/A',
        durationLabel: data.duration || 'N/A',
        amount: Number(data.amount) || 0,
        status: data.status === 'confirmed' ? 'deposited' : 'pending',
        createdAt,
      };

      grouped[createdAt] = grouped[createdAt] || [];
      grouped[createdAt].push(payment);
    });

    return grouped;
  } catch (err) {
    console.warn('Error fetching cash payments range:', err);
    return {};
  }
}

async function getSavedLedgerEntries(startDate: string, endDate: string): Promise<Record<string, DailyLedgerEntry>> {
  const ledgerRef = collection(db, 'cashLedgerEntries');
  const q = query(
    ledgerRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snapshot = await getDocs(q);
  const result: Record<string, DailyLedgerEntry> = {};

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const date = data.date as string;
    if (!date) return;

    const cashReceived = Number(data.cashReceived) || 0;
    const deposited = Number(data.deposited) || 0;
    const balance = Number(data.balance);
    const status = (data.status as LedgerStatus) || (balance === 0 ? 'balanced' : balance > 0 ? 'pending' : 'over');

    result[date] = {
      id: docSnap.id,
      date,
      cashReceived,
      deposited,
      balance: Number.isNaN(balance) ? cashReceived - deposited : balance,
      status,
    };
  });

  return result;
}

async function saveDailyLedgerEntry(entry: DailyLedgerEntry) {
  const entryRef = doc(db, 'cashLedgerEntries', entry.date);
  await setDoc(entryRef, {
    date: entry.date,
    cashReceived: entry.cashReceived,
    deposited: entry.deposited,
    balance: entry.balance,
    status: entry.status,
    savedAt: serverTimestamp(),
  });
}

const LEDGER_STATUS_STYLES: Record<LedgerStatus, { label: string; badge: 'pending_verification' | 'pending_cash' | 'confirmed' | 'active' | 'expired' }> = {
  balanced: { label: 'Balanced', badge: 'confirmed' },
  pending: { label: 'Pending', badge: 'pending_verification' },
  over: { label: 'Over', badge: 'expired' },
  under: { label: 'Under', badge: 'expired' },
};

async function ensureAuthenticatedUser(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        reject(new Error('Please sign in before saving a deposit record.'));
      }
    });
  });
}



interface SummaryCardProps {
  icon: string;
  label: string;
  value: string;
  subtext: string;
}

function SummaryCard({ icon, label, value, subtext }: SummaryCardProps) {
  return (
    <div className="p-6 rounded-[24px] border bg-surface-container border-surface-container-highest shadow-lg shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase tracking-[0.24em] text-on-surface-variant">{label}</p>
          <p className="font-display text-headline-md mt-4 text-on-surface">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-3xl bg-surface-container-highest border border-surface-container-highest text-on-surface-variant">
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
      </div>
      <p className="text-body-sm font-body mt-3 text-on-surface-variant">{subtext}</p>
    </div>
  );
}



export default function CashManagementTab() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [payments, setPayments] = useState<Record<string, CashPayment[]>>({});
  const [deposits, setDeposits] = useState<Record<string, BankDeposit[]>>({});
  const [selectedDeposit, setSelectedDeposit] = useState<BankDeposit | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [savedLedgerEntries, setSavedLedgerEntries] = useState<Record<string, DailyLedgerEntry>>({});
  const [ledgerDateInput, setLedgerDateInput] = useState(TODAY);
  const [ledgerCashReceived, setLedgerCashReceived] = useState('');
  const [ledgerDeposited, setLedgerDeposited] = useState('');
  const [savingLedger, setSavingLedger] = useState(false);

  const dayPayments = payments[selectedDate] ?? [];
  const dayDeposits = deposits[selectedDate] ?? [];
  const isToday = selectedDate === TODAY;

  const totals = useMemo(() => {
    const cashReceived = dayPayments.reduce((sum, p) => sum + p.amount, 0);
    // Deposited = sum of actual bank deposit slips recorded for this day
    const deposited = dayDeposits.reduce((sum, d) => sum + d.amount, 0);
    const depositSlipCount = dayDeposits.length;
    return {
      cashReceived,
      deposited,
      balance: cashReceived - deposited,
      transactionCount: dayPayments.length,
      depositSlipCount,
    };
  }, [dayPayments, dayDeposits]);

  // Build ledger dynamically for the last 14 days
  const ledger = useMemo(() => {
    const ledgerMap: Record<string, DailyLedgerEntry> = {};
    
    // Initialize last 14 days
    for (let i = 13; i >= 0; i--) {
      const date = addDays(TODAY, -i);
      ledgerMap[date] = {
        date,
        cashReceived: 0,
        deposited: 0,
        balance: 0,
        status: 'balanced' as LedgerStatus,
      };
    }

    // Add payments data
    Object.entries(payments).forEach(([date, paymentList]) => {
      if (ledgerMap[date]) {
        ledgerMap[date].cashReceived = paymentList.reduce((sum, p) => sum + p.amount, 0);
      }
    });

    // Add deposits data
    Object.entries(deposits).forEach(([date, depositList]) => {
      if (ledgerMap[date]) {
        ledgerMap[date].deposited = depositList.reduce((sum, d) => sum + d.amount, 0);
      }
    });

    // Override with manually saved ledger entries when present
    Object.entries(savedLedgerEntries).forEach(([date, entry]) => {
      if (ledgerMap[date]) {
        ledgerMap[date].cashReceived = entry.cashReceived;
        ledgerMap[date].deposited = entry.deposited;
        ledgerMap[date].balance = entry.balance;
        ledgerMap[date].status = entry.status;
      }
    });

    // Calculate balance and status when not overridden
    Object.values(ledgerMap).forEach((entry) => {
      if (!savedLedgerEntries[entry.date]) {
        entry.balance = entry.cashReceived - entry.deposited;
        entry.status = entry.balance === 0 ? 'balanced' : entry.balance > 0 ? 'pending' : 'over';
      }
    });

    return Object.values(ledgerMap).reverse();
  }, [payments, deposits, savedLedgerEntries]);

  // Fetch cash payments for the selected date
  useEffect(() => {
    getCashPaymentsForDate(selectedDate).then((items) => {
      setPayments((prev) => ({ ...prev, [selectedDate]: items }));
    });
  }, [selectedDate]);

  // Fetch all cash payments for the last 14 days to build the ledger
  useEffect(() => {
    const startDate = addDays(TODAY, -13);
    const endDate = TODAY;
    getCashPaymentsForRange(startDate, endDate).then((grouped) => {
      setPayments((prev) => ({ ...prev, ...grouped }));
    });

    getSavedLedgerEntries(startDate, endDate).then((saved) => {
      setSavedLedgerEntries(saved);
    });
  }, []);

  useEffect(() => {
    const saved = savedLedgerEntries[selectedDate];
    setLedgerDateInput(selectedDate);
    setLedgerCashReceived(saved ? String(saved.cashReceived) : String(totals.cashReceived));
    setLedgerDeposited(saved ? String(saved.deposited) : String(dayDeposits.reduce((sum, d) => sum + d.amount, 0)));
  }, [selectedDate, savedLedgerEntries, totals.cashReceived, dayDeposits]);

  useEffect(() => {
    const q = query(collection(db, 'deposits'), where('date', '==', selectedDate), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: BankDeposit[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString();
        return {
          id: d.id,
          amount: data.amount || 0,
          bankName: data.bankName || '',
          slipReference: data.slipReference || '',
          depositedBy: data.depositedBy || '',
          note: data.note || undefined,
          attachmentUrl: data.attachmentUrl || undefined,
          createdAt,
        } as BankDeposit;
      });
      setDeposits((prev) => ({ ...prev, [selectedDate]: items }));
    });
    return unsub;
  }, [selectedDate]);

  const handleRecordDeposit = async (values: DepositFormValues) => {
    const amount = Number(values.amount);

    const user = await ensureAuthenticatedUser();
    if (user) {
      await user.getIdToken(true);
    }

    let attachmentDownloadUrl: string | undefined;
    const depositPayload = {
      amount,
      bankName: values.bankName,
      slipReference: values.slipReference,
      depositedBy: values.depositedBy,
      note: values.note || null,
      attachmentUrl: null as string | null,
      date: selectedDate,
      createdAt: serverTimestamp(),
    };

    if (values.attachment) {
      const path = `deposits/${selectedDate}/${Date.now()}-${values.attachment.name}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, values.attachment);
      attachmentDownloadUrl = await getDownloadURL(r);
      depositPayload.attachmentUrl = attachmentDownloadUrl;
    }

    try {
      const docRef = await addDoc(collection(db, 'deposits'), depositPayload);

      // Log the saved document id and the resolved attachment URL so admins
      // can confirm the attachment was persisted (check browser console).
      // This is a lightweight debug aid that can be removed later.
      console.log('[CashManagement] Saved deposit', docRef.id, 'attachmentUrl:', attachmentDownloadUrl, 'payloadAttachment:', depositPayload.attachmentUrl);

      const savedDeposit: BankDeposit = {
        id: docRef.id,
        amount,
        bankName: values.bankName,
        slipReference: values.slipReference,
        depositedBy: values.depositedBy,
        note: values.note || undefined,
        attachmentUrl: attachmentDownloadUrl || undefined,
        createdAt: new Date().toISOString(),
      };

      setDeposits((prev) => ({
        ...prev,
        [selectedDate]: [savedDeposit, ...(prev[selectedDate] ?? [])],
      }));
    } catch (err) {
      console.error('[CashManagement] Could not save deposit to Firestore:', err);
      throw err;
    }

    // Deposits are auto-fetched from Firestore listener above
    // No need to manually update local state
  };

  const handleSaveLedgerEntry = async () => {
    const cashReceived = Number(ledgerCashReceived);
    const deposited = Number(ledgerDeposited);

    if (Number.isNaN(cashReceived) || Number.isNaN(deposited)) {
      alert('Please enter valid numeric values for Cash Received and Deposited.');
      return;
    }

    const balance = cashReceived - deposited;
    const status: LedgerStatus = balance === 0 ? 'balanced' : balance > 0 ? 'pending' : 'over';

    const entry: DailyLedgerEntry = {
      date: ledgerDateInput,
      cashReceived,
      deposited,
      balance,
      status,
    };

    try {
      setSavingLedger(true);
      await saveDailyLedgerEntry(entry);
      setSavedLedgerEntries((prev) => ({ ...prev, [ledgerDateInput]: entry }));
      alert('Ledger entry saved successfully.');
    } catch (error) {
      console.error('[CashManagement] Failed to save ledger entry:', error);
      alert('Unable to save ledger entry. Please try again.');
    } finally {
      setSavingLedger(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-6 text-on-surface">
      {/* Date navigation */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-container-highest text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Previous day"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>

          <div>
            <p className="text-label-sm uppercase tracking-[0.28em] text-on-surface-variant">Selected date</p>
            <h1 className="font-display text-headline-md">{formatDayLabel(selectedDate)}</h1>
          </div>

          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={isToday}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-container-highest text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next day"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <label className="sr-only" htmlFor="cash-management-date-picker">Select date</label>
          <input
            id="cash-management-date-picker"
            type="date"
            value={selectedDate}
            max={TODAY}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-11 rounded-full border border-surface-container-highest bg-surface-container px-4 text-body-md text-on-surface transition focus:border-primary-container focus:outline-none"
          />

          {isToday ? (
            <span className="rounded-full bg-primary-container text-primary px-3 py-1 text-label-sm font-semibold">
              TODAY
            </span>
          ) : (
            <button
              onClick={() => setSelectedDate(TODAY)}
              className="rounded-full border border-surface-container-highest px-3 py-1 text-label-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high"
            >
              Jump to today
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon="payments"
          label="Cash Received"
          value={formatRs(totals.cashReceived)}
          subtext={`${totals.transactionCount} transaction${totals.transactionCount === 1 ? '' : 's'}`}
        />
        <SummaryCard
          icon="receipt_long"
          label="Deposited"
          value={formatRs(totals.deposited)}
          subtext={`${totals.depositSlipCount} deposit slip${totals.depositSlipCount === 1 ? '' : 's'}`}
        />
        <SummaryCard
          icon="account_balance_wallet"
          label="Balance"
          value={formatRs(totals.balance)}
          subtext={totals.balance > 0 ? 'Pending deposit' : 'All deposited'}
        />
      </div>

      {/* Cash payments table */}
      <div className="mb-6 overflow-hidden rounded-[24px] border border-surface-container-highest bg-surface-container">
        <div className="flex items-center justify-between border-b border-surface-container-highest px-6 py-4">
          <h2 className="flex items-center gap-2 text-label-sm font-semibold tracking-widest text-on-surface-variant uppercase">
            <span className="material-symbols-outlined text-base">receipt</span>
            CASH PAYMENTS — {formatDayLabel(selectedDate).toUpperCase()}
          </h2>
          <Button
            onClick={() => setModalOpen(true)}
            variant="primary"
            size="sm"
          >
            <span className="material-symbols-outlined text-base">add</span> Record Deposit
          </Button>
        </div>

        {dayPayments.length === 0 ? (
          <div className="px-6 py-10 text-center text-body-sm text-on-surface-variant">
            No cash payments recorded for this day.
          </div>
        ) : (
          <>
            {dayPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-surface-container-highest px-6 py-4 last:border-b-0 hover:bg-surface-container-high transition"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 text-primary-container">
                    <span className="material-symbols-outlined text-xl">payments</span>
                  </div>
                  <div>
                    <div className="text-body-md font-display text-on-surface">{p.memberName}</div>
                    <div className="text-body-sm text-on-surface-variant">
                      {p.planLabel} · {p.durationLabel} · {p.reference}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge status={p.status === 'pending' ? 'pending_cash' : 'confirmed'} />
                  <span className="w-24 text-right text-body-md font-display text-on-surface">
                    {formatRs(p.amount)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-container-high">
              <span className="text-label-sm font-semibold tracking-widest text-on-surface-variant uppercase">TOTAL</span>
              <span className="text-body-md font-display text-on-surface">{formatRs(totals.cashReceived)}</span>
            </div>
          </>
        )}
      </div>

      {/* Record a bank deposit CTA */}
      <Button
        onClick={() => setModalOpen(true)}
        variant="ghost"
        className="mb-6 w-full"
      >
        <span className="material-symbols-outlined text-lg">add</span> Record a Bank Deposit
      </Button>

      <div className="mb-6 overflow-hidden rounded-[24px] border border-surface-container-highest bg-surface-container p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-label-sm uppercase tracking-[0.24em] text-on-surface-variant">Manual Ledger Entry</p>
            <h2 className="font-display text-headline-sm text-on-surface">Save daily cash ledger</h2>
          </div>
          <span className="rounded-full border border-surface-container-highest bg-surface-container px-3 py-1 text-label-sm text-on-surface-variant">
            Overrides auto totals
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <label className="block text-label-sm text-on-surface-variant">
            Date
            <input
              type="date"
              value={ledgerDateInput}
              max={TODAY}
              onChange={(event) => setLedgerDateInput(event.target.value)}
              className="mt-2 w-full rounded-full border border-surface-container-highest bg-surface-container px-4 py-3 text-body-md text-on-surface focus:border-primary-container focus:outline-none"
            />
          </label>

          <label className="block text-label-sm text-on-surface-variant">
            Cash Received
            <input
              type="number"
              min="0"
              value={ledgerCashReceived}
              onChange={(event) => setLedgerCashReceived(event.target.value)}
              className="mt-2 w-full rounded-full border border-surface-container-highest bg-surface-container px-4 py-3 text-body-md text-on-surface focus:border-primary-container focus:outline-none"
            />
          </label>

          <label className="block text-label-sm text-on-surface-variant">
            Deposited
            <input
              type="number"
              min="0"
              value={ledgerDeposited}
              onChange={(event) => setLedgerDeposited(event.target.value)}
              className="mt-2 w-full rounded-full border border-surface-container-highest bg-surface-container px-4 py-3 text-body-md text-on-surface focus:border-primary-container focus:outline-none"
            />
          </label>

          <button
            onClick={handleSaveLedgerEntry}
            disabled={savingLedger}
            className="mt-2 h-11 rounded-full bg-primary-container px-6 text-body-md font-semibold text-on-primary-container transition hover:opacity-90 disabled:opacity-50"
          >
            {savingLedger ? 'Saving...' : 'Save Ledger'}
          </button>
        </div>
      </div>

      {dayDeposits.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-[24px] border border-surface-container-highest bg-surface-container">
          <div className="border-b border-surface-container-highest px-6 py-4">
            <h2 className="text-label-sm font-semibold tracking-widest text-on-surface-variant uppercase">
              <span className="material-symbols-outlined text-base inline mr-2">folder</span>
              DEPOSIT RECORDS — {formatDayLabel(selectedDate).toUpperCase()}
            </h2>
          </div>
          <div className="space-y-3 p-6">
            {dayDeposits.map((deposit) => (
              <div key={deposit.id} className="rounded-xl border border-surface-container-highest bg-surface-container-high p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-body-md font-display text-on-surface">{deposit.bankName}</div>
                    <div className="mt-1 text-body-sm text-on-surface-variant">Slip ref: {deposit.slipReference}</div>
                    <div className="mt-1 text-body-sm text-on-surface-variant">Deposited by: {deposit.depositedBy}</div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-body-md font-display text-primary-container">{formatRs(deposit.amount)}</div>
                    <div className="mt-1 text-body-sm text-on-surface-variant">
                      {new Date(deposit.createdAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedDeposit(deposit)}
                        className="mt-2 inline-flex items-center gap-2 rounded-md border border-surface-container-highest px-3 py-1 text-label-sm text-on-surface hover:bg-surface-container-high transition"
                      >
                        <span className="material-symbols-outlined text-base">info</span>
                        View details
                      </button>
                    </div>
                    {deposit.attachmentUrl ? (
                      <a
                        href={deposit.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 rounded-md border border-surface-container-highest bg-surface-container px-3 py-1 text-label-sm text-primary-container transition hover:bg-surface-container-high"
                      >
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                        Open receipt
                      </a>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-2 rounded-md border border-surface-container-highest bg-surface-container px-3 py-1 text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">receipt_long</span>
                        No receipt attached
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="text-body-sm text-on-surface-variant">
                    {deposit.note ? deposit.note : 'No note provided'}
                  </div>
                  {deposit.attachmentUrl && (
                    <div className="text-body-sm text-on-surface-variant">
                      Slip attachment: <a
                        href={deposit.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-container font-medium underline transition hover:text-primary"
                      >
                        View receipt
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-surface-container-highest bg-surface-container-high px-4 py-3 text-body-sm text-on-surface-variant">
              Total deposited today: <span className="font-display font-semibold text-on-surface">{formatRs(dayDeposits.reduce((sum, d) => sum + d.amount, 0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="overflow-hidden rounded-[24px] border border-surface-container-highest bg-surface-container">
        <div className="border-b border-surface-container-highest px-6 py-4">
          <h2 className="text-label-sm font-semibold tracking-widest text-on-surface-variant uppercase">
            <span className="material-symbols-outlined text-base inline mr-2">history</span>
            CASH LEDGER — LAST 14 DAYS
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-surface-container-highest text-left text-label-sm text-on-surface-variant">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Cash Received</th>
                <th className="px-6 py-4 font-medium">Deposited</th>
                <th className="px-6 py-4 font-medium">Balance</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const status = LEDGER_STATUS_STYLES[entry.status];
                const isEntryToday = entry.date === TODAY;
                return (
                  <tr
                    key={entry.date}
                    onClick={() => setSelectedDate(entry.date)}
                    className={`cursor-pointer border-b border-surface-container-highest hover:bg-surface-container-high transition ${
                      isEntryToday ? 'bg-primary-container/10' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="font-display text-on-surface">{formatDayLabel(entry.date)}</span>
                      {isEntryToday && (
                        <span className="ml-2 rounded-full bg-primary-container text-primary text-[10px] font-semibold px-2 py-0.5">
                          TODAY
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-display text-primary-container">
                      {entry.cashReceived > 0 ? formatRs(entry.cashReceived) : '—'}
                    </td>
                    <td className="px-6 py-4 font-display text-primary-container">
                      {entry.deposited > 0 ? formatRs(entry.deposited) : '—'}
                    </td>
                    <td
                      className={`px-6 py-4 font-display font-semibold ${
                        entry.balance === 0
                          ? 'text-on-surface'
                          : entry.balance > 0
                          ? 'text-primary-container'
                          : 'text-error'
                      }`}
                    >
                      {formatRs(entry.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={status.badge}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <RecordDepositModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleRecordDeposit}
        suggestedAmount={totals.balance > 0 ? totals.balance : undefined}
      />
      <DepositDetailsModal
        isOpen={!!selectedDeposit}
        deposit={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
      />
    </div>
  );
}