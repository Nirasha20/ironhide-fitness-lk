import { useState, useEffect } from 'react';
import { BankDeposit } from '../../types/cashManagement';

export default function DepositDetailsModal({
  isOpen,
  onClose,
  deposit,
}: {
  isOpen: boolean;
  onClose: () => void;
  deposit: BankDeposit | null;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && deposit) {
      setPreviewFailed(false);
      setIsLoading(true);
    }
  }, [isOpen, deposit?.attachmentUrl]);

  if (!isOpen || !deposit) return null;

  const att = deposit.attachmentUrl;
  const isPreviewableUrl = typeof att === 'string' && (att.startsWith('http') || att.startsWith('blob:'));
  const looksLikePdf = isPreviewableUrl && att!.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[24px] border border-surface-container-highest bg-surface-container p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-headline-sm text-on-surface uppercase">Deposit Details</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mt-6 space-y-4 text-body-md">
          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Bank</div>
            <div className="font-display text-on-surface mt-1">{deposit.bankName}</div>
          </div>

          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Slip Reference</div>
            <div className="font-display text-on-surface mt-1">{deposit.slipReference}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Deposited By</div>
              <div className="font-display text-on-surface mt-1">{deposit.depositedBy}</div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Amount</div>
              <div className="font-display text-primary-container mt-1">Rs. {deposit.amount.toLocaleString('en-LK')}</div>
            </div>
          </div>

          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Note</div>
            <div className="text-body-sm text-on-surface mt-1">{deposit.note ?? 'No note provided'}</div>
          </div>

          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Receipt</div>
            <div className="mt-3">
              {att ? (
                <>
                  {isPreviewableUrl && !previewFailed && !looksLikePdf ? (
                    <div className="relative">
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high rounded">
                          <span className="material-symbols-outlined animate-spin text-on-surface-variant">
                            refresh
                          </span>
                        </div>
                      )}
                      <img
                        src={att}
                        alt="Deposit slip"
                        className="max-h-96 w-full object-contain rounded border border-surface-container-highest"
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                          setIsLoading(false);
                          setPreviewFailed(true);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="rounded border border-surface-container-highest bg-surface-container-high p-4 text-body-sm text-on-surface-variant">
                      {looksLikePdf ? 'PDF receipts cannot be previewed here.' : 'Receipt preview unavailable.'}
                    </div>
                  )}

                  <div className="mt-3">
                    <a
                      href={att}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-surface-container-highest px-3 py-2 text-body-sm text-primary-container hover:bg-surface-container-high transition"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Open receipt in new tab
                    </a>
                  </div>
                </>
              ) : (
                <div className="rounded border border-surface-container-highest bg-surface-container-high p-4 text-body-sm text-on-surface-variant">
                  No receipt attached.
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-surface-container-highest">
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Recorded</div>
            <div className="text-body-sm text-on-surface mt-1">{new Date(deposit.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-md bg-primary-container text-on-primary-container py-3 font-display text-headline-sm uppercase tracking-wider transition hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
