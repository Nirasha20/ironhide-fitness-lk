import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { generateAndSendInvoice } from './invoiceService';

// Stripe keys from environment variables (set in functions/.env.local or Cloud Functions config)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// App URL — set in functions/.env or functions/.env.production
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// Check if running in emulator mode
const isEmulator = process.env.FIRESTORE_EMULATOR_HOST !== undefined;

const db = admin.firestore();



// 1. Create Stripe Checkout Session 
export const createStripeCheckoutSession = onRequest(
  {
    cors: true,  // Let Firebase handle CORS natively
    invoker: 'public',  // Allow unauthenticated preflight (OPTIONS) requests
    secrets: ['STRIPE_SECRET_KEY'],
  },
  async (req, res) => {
    // Remove the corsHandler wrapper — no longer needed
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

      try {
        console.log('[Stripe] Request received:', { method: req.method, path: req.path });
        
        // Verify authentication — get uid from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          console.error('[Stripe] Missing auth header');
          res.status(401).json({ error: 'Unauthorized: Missing or invalid auth token' });
          return;
        }

        const token = authHeader.substring(7);
        let decodedToken;
        try {
          decodedToken = await admin.auth().verifyIdToken(token);
          console.log('[Stripe] Token verified for uid:', decodedToken.uid);
        } catch (tokenErr: any) {
          // In emulator mode, try to decode without verification
          if (isEmulator) {
            try {
              console.warn('[Stripe] Token verification failed in emulator, attempting to decode without verification');
              // Decode JWT without verification (safe in emulator mode only)
              const parts = token.split('.');
              if (parts.length !== 3) {
                throw new Error('Invalid token format');
              }
              const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              decodedToken = decoded;
              console.log('[Stripe] Token decoded (emulator mode) for uid:', decodedToken.uid);
            } catch (decodeErr: any) {
              console.error('[Stripe] Token decode failed:', decodeErr?.message);
              res.status(401).json({ error: 'Unauthorized: Invalid token', details: decodeErr?.message });
              return;
            }
          } else {
            console.error('[Stripe] Token verification failed:', tokenErr?.message);
            res.status(401).json({ error: 'Unauthorized: Invalid token', details: tokenErr?.message });
            return;
          }
        }
        

        const uid = decodedToken.uid;

        // Parse request body
        const { planId, planName, amount } = req.body as {
          planId: string;
          planName: string;
          amount: number;
        };

        console.log('[Stripe] Request body:', { planId, planName, amount });

        // Validate request body
        if (!planId || !planName || !amount) {
          console.error('[Stripe] Missing required fields');
          res.status(400).json({ error: 'Missing required fields: planId, planName, amount' });
          return;
        }

        // Get Stripe secret key from environment variable
        const stripeKey = STRIPE_SECRET_KEY;

        if (!stripeKey) {
          console.error('[Stripe] Stripe secret key not configured');
          res.status(500).json({ 
            error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' 
          });
          return;
        }

        const stripe = new Stripe(stripeKey);
        console.log('[Stripe] Stripe client initialized');

        // Stripe requires amounts in smallest currency unit
        // LKR has 2 decimal places, so multiply by 100
        const amountInCents = Math.round(amount * 100);

        console.log('[Stripe] Creating checkout session:', { amountInCents, planName });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'lkr',
                product_data: {
                  name: `IronHide Fitness — ${planName} Membership`,
                  description: `Membership plan: ${planName}`,
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${APP_URL}/verify-email?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/renew?stripe=cancelled`,
          metadata: {
            uid,
            planId,
            planName,
            amount: String(amount),
          },
          customer_email: decodedToken.email ?? undefined,
        });

        console.log('[Stripe] Session created:', session.id);
        res.status(200).json({ sessionId: session.id, url: session.url });
      } catch (err: any) {
        console.error('[Stripe] createCheckoutSession error:', err?.message || err);
        console.error('[Stripe] Error details:', err);
        res.status(500).json({ 
          error: 'Failed to create payment session. Please try again.',
          details: err?.message || 'Unknown error'
        });
        }
    }
  );

// 2. Stripe Webhook
export const stripeWebhook = onRequest(
  {
    cors: true,
    invoker: 'public',
    secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GMAIL_USER', 'GMAIL_PASS'],
  },
  async (req, res) => {
    console.log('[Stripe Webhook] Received webhook request');
    
    const sig = req.headers['stripe-signature'] as string;

    // Use environment variables directly
    const stripeKey = STRIPE_SECRET_KEY;
    const webhookSecret = STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.error('[Stripe Webhook] Missing secrets');
      res.status(500).json({ error: 'Webhook not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);

    let event: any;

    try {
      // Get raw body for signature verification
      const rawBody = (req as unknown as { rawBody: Buffer }).rawBody || 
                      Buffer.from(JSON.stringify(req.body));
      
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );
      console.log('[Stripe Webhook] Event verified:', event.type);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      res.status(400).send('Webhook signature verification failed.');
      return;
    }

    if (event.type === 'checkout.session.completed') {
      console.log('[Stripe Webhook] Processing checkout.session.completed event');
      try {
        await handlePaymentSuccess(event.data.object as any);
      } catch (err) {
        console.error('[Stripe] handlePaymentSuccess failed:', err);
        // Still return 200 to acknowledge receipt, Stripe will check payment status
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as any;
      console.warn('[Stripe] Payment failed:', pi.id, pi.last_payment_error?.message);
    }
    if (event.type === 'invoice.payment_succeeded') {
  console.log('[Stripe Webhook] Processing invoice.payment_succeeded event');
  try {
    const invoice = event.data.object as any;
    const uid = invoice.metadata?.uid ?? invoice.subscription_details?.metadata?.uid;

    if (!uid) {
      console.warn('[Stripe Webhook] No uid found in invoice metadata');
    } else {
      const memberRef = db.collection('members').doc(uid);
      const memberSnap = await memberRef.get();
      const memberData = memberSnap.data();

      if (memberData?.email) {
        await generateAndSendInvoice({
          uid,
          memberEmail:    memberData.email,
          memberName:     memberData.fullName  ?? 'Member',
          memberTIN:      memberData.tin       ?? '',
          memberPhone:    memberData.phone     ?? '',
          memberAddress:  memberData.address   ?? '—',
          plan:           memberData.membershipTier ?? 'Membership',
          amount:         (invoice.amount_paid ?? 0) / 100,
          paymentMethod:  'card',
          stripeSessionId: invoice.id,
          deliveryDate:   new Date(),
          placeOfSupply:  '114C Negombo Rd, Wattala, Sri Lanka',
        });
        console.log('[Stripe Webhook] Invoice sent for uid:', uid);
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] invoice.payment_succeeded handler failed:', err);
  }
}

    res.status(200).json({ received: true });
  }
);

// 3. Payment Success
async function handlePaymentSuccess(session: any): Promise<void> {
  console.log('[Stripe] handlePaymentSuccess called for session:', session.id);
  console.log('[Stripe] Full session object:', JSON.stringify(session, null, 2));
  console.log('[Stripe] Session payment_status:', session.payment_status);
  console.log('[Stripe] Session metadata:', session.metadata);
  
  const { uid, planId, planName, amount } = session.metadata ?? {};

  if (!uid || !planName) {
    console.error('[Stripe] Missing metadata in session:', session.id);
    console.error('[Stripe] Metadata keys:', Object.keys(session.metadata || {}));
    return;
  }

  // Only proceed if payment was actually successful
  if (session.payment_status !== 'paid') {
    console.warn('[Stripe] Session completed but payment not paid:', session.id, 'status:', session.payment_status);
    console.warn('[Stripe] Expected "paid", got:', session.payment_status);
    return;
  }

  console.log('[Stripe] Processing payment for uid:', uid, 'plan:', planName);

  const planAmount = Number(amount ?? 0);

  const durationMonths: Record<string, number> = {
    Daily: 0,
    Monthly: 1,
    Quarterly: 3,
    Annual: 12,
    'Annual — Couple': 12,
  };

  const expiry = new Date();
  if (planName === 'Daily') {
    expiry.setDate(expiry.getDate() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + (durationMonths[planName] ?? 1));
  }

  const memberRef = db.collection('members').doc(uid);
  
  // Verify member exists
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    console.error('[Stripe] Member not found for uid:', uid);
    return;
  }
  
  console.log('[Stripe] Member found, updating membership status to active...');
  
  const batch = db.batch();

  batch.update(memberRef, {
    membershipStatus: 'active',
    membershipTier: planName,
    membershipExpiry: admin.firestore.Timestamp.fromDate(expiry),
  });

  const paymentRef = memberRef.collection('payments').doc();
  batch.set(paymentRef, {
    amount: planAmount,
    plan: planName,
    planId: planId ?? '',
    method: 'card',
    status: 'confirmed',
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent ?? '',
    receiptUrl: '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const notifRef = memberRef.collection('notifications').doc();
  batch.set(notifRef, {
    message: `Your ${planName} membership has been activated via card payment! Expiry: ${expiry.toDateString()}.`,
    type: 'payment_confirmed',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await batch.commit();
    console.log(`[Stripe] Batch committed successfully. Member ${uid} membership activated.`);
  } catch (batchErr: any) {
    console.error('[Stripe] Batch commit failed:', batchErr?.message || batchErr);
    throw batchErr;
  }
  
  try {
    const memberSnap2 = await memberRef.get();
    const memberData = memberSnap2.data();

    if (!memberData?.email) {
      console.warn('[Stripe] No member email found; invoice email will not be sent.');
    } else {
      await generateAndSendInvoice({
        uid,
        memberEmail:    memberData.email,
        memberName:     memberData.fullName   ?? 'Member',
        memberTIN:      memberData.tin        ?? '',      // store TIN on member doc if you collect it
        memberPhone:    memberData.phone      ?? '',
        memberAddress:  memberData.address    ?? '—',
        plan:           planName,
        amount:         planAmount,                       // ex-VAT amount in LKR
        paymentMethod:  'card',
        stripeSessionId: session.id,
        deliveryDate:   new Date(),
        placeOfSupply:  '114C Negombo Rd, Wattala, Sri Lanka',
      });
    }
  } catch (err) {
    console.warn('[Stripe] Invoice generation/email failed (non-fatal):', err);
  }
  // FCM push notification (non-fatal)
  try {
    const memberSnap = await memberRef.get();
    const tokens: string[] = memberSnap.data()?.fcmTokens ?? [];
    if (tokens.length) {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: 'Payment Confirmed ✓',
          body: `Your ${planName} membership is now active. Expires: ${expiry.toDateString()}.`,
        },
      });
    }
  } catch (err) {
    console.warn('[Stripe] FCM push failed (non-fatal):', err);
  }
}