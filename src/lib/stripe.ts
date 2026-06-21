import { loadStripe } from '@stripe/stripe-js';
import { auth } from './firebase';


// Initialize Stripe.js with your publishable key
// This is safe to expose client-side (it's a public key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

const CLOUD_FUNCTION_URL = 'https://us-central1-ironhide-fitness.cloudfunctions.net';

interface CheckoutSessionRequest {
  planId: string;
  planName: string;
  amount: number;
  uid: string;
}

interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Initiates a Stripe Checkout session for card payments.
 *
 * Flow:
 *  1. Client calls this function with plan details
 *  2. Firebase Cloud Function creates a Stripe Checkout session
 *  3. User is redirected to Stripe's hosted checkout page
 *  4. After payment, Stripe redirects back to /payments?stripe=success
 *  5. Stripe also sends a webhook to our Cloud Function which activates the membership
 */
export async function initiateStripeCheckout(request: CheckoutSessionRequest): Promise<void> {
  try {
    console.log('[Stripe] Initiating checkout for:', request);
    
    // 1. Get Firebase ID token for authentication
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be signed in to make a payment.');
    }

    const idToken = await user.getIdToken();

    // 2. Call the Cloud Function with proper CORS headers
    console.log('[Stripe] Calling createStripeCheckoutSession Cloud Function...');
    
    const response = await fetch(
      `${CLOUD_FUNCTION_URL}/createStripeCheckoutSession`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          planId: request.planId,
          planName: request.planName,
          amount: request.amount,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Stripe] API Error response:', error);
      throw new Error(error.details || error.error || `HTTP ${response.status}: Failed to create checkout session`);
    }

    const { url, sessionId } = (await response.json()) as CheckoutSessionResponse;

    console.log('[Stripe] Checkout session created:', sessionId);

    if (!url) {
      throw new Error('No checkout URL returned from server.');
    }

    if (!sessionId) {
      throw new Error('No session ID returned from server.');
    }

    // 3. Save the session ID locally so we can verify on return
    sessionStorage.setItem('stripe_session_id', sessionId);
    sessionStorage.setItem('stripe_plan_name', request.planName);

    // 4. Redirect to Stripe Checkout
    console.log('[Stripe] Redirecting to:', url);
    window.location.href = url;
  } catch (err: any) {
    console.error('[Stripe] Checkout initiation failed:', err);
    
    if (err?.message?.includes('You must be signed in')) {
      throw new Error('You must be signed in to make a payment.');
    } else if (err?.message?.includes('Failed to fetch')) {
      console.error('[Stripe] Network error details:', {
        url: `${CLOUD_FUNCTION_URL}/createStripeCheckoutSession`,
        isLocalhost,
        hostname: window.location.hostname,
      });
      throw new Error('Could not connect to payment gateway. Make sure you have deployed the Cloud Functions or started the Firebase emulator.');
    } else if (err?.message?.includes('permission')) {
      throw new Error('Payment permission denied. Please check your account.');
    } else if (err?.message) {
      throw new Error(err.message);
    } else {
      throw new Error('Failed to initiate payment. Please check your connection and try again.');
    }
  }
}

/**
 * Alternative: redirect via Stripe.js (use if you prefer their SDK redirect)
 */
export async function redirectToStripeCheckout(sessionId: string): Promise<void> {
  const stripe = await stripePromise;
  if (!stripe) throw new Error('Stripe failed to load.');

  const { error } = await (stripe as any).redirectToCheckout({ sessionId });
  if (error) throw new Error(error.message);
}

/**
 * Returns URL params indicating Stripe payment result.
 * Call this on /payments page load.
 */
export function getStripeReturnStatus(): 'success' | 'cancelled' | null {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('stripe');
  if (status === 'success') return 'success';
  if (status === 'cancelled') return 'cancelled';
  return null;
}

/**
 * Clears Stripe session data from sessionStorage.
 */
export function clearStripeSession(): void {
  sessionStorage.removeItem('stripe_session_id');
  sessionStorage.removeItem('stripe_plan_name');
}