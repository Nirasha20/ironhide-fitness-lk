// components/RecordDepositModal.tsx
import { useState, useRef, FormEvent } from 'react';
import { BANK_OPTIONS, DepositFormValues } from '../../types/cashManagement';

interface RecordDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: DepositFormValues) => Promise<void> | void;
  suggestedAmount?: number;
  suggestedSlipReference?: string;
}

const emptyValues: DepositFormValues = {
  amount: '',
  bankName: '',
  slipReference: '',
  depositedBy: '',
  note: '',
  attachment: null,
};

export default function RecordDepositModal({
  isOpen,
  onClose,
  onSubmit,
  suggestedAmount,
  suggestedSlipReference,
}: RecordDepositModalProps) {
  const [values, setValues] = useState<DepositFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof DepositFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const update = <K extends keyof DepositFormValues>(key: K, value: DepositFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof DepositFormValues, string>> = {};
    const amountNum = Number(values.amount);

    if (!values.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      next.amount = 'Enter a valid deposit amount';
    }
    if (!values.bankName) next.bankName = 'Select a bank';
    if (!values.slipReference.trim()) next.slipReference = 'Slip reference is required';
    if (!values.depositedBy.trim()) next.depositedBy = 'Enter who made the deposit';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      setValues(emptyValues);
      onClose();
    } catch (err: any) {
      console.error('[RecordDepositModal] submit error:', err);
      setSubmitError(err?.message || 'Could not save deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setValues(emptyValues);
    setErrors({});
    onClose();
  };

  const attachedFileName = values.attachment?.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-red-500">
            <span aria-hidden>🏦</span>
            RECORD BANK DEPOSIT
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-500 transition hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          {submitError && (
            <div className="mb-4 rounded-md border border-red-700 bg-red-700/10 px-4 py-3 text-sm text-red-200">
              {submitError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deposit Amount (Rs.)" required error={errors.amount}>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={suggestedAmount ? String(suggestedAmount) : '0'}
                value={values.amount}
                onChange={(e) => update('amount', e.target.value)}
                className={inputClass(!!errors.amount)}
              />
            </Field>

            <Field label="Bank Name" required error={errors.bankName}>
              <select
                value={values.bankName}
                onChange={(e) => update('bankName', e.target.value)}
                className={`${inputClass(!!errors.bankName)} appearance-none`}
              >
                <option value="">Select bank...</option>
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Deposit Slip Reference" required error={errors.slipReference}>
              <input
                type="text"
                placeholder={suggestedSlipReference ?? 'CB-DEP-20260723-01'}
                value={values.slipReference}
                onChange={(e) => update('slipReference', e.target.value)}
                className={inputClass(!!errors.slipReference)}
              />
            </Field>

            <Field label="Deposited By" required error={errors.depositedBy}>
              <input
                type="text"
                placeholder="Manager name"
                value={values.depositedBy}
                onChange={(e) => update('depositedBy', e.target.value)}
                className={inputClass(!!errors.depositedBy)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-zinc-400">
              NOTE (OPTIONAL)
            </label>
            <textarea
              rows={3}
              placeholder="Any remarks about this deposit..."
              value={values.note}
              onChange={(e) => update('note', e.target.value)}
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-red-600"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-zinc-400">
              ATTACH DEPOSIT SLIP
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-4 text-left transition hover:border-zinc-600"
            >
              <span aria-hidden className="text-zinc-400">📎</span>
              <span>
                <span className="block text-sm font-medium text-zinc-200">
                  {attachedFileName ?? 'Click to attach slip'}
                </span>
                <span className="block text-xs text-zinc-500">JPG, PNG or PDF · max 5MB</span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => update('attachment', e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden>🏦</span>
              {submitting ? 'Saving...' : 'Save Deposit Record'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-zinc-400">
        {label.toUpperCase()} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-red-600 ${
    hasError ? 'border-red-600' : 'border-zinc-800'
  }`;
}