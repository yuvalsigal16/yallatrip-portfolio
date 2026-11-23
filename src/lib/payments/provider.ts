// The payment provider seam. Checkout + webhook are all the app needs from a provider,
// so Stripe can be swapped for an Israeli provider (PayPlus, Grow, Tranzila...) by adding one file.

export type CheckoutRequest = {
  routeId: string;
  buyerId: string;
  buyerEmail: string | null;
  title: string;
  amountAgorot: number;
  successUrl: string;
  cancelUrl: string;
};

export type WebhookEvent =
  | { type: 'paid'; ref: string; routeId: string; buyerId: string; amountAgorot: number }
  | { type: 'ignored' };

export interface PaymentProvider {
  name: 'stripe' | 'payplus' | 'grow';
  createCheckout(req: CheckoutRequest): Promise<{ url: string; ref: string }>;
  /** Throws when the signature is wrong. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
}
