import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creatorShare, formatPrice, parseCreatorForm, parsePrice, parseRouteForm, stars, tierFor } from '../src/lib/market/rules';
import { signWebhook, verifyWebhookSignature } from '../src/lib/payments/signature';
import { isProtectedPath } from '../src/lib/auth/rules';

test('prices', () => {
  assert.equal(formatPrice(4900), '₪49');
  assert.equal(formatPrice(4990), '₪49.90');
  assert.equal(formatPrice(0), 'חינם');
  assert.equal(parsePrice('49'), 4900);
  assert.equal(parsePrice('₪ 49.9'), 4990);
  assert.equal(parsePrice('49.999'), null);
  assert.equal(parsePrice('-5'), null);
  assert.equal(parsePrice('abc'), null);
});
test('commission split always adds up', () => {
  assert.deepEqual(creatorShare(4900, 0.2), { platform: 980, creator: 3920 });
  const s = creatorShare(3333, 0.15);
  assert.equal(s.platform + s.creator, 3333);
});
test('route form', () => {
  const good = { title: 'רומא ב-3 ימים', description: 'מסלול מלא לשלושה ימים ברומא עם טיפים', price: '49' };
  assert.deepEqual(parseRouteForm(good), { ok: true, value: { title: good.title, description: good.description, priceAgorot: 4900 } });
  assert.equal((parseRouteForm({ ...good, free: 'on', price: 'x' }) as { value: { priceAgorot: number } }).value.priceAgorot, 0);
  const bad = parseRouteForm({ title: 'ר', description: 'קצר', price: '1' });
  assert.ok(!bad.ok && bad.fieldErrors.title && bad.fieldErrors.description && bad.fieldErrors.price);
});
test('creator form', () => {
  assert.ok(parseCreatorForm({ slug: 'Noa-Travels', displayName: 'נועה' }).ok);
  assert.ok(!parseCreatorForm({ slug: 'נועה', displayName: 'נועה' }).ok);
  assert.ok(!parseCreatorForm({ slug: '-bad-', displayName: 'נועה' }).ok);
});
test('stars', () => assert.equal(stars(4.4), '★★★★☆'));

test('webhook signatures: valid, tampered, wrong secret, too old', () => {
  const body = '{"type":"checkout.session.completed"}';
  const now = 1_790_000_000;
  const header = signWebhook(body, 'whsec_test', now);
  assert.ok(verifyWebhookSignature(body, header, 'whsec_test', now));
  assert.ok(!verifyWebhookSignature(body.replace('completed', 'expired'), header, 'whsec_test', now), 'tampered body');
  assert.ok(!verifyWebhookSignature(body, header, 'whsec_other', now), 'wrong secret');
  assert.ok(!verifyWebhookSignature(body, header, 'whsec_test', now + 3600), 'replayed an hour later');
  assert.ok(!verifyWebhookSignature(body, null, 'whsec_test', now));
  assert.ok(!verifyWebhookSignature(body, 't=abc,v1=zz', 'whsec_test', now));
});

test('creator and admin areas are protected; public creator pages are not', () => {
  assert.ok(isProtectedPath('/creator'));
  assert.ok(isProtectedPath('/admin/routes'));
  assert.ok(!isProtectedPath('/creators/noa'));
  assert.ok(!isProtectedPath('/routes/abc'));
});

test('paid routes are off unless explicitly turned on; free routes need no price', async () => {
  const { PAID_ROUTES } = await import('../src/lib/features');
  assert.equal(PAID_ROUTES, process.env.NEXT_PUBLIC_ENABLE_PAID_ROUTES === 'true');
  if (!process.env.NEXT_PUBLIC_ENABLE_PAID_ROUTES) assert.equal(PAID_ROUTES, false);
  const r = parseRouteForm({ title: 'רומא ב-3 ימים', description: 'מסלול רגוע לזוגות עם הרבה אוכל טוב', price: '', free: 'on' });
  assert.ok(r.ok && r.value.priceAgorot === 0);
});

test('tierFor: short routes (up to 5 days) up to ₪59 with 20%, long ones up to ₪149 with 30%', () => {
  for (const d of [0, 3, 5]) assert.deepEqual([tierFor(d).short, tierFor(d).maxAgorot, tierFor(d).rate], [true, 5900, 0.2]);
  for (const d of [6, 10, 180]) assert.deepEqual([tierFor(d).short, tierFor(d).maxAgorot, tierFor(d).rate], [false, 14900, 0.3]);
});
