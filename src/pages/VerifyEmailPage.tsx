import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendEmailVerification, reload, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { coupleLinkId } = (location.state as { coupleLinkId?: string }) ?? {};
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [stripeStatus, setStripeStatus] = useState<'success' | 'cancelled' | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);

  // Check for Stripe return status from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('stripe');
    if (status === 'success' || status === 'cancelled') {
      setStripeStatus(status as 'success' | 'cancelled');
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  }, [location.search]);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    setError('');
    try {
      await sendEmailVerification(user);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      setError('Could not resend. Please wait a moment and try again.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!user) return;
    setChecking(true);
    setError('');
    try {
      await reload(user);
      if (user.emailVerified) {
        navigate('/dashboard');
      } else {
        setError('Email not yet verified. Please check your inbox and click the link.');
      }
    } catch {
      setError('Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="font-display text-headline-lg text-primary-container mb-12">IRONHIDE FITNESS</div>
        
        {/* Stripe Payment Return Banner */}
        {stripeStatus === 'success' && bannerVisible && (
          <div className="mb-8 border border-green-500 bg-green-500/10 p-4 flex items-start gap-3 rounded relative">
            <span className="material-symbols-outlined text-green-400 text-2xl shrink-0">check_circle</span>
            <div className="flex-1 text-left">
              <p className="font-display text-body-lg uppercase text-green-400">Payment Successful ✓</p>
              <p className="font-body text-body-md text-on-surface-variant mt-1">
                Your card payment has been received. Now verify your email to activate your membership.
              </p>
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              className="text-on-surface-variant hover:text-on-surface shrink-0"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {stripeStatus === 'cancelled' && bannerVisible && (
          <div className="mb-8 border border-yellow-500 bg-yellow-500/10 p-4 flex items-start gap-3 rounded relative">
            <span className="material-symbols-outlined text-yellow-400 text-2xl shrink-0">info</span>
            <div className="flex-1 text-left">
              <p className="font-display text-body-lg uppercase text-yellow-400">Payment Cancelled</p>
              <p className="font-body text-body-md text-on-surface-variant mt-1">
                Your payment was not completed. No charge has been made. You can try again from the Renew page.
              </p>
            </div>
            <button
              onClick={() => setBannerVisible(false)}
              className="text-on-surface-variant hover:text-on-surface shrink-0"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
        
        <div className="bg-surface-container border-t-2 border-primary-container p-8 space-y-6">
          <div className="flex justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="font-display text-headline-lg uppercase">Verify Your Email</h1>
          <p className="font-body text-body-lg text-on-surface-variant">
            We've sent a verification link to<br />
            <span className="text-on-surface font-bold">{user?.email}</span>
          </p>
          <p className="font-body text-body-md text-on-surface-variant">
            Click the link in the email to activate your account, then press the button below. If you don't see it, <span className="text-on-surface font-bold">check your spam or junk folder</span>.
          </p>

          {error && <p className="text-error text-body-md font-body">{error}</p>}
          {resent && <p className="text-green-400 text-body-md font-body">Verification email resent.</p>}

          <div className="space-y-3">
            <Button variant="primary" size="lg" className="w-full" loading={checking} onClick={handleCheckVerified}>
              I'VE VERIFIED MY EMAIL
            </Button>
            <Button variant="ghost" size="lg" className="w-full" loading={resending} onClick={handleResend}>
              Resend Email
            </Button>
            <button onClick={handleSignOut} className="text-on-surface-variant hover:text-on-surface text-body-md font-body transition-colors w-full">
              Sign in with different account
            </button>
          </div>

          {coupleLinkId && (
            <div className="bg-surface-container-high border border-border-default p-4 space-y-2 text-left">
              <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Annual Couple — Partner Invite</p>
              <p className="font-body text-body-md text-on-surface-variant">Share this link with your partner to create their linked account:</p>
              <p className="font-body text-body-md text-on-surface break-all select-all">
                {window.location.origin}/signup?coupleLink={coupleLinkId}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
