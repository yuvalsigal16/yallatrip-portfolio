'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import type { FormState } from '@/lib/auth/rules';
import { CREATOR_LINKS, parseCreatorForm, parseCreatorLinks, parseRouteForm, slugFromLinks, tierFor } from '@/lib/market/rules';
import { getPriceTiers, getSetting } from '@/lib/market/queries';
import { getPaymentProvider } from '@/lib/payments';
import { PAID_ROUTES } from '@/lib/features';
import { siteUrl } from '@/lib/site';
import { isUuid } from '@/lib/validation';

const s = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

async function signedIn(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user: data.user };
}

// ---------- creators ----------
const linkValues = (fd: FormData) => Object.fromEntries(CREATOR_LINKS.map((l) => [l.key, s(fd, l.key)]));

export async function becomeCreator(_p: FormState, fd: FormData): Promise<FormState> {
  const values: Record<string, string> = { slug: s(fd, 'slug'), displayName: s(fd, 'displayName'), bio: s(fd, 'bio'), ...linkValues(fd) };
  const links = parseCreatorLinks(values);
  // A page address is optional when there's at least one link (Instagram, Facebook...): one is made from it.
  const autoSlug = !values.slug!.trim();
  const linkCount = links.ok ? Object.keys(links.value).length : 1;
  const slug = autoSlug && links.ok && linkCount > 0 ? slugFromLinks(links.value, values.displayName!) : values.slug!;
  const parsed = parseCreatorForm({ ...values, slug });
  if (autoSlug && linkCount === 0) {
    return { fieldErrors: { ...(!parsed.ok ? parsed.fieldErrors : {}), slug: 'צריך כתובת דף, או לפחות קישור אחד לרשת חברתית או לאתר' }, values };
  }
  if (!parsed.ok || !links.ok) {
    const fe = { ...(!parsed.ok ? parsed.fieldErrors : {}), ...(!links.ok ? links.fieldErrors : {}) };
    if (autoSlug) delete fe.slug;
    return { fieldErrors: fe, values };
  }
  const { supabase, user } = await signedIn('/creator');
  let error = null as { code?: string } | null;
  // A made-up address that's taken gets a short ending; one the creator chose is theirs to change.
  for (let i = 0; i < (autoSlug ? 4 : 1); i++) {
    const trySlug = i === 0 ? parsed.value.slug : `${parsed.value.slug.slice(0, 34)}-${Math.random().toString(36).slice(2, 6)}`;
    ({ error } = await supabase.rpc('become_creator', { p_slug: trySlug, p_display_name: parsed.value.displayName, p_bio: parsed.value.bio }));
    if (!error || error.code !== '23505') break;
  }
  if (error) {
    if (error.code === '23505') return { fieldErrors: { slug: 'הכתובת הזו כבר תפוסה. נסו אחרת' }, values };
    return { error: GENERIC_ERROR, values };
  }
  if (Object.keys(links.value).length) await supabase.from('creators').update({ links: links.value }).eq('user_id', user.id);
  revalidatePath('/creator');
  redirect('/creator?welcome=1');
}

export async function updateCreatorProfile(_p: FormState, fd: FormData): Promise<FormState> {
  const values: Record<string, string> = { displayName: s(fd, 'displayName'), bio: s(fd, 'bio'), ...linkValues(fd) };
  const parsed = parseCreatorForm({ slug: 'placeholder-ok', ...values });
  const links = parseCreatorLinks(values);
  if (!parsed.ok || !links.ok) return { fieldErrors: { ...(!parsed.ok ? parsed.fieldErrors : {}), ...(!links.ok ? links.fieldErrors : {}) }, values };
  const { supabase, user } = await signedIn('/creator');
  const { data: me, error } = await supabase.from('creators')
    .update({ display_name: parsed.value.displayName, bio: parsed.value.bio, links: links.value }).eq('user_id', user.id).select('slug').maybeSingle();
  if (error) return { error: GENERIC_ERROR, values };
  revalidatePath('/creator');
  if (me?.slug) revalidatePath(`/creators/${me.slug}`);
  return { success: 'הפרופיל עודכן', values };
}

// ---------- publishing ----------
/** The price range for a route of this many days: short routes up to ₪59, long ones up to ₪149 (admin settings). */
async function priceLimits(supabase: Awaited<ReturnType<typeof createClient>>, days: number) {
  const [min, tiers] = await Promise.all([getSetting(supabase, 'min_price_agorot'), getPriceTiers(supabase)]);
  return { min: min ?? 500, max: tierFor(days, tiers).maxAgorot };
}

export async function publishRoute(_p: FormState, fd: FormData): Promise<FormState> {
  const values = { tripId: s(fd, 'tripId'), title: s(fd, 'title'), description: s(fd, 'description'), price: s(fd, 'price'), free: PAID_ROUTES ? s(fd, 'free') : 'on' };
  const { supabase } = await signedIn('/creator');
  if (!isUuid(values.tripId)) return { fieldErrors: { tripId: 'בחרו טיול לפרסום' }, values };
  const { count: days } = await supabase.from('trip_days').select('id', { count: 'exact', head: true }).eq('trip_id', values.tripId);
  const parsed = parseRouteForm(values, await priceLimits(supabase, days ?? 0));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  const { error } = await supabase.rpc('publish_trip', {
    p_trip_id: values.tripId, p_title: parsed.value.title, p_description: parsed.value.description, p_price_agorot: parsed.value.priceAgorot,
  });
  if (error) {
    console.error('[publishRoute]', error.message);
    const m = error.message;
    const msg = m.includes('at least 3') ? 'כדי לפרסם, צריך לפחות 3 מקומות משובצים בימים'
      : m.includes('shared trips') ? 'זה טיול משותף עם מטיילים נוספים, ולכן אי אפשר לפרסם אותו. אפשר לפרסם רק טיול שאת/ה מתכננ/ת לבד.'
      : m.includes('price out of range') ? 'המחיר גבוה מהמקסימום למסלול באורך הזה'
      : m.includes('only approved creators') ? 'פרסום מסלולים פתוח ליוצרים שאושרו'
      : m.includes('trip not found') ? 'לא מצאנו את הטיול. אפשר לפרסם רק טיול שלך'
      : GENERIC_ERROR;
    return { error: msg, values };
  }
  revalidatePath('/creator');
  revalidatePath('/routes');
  redirect('/creator?published=1');
}

export async function updateRoute(_p: FormState, fd: FormData): Promise<FormState> {
  const routeId = s(fd, 'routeId');
  const values = { title: s(fd, 'title'), description: s(fd, 'description'), price: s(fd, 'price'), free: PAID_ROUTES ? s(fd, 'free') : 'on' };
  const { supabase } = await signedIn('/creator');
  if (!isUuid(routeId)) return { error: GENERIC_ERROR };
  const unpublish = fd.get('intent') === 'unpublish';
  let v = { title: 'x', description: 'x', priceAgorot: 0 };
  if (!unpublish) {
    const { data: mine } = await supabase.from('published_trips').select('days_count').eq('id', routeId).maybeSingle();
    const parsed = parseRouteForm(values, await priceLimits(supabase, (mine as { days_count: number } | null)?.days_count ?? 0));
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
    v = parsed.value;
  }
  const { error } = await supabase.rpc('update_my_route', {
    p_route_id: routeId, p_title: v.title, p_description: v.description, p_price_agorot: v.priceAgorot, p_unpublish: unpublish,
  });
  if (error) {
    console.error('[updateRoute]', error.message);
    return { error: error.message.includes('price out of range') ? 'המחיר גבוה מהמקסימום למסלול באורך הזה' : GENERIC_ERROR, values };
  }
  revalidatePath('/creator');
  return { success: unpublish ? 'המסלול הוסר מהחנות' : 'המסלול עודכן בחנות', values };
}

// ---------- getting a route ----------
export async function getFreeRoute(fd: FormData): Promise<void> {
  const routeId = s(fd, 'routeId');
  if (!isUuid(routeId)) redirect('/routes');
  const { supabase } = await signedIn(`/routes/${routeId}`);
  const { data, error } = await supabase.rpc('acquire_free_route', { p_route: routeId });
  if (error || typeof data !== 'string') redirect(`/routes/${routeId}?error=get`);
  revalidatePath(`/routes/${routeId}`);
  redirect(`/trips/${data}?created=1`);
}

export async function buyRoute(fd: FormData): Promise<void> {
  const routeId = s(fd, 'routeId');
  if (!isUuid(routeId)) redirect('/routes');
  const { supabase, user } = await signedIn(`/routes/${routeId}`);
  // Routes are digital content, opened right after payment: no refunds, and the buyer confirms it first.
  if (fd.get('noRefund') !== '1') redirect(`/routes/${routeId}?error=no-refund`);
  const provider = getPaymentProvider();
  if (!provider) redirect(`/routes/${routeId}?error=payments-off`);
  const { data: route } = await supabase.from('routes_catalog').select('id, title, price_agorot').eq('id', routeId).maybeSingle();
  const r = route as { id: string; title: string; price_agorot: number } | null;
  if (!r || r.price_agorot <= 0) redirect(`/routes/${routeId}`);
  const { data: own } = await supabase.from('published_trips').select('id').eq('id', routeId).eq('creator_id', user.id).maybeSingle();
  if (own) redirect(`/routes/${routeId}?error=own`);
  const { data: already } = await supabase.from('purchases').select('copied_trip_id').eq('published_trip_id', routeId).eq('buyer_id', user.id).eq('status', 'paid').maybeSingle();
  if (already) redirect(`/trips/${(already as { copied_trip_id: string }).copied_trip_id}`);

  const site = await siteUrl();
  let url: string;
  try {
    ({ url } = await provider.createCheckout({
      routeId, buyerId: user.id, buyerEmail: user.email ?? null, title: r.title, amountAgorot: r.price_agorot,
      successUrl: `${site}/routes/${routeId}?purchase=success`, cancelUrl: `${site}/routes/${routeId}?purchase=cancelled`,
    }));
  } catch (e) {
    console.error('[buyRoute]', e);
    redirect(`/routes/${routeId}?error=checkout`);
  }
  redirect(url);
}

// ---------- reviews and reports ----------
export async function submitReview(_p: FormState, fd: FormData): Promise<FormState> {
  const routeId = s(fd, 'routeId');
  const rating = Number(fd.get('rating'));
  const body = s(fd, 'body').trim();
  if (!isUuid(routeId)) return { error: GENERIC_ERROR };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { fieldErrors: { rating: 'בחרו דירוג מ-1 עד 5' }, values: { body } };
  if (body.length > 2000) return { fieldErrors: { body: 'עד 2,000 תווים' }, values: { body } };
  const { supabase } = await signedIn(`/routes/${routeId}`);
  const { error } = await supabase.rpc('submit_review', { p_route: routeId, p_rating: rating, p_body: body });
  if (error) return { error: error.message.includes('only people') ? 'אפשר לדרג רק מסלול שקיבלת' : GENERIC_ERROR, values: { body } };
  revalidatePath(`/routes/${routeId}`);
  return { success: 'תודה! הדירוג נשמר', values: { body } };
}

export async function reportContent(_p: FormState, fd: FormData): Promise<FormState> {
  const targetType = s(fd, 'targetType');
  const targetId = s(fd, 'targetId');
  const reason = s(fd, 'reason').trim();
  if (!['route', 'review', 'creator', 'recommendation'].includes(targetType) || !isUuid(targetId)) return { error: GENERIC_ERROR };
  if (reason.length < 5 || reason.length > 1000) return { fieldErrors: { reason: 'ספרו לנו במשפט מה הבעיה (5–1,000 תווים)' }, values: { reason } };
  const { supabase, user } = await signedIn(s(fd, 'back') || '/routes');
  const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
  if (error) return { error: GENERIC_ERROR, values: { reason } };
  return { success: 'הדיווח נשלח לצוות. תודה!' };
}
