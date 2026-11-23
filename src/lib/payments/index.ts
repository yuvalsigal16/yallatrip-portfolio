import 'server-only';
import type { PaymentProvider } from './provider';
import { stripeProvider } from './stripe';
import { PAID_ROUTES } from '@/lib/features';

/** The configured payment provider, or null when paid routes are off or not set up (free routes still work). */
export function getPaymentProvider(): PaymentProvider | null {
  if (!PAID_ROUTES) return null;
  const key = process.env.STRIPE_SECRET_KEY;
  const hook = process.env.STRIPE_WEBHOOK_SECRET;
  if (key && hook) return stripeProvider(key, hook);
  return null;
}
