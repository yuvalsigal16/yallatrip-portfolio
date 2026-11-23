'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';
import { parseDate, toDateString } from '@/lib/trips/rules';
import {
  isCurrency, isExpenseCategory, parseAmount, parseChecklistText, parseRate, type ChecklistItem, type Expense,
} from '@/lib/trips/extras';

// The trip checklist and the trip budget. Row Level Security lets only the people planning
// the trip read or change them; the checks here keep the input clean.

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const bad = () => fail('בקשה לא תקינה');
const SAVE_ERROR = 'לא הצלחנו לשמור. בדקו את החיבור לאינטרנט ונסו שוב.';

async function client(tripId: unknown): Promise<SupabaseClient | null> {
  if (!isUuid(tripId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

// ---------- checklist ----------
export async function addChecklistItems(input: { tripId: string; texts: string[] }): Promise<Result<ChecklistItem[]>> {
  const supabase = await client(input?.tripId);
  if (!supabase || !Array.isArray(input.texts)) return bad();
  const texts = [...new Set(input.texts.map(parseChecklistText).filter((t): t is string => Boolean(t)))].slice(0, 40);
  if (!texts.length) return fail('כתבו מה להוסיף לרשימה');
  const { data: last } = await supabase.from('trip_checklist_items').select('position')
    .eq('trip_id', input.tripId).order('position', { ascending: false }).limit(1).maybeSingle();
  const start = ((last as { position: number } | null)?.position ?? 0) + 1;
  const { data, error } = await supabase.from('trip_checklist_items')
    .insert(texts.map((text, i) => ({ trip_id: input.tripId, text, position: start + i })))
    .select('id, text, done, position');
  if (error || !data) { console.error('[checklist add]', error?.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/checklist`);
  return { ok: true, data: data as ChecklistItem[] };
}

export async function setChecklistDone(input: { tripId: string; id: string; done: boolean }): Promise<Result> {
  const supabase = await client(input?.tripId);
  if (!supabase || !isUuid(input.id) || typeof input.done !== 'boolean') return bad();
  const { error } = await supabase.from('trip_checklist_items').update({ done: input.done })
    .eq('id', input.id).eq('trip_id', input.tripId);
  if (error) { console.error('[checklist done]', error.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/checklist`);
  return { ok: true, data: null };
}

export async function deleteChecklistItem(input: { tripId: string; id: string }): Promise<Result> {
  const supabase = await client(input?.tripId);
  if (!supabase || !isUuid(input.id)) return bad();
  const { error } = await supabase.from('trip_checklist_items').delete().eq('id', input.id).eq('trip_id', input.tripId);
  if (error) { console.error('[checklist delete]', error.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/checklist`);
  return { ok: true, data: null };
}

// ---------- budget ----------
export async function saveBudget(input: { tripId: string; homeCurrency: string; total: string }): Promise<Result> {
  const supabase = await client(input?.tripId);
  if (!supabase || !isCurrency(input.homeCurrency)) return bad();
  const totalRaw = typeof input.total === 'string' ? input.total.trim() : '';
  const total = totalRaw ? parseAmount(totalRaw) : null;
  if (totalRaw && total === null) return fail('סכום התקציב לא תקין');
  const { error } = await supabase.from('trip_budgets')
    .upsert({ trip_id: input.tripId, home_currency: input.homeCurrency, total }, { onConflict: 'trip_id' });
  if (error) { console.error('[budget save]', error.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/budget`);
  return { ok: true, data: null };
}

export type ExpenseInput = {
  tripId: string; title: string; category: string; amount: string; currency: string; rate: string;
  paidBy: string | null; shared: boolean; spentOn: string;
};

export async function addExpense(input: ExpenseInput): Promise<Result<Expense>> {
  const supabase = await client(input?.tripId);
  if (!supabase) return bad();
  const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  if (!title) return fail('כתבו על מה ההוצאה');
  if (!isExpenseCategory(input.category)) return bad();
  const amount = parseAmount(input.amount);
  if (amount === null) return fail('סכום לא תקין');
  if (!isCurrency(input.currency)) return fail('מטבע לא תקין');
  const rate = parseRate(input.rate);
  if (rate === null) return fail('שער ההמרה לא תקין');
  const day = parseDate(input.spentOn);
  if (!day) return fail('תאריך לא תקין');
  if (input.paidBy !== null && !isUuid(input.paidBy)) return bad();

  const { data, error } = await supabase.from('trip_expenses').insert({
    trip_id: input.tripId, title, category: input.category, amount, currency: input.currency, rate,
    paid_by: input.paidBy, shared: input.shared !== false, spent_on: toDateString(day),
  }).select('id, title, category, amount, currency, rate, home_amount, paid_by, shared, spent_on').single();
  if (error || !data) { console.error('[expense add]', error?.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/budget`);
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: { ...(row as unknown as Expense), amount: Number(row.amount), rate: Number(row.rate), home_amount: Number(row.home_amount) },
  };
}

export async function deleteExpense(input: { tripId: string; id: string }): Promise<Result> {
  const supabase = await client(input?.tripId);
  if (!supabase || !isUuid(input.id)) return bad();
  const { error } = await supabase.from('trip_expenses').delete().eq('id', input.id).eq('trip_id', input.tripId);
  if (error) { console.error('[expense delete]', error.message); return fail(SAVE_ERROR); }
  revalidatePath(`/trips/${input.tripId}/budget`);
  return { ok: true, data: null };
}
