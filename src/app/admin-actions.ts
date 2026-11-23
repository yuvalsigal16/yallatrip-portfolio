'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import type { FormState } from '@/lib/auth/rules';
import { parsePrice } from '@/lib/market/rules';
import { isUuid } from '@/lib/validation';
import { PAID_ROUTES } from '@/lib/features';

// Every admin action is checked again in the database (is_admin()), so a forged request does nothing.
const s = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

export async function adminSetRouteStatus(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'routeId');
  const status = s(fd, 'status');
  const note = s(fd, 'note').trim().slice(0, 500) || null;
  if (!isUuid(id) || !['published', 'rejected', 'unpublished', 'pending'].includes(status)) return { error: GENERIC_ERROR };
  if (status === 'rejected' && !note) return { fieldErrors: { note: 'כתבו ליוצר/ת למה המסלול נדחה' } };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_route_status', { p_route: id, p_status: status, p_note: note });
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: status === 'published' ? 'המסלול אושר ועלה לחנות' : 'עודכן' };
}

export async function adminSetRole(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'userId');
  const role = s(fd, 'role');
  if (!isUuid(id) || !['user', 'creator', 'admin'].includes(role)) return { error: GENERIC_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_role', { p_user: id, p_role: role });
  if (error) return { error: error.message.includes('own admin') ? 'אי אפשר להסיר לעצמך את הרשאת המנהל' : GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: 'ההרשאה עודכנה' };
}

/** Price by route length: how many days count as short, max price and commission for short / long routes. */
export async function adminSetCommission(_p: FormState, fd: FormData): Promise<FormState> {
  if (!PAID_ROUTES) return { error: 'תשלומים ועמלות כבויים כרגע (NEXT_PUBLIC_ENABLE_PAID_ROUTES)' };
  const e: Record<string, string> = {};
  const days = Number(s(fd, 'shortDays'));
  if (!Number.isInteger(days) || days < 1 || days > 60) e.shortDays = 'מספר ימים שלם בין 1 ל-60';
  const pct = (k: string) => {
    const v = Number(s(fd, k));
    if (!Number.isFinite(v) || v < 0 || v > 50) { e[k] = 'עמלה בין 0% ל-50%'; return 0; }
    return Math.round(v * 100) / 10000;
  };
  const max = (k: string) => {
    const v = parsePrice(s(fd, k));
    if (v === null || v < 500 || v > 100000) { e[k] = 'מחיר בין ₪5 ל-₪1,000'; return 0; }
    return v;
  };
  const values: [string, number][] = [
    ['short_route_max_days', days], ['short_max_price_agorot', max('shortMax')], ['long_max_price_agorot', max('longMax')],
    ['short_commission_rate', pct('shortRate')], ['long_commission_rate', pct('longRate')],
  ];
  if (Object.keys(e).length) return { fieldErrors: e };
  const supabase = await createClient();
  for (const [key, v] of values) {
    const { error } = await supabase.rpc('admin_set_setting', { p_key: key, p_value: v });
    if (error) return { error: GENERIC_ERROR };
  }
  revalidatePath('/admin');
  revalidatePath('/creator');
  return { success: 'המחירים והעמלות עודכנו. הם חלים על פרסומים ומכירות מעכשיו.' };
}

export async function adminRecordPayout(_p: FormState, fd: FormData): Promise<FormState> {
  if (!PAID_ROUTES) return { error: 'תשלומים ועמלות כבויים כרגע (NEXT_PUBLIC_ENABLE_PAID_ROUTES)' };
  const creator = s(fd, 'creatorId');
  const amount = parsePrice(s(fd, 'amount'));
  const reference = s(fd, 'reference').trim().slice(0, 200);
  if (!isUuid(creator) || !amount || amount <= 0) return { fieldErrors: { amount: 'סכום לא תקין' } };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_record_payout', { p_creator: creator, p_amount: amount, p_reference: reference || null });
  if (error) return { error: error.message.includes('larger') ? 'הסכום גבוה מהיתרה' : GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: 'התשלום ליוצר/ת נרשם' };
}

export async function adminResolveReport(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'reportId');
  const status = s(fd, 'status');
  const supabase = await createClient();
  if (!isUuid(id) || !['resolved', 'dismissed'].includes(status)) return { error: GENERIC_ERROR };
  const hideReview = s(fd, 'hideReview');
  if (hideReview && isUuid(hideReview)) await supabase.from('reviews').update({ status: 'hidden' }).eq('id', hideReview);
  const { error } = await supabase.rpc('admin_resolve_report', { p_report: id, p_status: status });
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: 'הדיווח טופל' };
}

export async function adminDecideInfluencer(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'userId');
  const approve = s(fd, 'decision') === 'approve';
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_decide_influencer', { p_user: id, p_approve: approve });
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: approve ? 'אושר/ה. עכשיו אפשר לפתוח דף יוצר ולפרסם מסלולים בתשלום' : 'הבקשה נדחתה' };
}

/** "מנויים פעילים": while off, the plan tools are open to everyone (marked "⭐ במנוי"). On: only for travellers with a plan. */
export async function adminSetSubscriptions(_p: FormState, fd: FormData): Promise<FormState> {
  const on = s(fd, 'on') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_subscriptions_active', { p_on: on });
  if (error) return { error: error.message.includes('function') ? 'המתג יעבוד אחרי השינוי במסד הנתונים' : GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: on ? 'המנויים פעילים: הכלים במנוי פתוחים רק למנויים' : 'המנויים כבויים: כל הכלים פתוחים לכולם' };
}
