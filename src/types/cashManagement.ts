export type CashPaymentStatus = 'pending' | 'deposited';

export interface CashPayment {
  id: string;              // e.g. Firestore doc id
  reference: string;       // e.g. "PAY-0083"
  memberName: string;
  memberAvatarUrl?: string;
  planLabel: string;       // e.g. "Family Pack"
  durationLabel: string;   // e.g. "6 Months"
  amount: number;
  status: CashPaymentStatus;
  createdAt: string;       // ISO date
}

export interface BankDeposit {
  id: string;
  amount: number;
  bankName: string;
  slipReference: string;
  depositedBy: string;
  note?: string;
  attachmentUrl?: string;
  createdAt: string;       // ISO date
}

export type LedgerStatus = 'balanced' | 'pending' | 'over' | 'under';

export interface DailyLedgerEntry {
  id?: string;
  date: string;            // ISO date (day granularity)
  cashReceived: number;
  deposited: number;
  balance: number;
  status: LedgerStatus;
}

export interface DepositFormValues {
  amount: string;
  bankName: string;
  slipReference: string;
  depositedBy: string;
  note: string;
  attachment: File | null;
}

export const BANK_OPTIONS = [
  'Commercial Bank',
  'Sampath Bank',
  'Bank of Ceylon',
  "People's Bank",
  'Hatton National Bank',
  'NDB Bank', 'other'
] as const;
