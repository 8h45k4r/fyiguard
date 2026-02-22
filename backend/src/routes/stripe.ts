import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

const PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe Checkout Session for Pro plan upgrade.
 * Requires authenticated user (JWT middleware).
 */
router.post('/create-checkout', async (req: Request, res: Response) => {
  try {
    const userId = (req as Record<string, unknown>).userId as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: userId,
      success_url: `${process.env.APP_URL || 'https://certifyi.ai'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'https://certifyi.ai'}/checkout/cancel`,
      metadata: { userId },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events.
 * MUST use raw body (express.raw middleware).
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'pro', stripeCustomerId: session.customer as string },
        });
        console.log(`[Stripe] User ${userId} upgraded to pro`);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(sub.customer as string);
      if (customer && !customer.deleted) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customer.id },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: 'free' },
          });
          console.log(`[Stripe] User ${user.id} downgraded to free`);
        }
      }
      break;
    }
    default:
      console.log(`[Stripe] Unhandled event: ${event.type}`);
  }

  return res.json({ received: true });
});

/**
 * GET /api/stripe/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 */
router.get('/portal', async (req: Request, res: Response) => {
  try {
    const userId = (req as Record<string, unknown>).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL || 'https://certifyi.ai'}/settings`,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[Stripe] Portal error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;