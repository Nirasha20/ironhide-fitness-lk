import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AuthGuard } from '../components/layout/AuthGuard';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { getMembershipPlans, addPayment, updateMember } from '../lib/memberService';
import { initiateStripeCheckout, getStripeReturnStatus, clearStripeSession } from '../lib/stripe';
import { useAuth } from '../hooks/useAuth';
import type { MembershipPlan } from '../types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

function StripeReturnBanner() {
  const status = getStripeReturnStatus();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (status) {
      clearStripeSession();
      // Remove query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  }, [status]);

  if (!status || !visible) return null;

  if (status === 'success') {
    return (
      <div className="mb-8 border border-green-500 bg-green-500/10 p-4 flex items-start gap-3 relative">
        <span className="material-symbols-outlined text-green-400 text-2xl shrink-0">check_circle</span>
        <div>
          <p className="font-display text-body-lg uppercase text-green-400">Payment Successful ✓</p>
          <p className="font-body text-body-md text-on-surface-variant">
            Your card payment has been received. Your membership is being renewed — this may take a few moments.
            You'll receive a notification once it's confirmed.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8 border border-yellow-500 bg-yellow-500/10 p-4 flex items-start gap-3 relative">
      <span className="material-symbols-outlined text-yellow-400 text-2xl shrink-0">info</span>
      <div>
        <p className="font-display text-body-lg uppercase text-yellow-400">Payment Cancelled</p>
        <p className="font-body text-body-md text-on-surface-variant">
          Your payment was not completed. No charge has been made. You can try again below.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}

function RenewContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer' | 'cash' | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    getMembershipPlans()
      .then(data => setPlans(data.length ? data : [
        { id: '1', name: 'Monthly', duration: '1 month', price: 5000, features: ['24/7 Access', 'Locker Room'], isActive: true },
        { id: '2', name: 'Quarterly', duration: '3 months', price: 13500, features: ['All Monthly Features', 'Guest Passes'], isActive: true },
        { id: '3', name: 'Annual', duration: '12 months', price: 48000, features: ['Unlimited Access', 'PT Sessions'], isActive: true },
      ]))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!user || !selectedPlan || !paymentMethod) { setError('Please select a plan and payment method.'); return; }
    if (paymentMethod === 'bank_transfer' && !receiptFile) { setError('Please upload your receipt.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // Card payment via Stripe
      if (paymentMethod === 'card') {
        // This redirects the user away to Stripe Checkout.
        // Membership activation happens via the Stripe webhook Cloud Function.
        await initiateStripeCheckout({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: selectedPlan.price,
          uid: user.uid,
        });
        // Execution stops here — user is redirected to Stripe
        return;
      }
 
      let receiptUrl = '';
      if (paymentMethod === 'bank_transfer' && receiptFile) {
        const receiptRef = ref(storage, `members/${user.uid}/receipts/${Date.now()}.jpg`);
        await uploadBytes(receiptRef, receiptFile);
        receiptUrl = await getDownloadURL(receiptRef);
      }
      
      await addPayment(user.uid, {
        amount: selectedPlan.price,
        plan: selectedPlan.name,
        method: paymentMethod,
        status: paymentMethod === 'cash' ? 'pending_cash' : 'pending_verification',
        receiptUrl,
      });
      await updateMember(user.uid, {
        membershipStatus: paymentMethod === 'cash' ? 'pending_cash' : 'pending_verification',
        membershipTier: selectedPlan.name,
      });
      setDone(true);
    } catch (err: any) {
      console.error('[RenewPage] handleSubmit error:', err);
      
      // Better error handling
      const errorCode = err?.code;
      const errorMessage = err?.message;
      
      if (errorCode === 'permission-denied' || errorMessage?.includes('permission')) {
        setError('You do not have permission to update this membership. Please contact support.');
      } else if (errorCode === 'not-found') {
        setError('Member record not found. Please contact support.');
      } else if (errorCode === 'network-request-failed' || errorMessage?.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else if (paymentMethod === 'card') {
        setError('Could not connect to payment gateway. Please check your connection and try again.');
      } else {
        setError(errorMessage || 'Renewal failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <span className="material-symbols-outlined text-primary-container text-6xl">check_circle</span>
        <h2 className="font-display text-headline-lg uppercase">Renewal Submitted!</h2>
        <p className="text-body-lg text-on-surface-variant font-body max-w-md">
          {paymentMethod === 'cash' ? 'Please make payment at reception. Your membership will be activated once confirmed.' : 'Your renewal is under review. You will be notified once confirmed.'}
        </p>
        <Button variant="primary" onClick={() => navigate('/dashboard')}>BACK TO DASHBOARD</Button>
      </div>
    );
  }

  return (
    <div className="px-margin-mobile md:px-margin-desktop py-12 max-w-2xl mx-auto">
      <h1 className="font-display text-headline-lg uppercase mb-4">RENEW MEMBERSHIP</h1>
      <div className="w-24 h-1 bg-primary-container mb-12" />

      {/* Stripe Return Banner */}
      <StripeReturnBanner />

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-8">
          <div>
            <h2 className="font-display text-headline-md uppercase mb-4">Select Plan</h2>
            <div className="space-y-4">
              {plans.map(plan => (
                <div key={plan.id} onClick={() => setSelectedPlan(plan)} className={`p-6 border-2 cursor-pointer transition-all ${selectedPlan?.id === plan.id ? 'border-primary-container bg-surface-container-high' : 'border-border-default bg-surface-container hover:border-primary-container'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-display text-headline-md uppercase">{plan.name}</h3>
                      <p className="text-body-md text-on-surface-variant font-body">{plan.duration}</p>
                    </div>
                    <span className="font-display text-headline-md text-primary-container">LKR {plan.price.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display text-headline-md uppercase mb-4">Payment Method</h2>
            <div className="space-y-4">
              {([
                { method: 'card' as const, icon: 'credit_card', label: 'Card' },
                { method: 'bank_transfer' as const, icon: 'account_balance', label: 'Bank Transfer' },
                { method: 'cash' as const, icon: 'payments', label: 'Cash at Gym' },
              ]).map(opt => (
                <div key={opt.method} onClick={() => setPaymentMethod(opt.method)} className={`p-4 border-2 cursor-pointer flex items-center gap-4 transition-all ${paymentMethod === opt.method ? 'border-primary-container bg-surface-container-high' : 'border-border-default hover:border-primary-container'}`}>
                  <span className="material-symbols-outlined text-primary-container text-3xl">{opt.icon}</span>
                  <span className="font-display text-headline-md">{opt.label}</span>
                  {opt.method === 'card' && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="font-label-sm text-label-sm border border-border-default text-on-surface-variant px-2 py-1 uppercase tracking-widest">
                        Stripe
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {paymentMethod === 'card' && (
              <div className="mt-4 border border-border-default p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary-container text-xl shrink-0">lock</span>
                <div className="space-y-1">
                  <p className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Secure Payment via Stripe</p>
                  <p className="font-body text-body-md text-on-surface-variant">
                    You'll be redirected to Stripe's secure checkout page to complete your payment.
                    Your card details are never stored by IronHide Fitness— they are handled entirely by Stripe.
                  </p>
                  <p className="font-body text-body-md text-on-surface-variant">
                    Once payment is confirmed, your membership will be renewed automatically.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'bank_transfer' && (
              <div className="mt-4 border border-border-default p-4 space-y-3">
                <p className="font-body text-body-md text-on-surface-variant">Bank: Commercial Bank of Ceylon · Account: 8001234567</p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2 border border-border-default hover:border-primary-container transition-all">
                  <span className="material-symbols-outlined">upload</span>
                  <span className="font-body text-body-md">{receiptFile ? receiptFile.name : 'Upload Receipt'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="border border-error bg-error/10 p-4">
              <p className="text-error text-body-md font-body">{error}</p>
            </div>
          )}
          <Button variant="primary" size="lg" loading={submitting} onClick={handleSubmit} className="w-full">CONFIRM RENEWAL</Button>
        </div>
      )}
    </div>
  );
}

export default function RenewPage() {
  return (
    <AuthGuard>
      <PageWrapper>
        <RenewContent />
      </PageWrapper>
    </AuthGuard>
  );
}
