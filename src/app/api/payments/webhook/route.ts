import { NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payments';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/payments/webhook — the payment provider tells us a payment succeeded.
// The signature is checked before anything else; the purchase is recorded exactly once
// (the provider's payment id is unique), so the provider may safely retry.
export async function POST(req: Request) {
  const provider = getPaymentProvider();
  if (!provider) return NextResponse.json({ error: 'payments not configured' }, { status: 503 });

  const raw = await req.text();
  let event;
  try {
    event = await provider.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  if (event.type !== 'paid') return NextResponse.json({ received: true });

  const { error } = await createAdminClient().rpc('record_paid_purchase', {
    p_buyer: event.buyerId, p_route: event.routeId, p_amount: event.amountAgorot, p_provider: provider.name, p_ref: event.ref,
  });
  if (error) {
    console.error('[webhook] record_paid_purchase', error.message);
    return NextResponse.json({ error: 'could not record' }, { status: 500 }); // provider retries later
  }
  return NextResponse.json({ received: true });
}
