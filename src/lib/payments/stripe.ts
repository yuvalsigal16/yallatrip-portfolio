import 'server-only';
import type { CheckoutRequest, PaymentProvider, WebhookEvent } from './provider';
import { verifyWebhookSignature } from './signature';
import { isUuid } from '@/lib/validation';

// Stripe Checkout through its REST API (no SDK needed). Card data never touches our servers.
// Note: Stripe accounts are not available to businesses registered in Israel; use it via a
// company registered where Stripe operates, or add an Israeli provider behind the same interface.

function form(data: Record<string, string | number>): string {
  return new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
}

export function stripeProvider(secretKey: string, webhookSecret: string): PaymentProvider {
  return {
    name: 'stripe',
    async createCheckout(r: CheckoutRequest) {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({
          mode: 'payment',
          success_url: r.successUrl,
          cancel_url: r.cancelUrl,
          client_reference_id: r.buyerId,
          ...(r.buyerEmail && { customer_email: r.buyerEmail }),
          'line_items[0][quantity]': 1,
          'line_items[0][price_data][currency]': 'ils',
          'line_items[0][price_data][unit_amount]': r.amountAgorot,
          'line_items[0][price_data][product_data][name]': r.title.slice(0, 100),
          'metadata[route_id]': r.routeId,
          'metadata[buyer_id]': r.buyerId,
          locale: 'auto',
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
      if (!res.ok || !body.id || !body.url) throw new Error(`stripe checkout: ${body.error?.message ?? res.status}`);
      return { url: body.url, ref: body.id };
    },

    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      if (!verifyWebhookSignature(rawBody, headers.get('stripe-signature'), webhookSecret)) throw new Error('bad signature');
      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { id?: string; payment_status?: string; amount_total?: number; currency?: string; metadata?: Record<string, string> } };
      };
      const o = event.data?.object;
      if (event.type !== 'checkout.session.completed' || o?.payment_status !== 'paid') return { type: 'ignored' };
      const routeId = o.metadata?.route_id;
      const buyerId = o.metadata?.buyer_id;
      if (!o.id || !isUuid(routeId) || !isUuid(buyerId) || typeof o.amount_total !== 'number' || o.currency !== 'ils') {
        return { type: 'ignored' };
      }
      return { type: 'paid', ref: o.id, routeId, buyerId, amountAgorot: o.amount_total };
    },
  };
}
