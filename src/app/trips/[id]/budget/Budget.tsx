'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Alert } from '@/components/ui';
import { formatDayHe } from '@/lib/trips/rules';
import {
  CURRENCIES, EXPENSE_CATEGORIES, categoryOf, formatMoney, parseAmount, parseRate, settleUp, totalsByCategory, type Expense,
} from '@/lib/trips/extras';
import { addExpense, deleteExpense, saveBudget } from '@/app/trips/extras-actions';

const card = 'rounded-2xl border border-line bg-white p-4 sm:p-5';
const input = 'h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-terracotta focus:ring-4 focus:ring-terracotta/15';
const label = 'flex min-w-0 flex-col gap-1.5 text-sm font-bold';

type Person = { id: string; name: string };

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Budget(p: {
  tripId: string; meId: string; people: Person[]; homeCurrency: string; total: number | null;
  initial: Expense[]; startDate: string | null; endDate: string | null;
}) {
  const [expenses, setExpenses] = useState(p.initial);
  const [home, setHome] = useState(p.homeCurrency);
  const [total, setTotal] = useState(p.total);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shared = p.people.length > 1;
  const nameOf = (id: string | null) => p.people.find((x) => x.id === id)?.name ?? 'שותף/ה לשעבר';

  // ---- budget settings ----
  const [editBudget, setEditBudget] = useState(p.total === null && p.initial.length === 0);
  const [budgetText, setBudgetText] = useState(p.total !== null ? String(p.total) : '');
  const [homeDraft, setHomeDraft] = useState(p.homeCurrency);
  const saveSettings = () => start(async () => {
    setError(null);
    const r = await saveBudget({ tripId: p.tripId, homeCurrency: homeDraft, total: budgetText });
    if (!r.ok) { setError(r.error); return; }
    setHome(homeDraft);
    setTotal(budgetText.trim() ? parseAmount(budgetText) : null);
    setEditBudget(false);
  });

  // ---- new expense ----
  const lastRate = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of p.initial) if (!m.has(e.currency)) m.set(e.currency, e.rate);
    return m;
  }, [p.initial]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(p.initial[0]?.currency ?? p.homeCurrency);
  const [rate, setRate] = useState(String(lastRate.get(p.initial[0]?.currency ?? '') ?? 1));
  const [category, setCategory] = useState<string>('food');
  const [paidBy, setPaidBy] = useState(p.meId);
  const [split, setSplit] = useState(true);
  const [day, setDay] = useState('');
  useEffect(() => { setDay(todayLocal()); }, []);

  // Today's rates (free, updated once a day): one unit of the home currency in every other currency.
  const [live, setLive] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let gone = false;
    fetch(`/api/rates?base=${home}`).then((r) => (r.ok ? r.json() : null))
      .then((j: { rates?: Record<string, number> } | null) => { if (!gone && j?.rates) setLive(j.rates); })
      .catch(() => {});
    return () => { gone = true; };
  }, [home]);
  /** How much one unit of `c` is worth in the home currency today, as text for the rate field. */
  const liveRate = (c: string): string | null => {
    const r = live?.[c];
    if (!r || r <= 0) return null;
    const v = 1 / r;
    return String(Number(v >= 1 ? v.toFixed(4) : v.toPrecision(4)));
  };
  const [rateTouched, setRateTouched] = useState(false);
  useEffect(() => {
    // When today's rates arrive, fill the rate for the chosen currency (unless it was typed by hand).
    if (!live || rateTouched || currency === home) return;
    const r = liveRate(currency);
    if (r) setRate(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const pickCurrency = (c: string) => {
    setCurrency(c);
    setRateTouched(false);
    setRate(c === home ? '1' : liveRate(c) ?? String(lastRate.get(c) ?? ''));
  };
  // ---- quick converter: "how much is this in shekels?" ----
  const [convAmount, setConvAmount] = useState('');
  const [convCur, setConvCur] = useState(p.initial[0]?.currency && p.initial[0].currency !== p.homeCurrency ? p.initial[0].currency : 'USD');
  const converted = (() => {
    const a = parseAmount(convAmount);
    const r = liveRate(convCur);
    return a && r ? formatMoney(a * Number(r), home) : null;
  })();
  const preview = (() => {
    const a = parseAmount(amount), r = currency === home ? 1 : parseRate(rate);
    return a && r ? formatMoney(a * r, home) : null;
  })();

  const submit = () => start(async () => {
    setError(null);
    const r = await addExpense({
      tripId: p.tripId, title, category, amount, currency, rate: currency === home ? '1' : rate,
      paidBy: shared ? paidBy : p.meId, shared: shared ? split : true, spentOn: day,
    });
    if (!r.ok) { setError(r.error); return; }
    setExpenses((cur) => [r.data, ...cur].sort((a, b) => (a.spent_on < b.spent_on ? 1 : a.spent_on > b.spent_on ? -1 : 0)));
    lastRate.set(r.data.currency, r.data.rate);
    setTitle(''); setAmount('');
  });

  const remove = (e: Expense) => {
    if (!window.confirm(`למחוק את "${e.title}"?`)) return;
    setExpenses((cur) => cur.filter((x) => x.id !== e.id));
    start(async () => {
      const r = await deleteExpense({ tripId: p.tripId, id: e.id });
      if (!r.ok) { setError(r.error); setExpenses((cur) => [...cur, e]); }
    });
  };

  // ---- summary ----
  const spent = expenses.reduce((s, e) => s + e.home_amount, 0);
  const left = total !== null ? total - spent : null;
  const byCat = totalsByCategory(expenses);
  const transfers = shared ? settleUp(expenses, p.people.map((x) => x.id)) : [];
  const days = (() => {
    if (!p.startDate || !p.endDate) return null;
    const ms = Date.parse(p.endDate) - Date.parse(p.startDate);
    return Number.isFinite(ms) ? Math.round(ms / 86400000) + 1 : null;
  })();
  const groups = useMemo(() => {
    const g: { date: string; items: Expense[] }[] = [];
    for (const e of expenses) {
      const last = g[g.length - 1];
      if (last && last.date === e.spent_on) last.items.push(e); else g.push({ date: e.spent_on, items: [e] });
    }
    return g;
  }, [expenses]);

  return (
    <>
      {/* Summary */}
      <section className={`${card} flex flex-col gap-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink-2">הוצאתם עד עכשיו</p>
            <p className="text-3xl font-black">{formatMoney(spent, home)}</p>
            {total !== null && (
              <p className={`text-sm font-bold ${left !== null && left < 0 ? 'text-danger' : 'text-ink-2'}`}>
                {left !== null && left < 0 ? `חריגה של ${formatMoney(-left, home)} מהתקציב` : `נשארו ${formatMoney(left ?? 0, home)} מתוך ${formatMoney(total, home)}`}
              </p>
            )}
            {days && spent > 0 && <p className="text-sm text-muted">בממוצע {formatMoney(spent / days, home)} ליום מתוך {days} ימי הטיול</p>}
          </div>
          <button type="button" onClick={() => setEditBudget((v) => !v)} className="min-h-10 shrink-0 rounded-full border border-line px-3 text-sm font-bold hover:bg-sand">
            {total === null ? 'קביעת תקציב' : 'שינוי תקציב'}
          </button>
        </div>
        {total !== null && total > 0 && (
          <div className="h-2.5 overflow-hidden rounded-full bg-sand-2" aria-hidden="true">
            <div className={`h-full rounded-full ${spent > total ? 'bg-danger' : 'bg-[#1B73C9]'}`} style={{ width: `${Math.min(100, (spent / total) * 100)}%` }} />
          </div>
        )}
        {editBudget && (
          <div className="flex flex-col gap-3 rounded-xl bg-sand p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>תקציב לכל הטיול (לא חובה)
                <input className={input} inputMode="decimal" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder="למשל 8000" />
              </label>
              <label className={label}>המטבע שבו מסכמים
                <select className={input} value={homeDraft} onChange={(e) => setHomeDraft(e.target.value)} disabled={expenses.length > 0}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>)}
                </select>
              </label>
            </div>
            {expenses.length > 0 && <p className="text-xs text-muted">את מטבע הסיכום אפשר לבחור רק לפני ההוצאה הראשונה.</p>}
            <div><button type="button" disabled={pending} onClick={saveSettings} className="min-h-11 rounded-full bg-ink px-5 font-bold text-white disabled:opacity-50">שמירה</button></div>
          </div>
        )}
      </section>

      {/* Quick converter */}
      <section className={`${card} flex flex-col gap-3`} aria-labelledby="conv-h" data-tour="b-convert">
        <h2 id="conv-h" className="text-lg font-extrabold">💱 כמה זה ב{CURRENCIES.find((c) => c.code === home)?.label ?? home}?</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>סכום
            <input className={input} inputMode="decimal" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} placeholder="0" />
          </label>
          <label className={label}>מטבע
            <select className={input} value={convCur} onChange={(e) => setConvCur(e.target.value)}>
              {CURRENCIES.filter((c) => c.code !== home).map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-2xl font-black" aria-live="polite">{converted ? `= ${converted}` : live ? '' : 'טוענים את שער היום…'}</p>
        {liveRate(convCur) && (() => {
          const r = Number(liveRate(convCur));
          const units = r < 0.01 ? 1000 : r < 0.1 ? 100 : 1;
          return <p className="text-xs text-muted">לפי שער היום: {units.toLocaleString('he-IL')} {CURRENCIES.find((c) => c.code === convCur)?.symbol ?? convCur} = {formatMoney(units * r, home)}. מקור: ExchangeRate-API, מתעדכן פעם ביום.</p>;
        })()}
      </section>

      {/* New expense */}
      <section className={`${card} flex flex-col gap-4`}>
        <h2 className="text-lg font-extrabold">הוצאה חדשה</h2>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className={label}>על מה?
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="למשל: ארוחת ערב" />
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="סוג ההוצאה">
            {EXPENSE_CATEGORIES.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-bold ${category === c.key ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>סכום
              <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </label>
            <label className={label}>מטבע
              <select className={input} value={currency} onChange={(e) => pickCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>)}
              </select>
            </label>
          </div>
          {currency !== home && (
            <label className={label}>כמה שווה {CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency}1 ב{CURRENCIES.find((c) => c.code === home)?.label ?? home}?
              <input className={input} inputMode="decimal" value={rate} onChange={(e) => { setRate(e.target.value); setRateTouched(true); }} placeholder="למשל 1.35" />
              <span className="text-xs font-semibold text-muted">
                {liveRate(currency) ? 'מילאנו את שער היום (מתעדכן פעם ביום). אם קיבלת שער אחר בפועל, אפשר לשנות.' : 'לא הצלחנו להביא את שער היום. אפשר לכתוב את השער מאפליקציית הבנק.'}
              </span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>תאריך
              <input className={input} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            {shared && (
              <label className={label}>מי שילם?
                <select className={input} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {p.people.map((x) => <option key={x.id} value={x.id}>{x.id === p.meId ? 'אני' : x.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {shared && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-semibold">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="h-5 w-5 accent-[#1B73C9]" />
              מתחלק שווה בשווה בין כל המטיילים
            </label>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending || !title.trim() || !amount.trim()}
              className="min-h-12 rounded-full bg-terracotta px-6 font-bold text-white disabled:opacity-50">הוספת הוצאה</button>
            {preview && currency !== home && <span className="text-sm font-bold text-ink-2">= {preview}</span>}
          </div>
        </form>
      </section>

      {/* Who owes whom */}
      {shared && expenses.length > 0 && (
        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="text-lg font-extrabold">מי חייב למי</h2>
          {transfers.length === 0 ? <p className="text-ink-2">כולם מאוזנים ✓</p> : (
            <ul className="flex flex-col gap-1.5">
              {transfers.map((t, i) => (
                <li key={i} className="font-semibold">
                  {t.from === p.meId
                    ? `את/ה מעביר/ה ${formatMoney(t.amount, home)} ל${nameOf(t.to)}`
                    : t.to === p.meId
                      ? `${nameOf(t.from)} מעביר/ה לך ${formatMoney(t.amount, home)}`
                      : `${nameOf(t.from)} מעביר/ה ${formatMoney(t.amount, home)} ל${nameOf(t.to)}`}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">לפי ההוצאות שמתחלקות בין כולם. הוצאה אישית נספרת רק אצל מי ששילם.</p>
        </section>
      )}

      {/* By category */}
      {byCat.length > 0 && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="text-lg font-extrabold">לפי סוג</h2>
          {byCat.map((c) => (
            <div key={c.key} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm font-bold"><span>{c.icon} {c.label}</span><span>{formatMoney(c.total, home)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-sand-2" aria-hidden="true">
                <div className="h-full rounded-full bg-[#35A7E0]" style={{ width: `${spent ? (c.total / spent) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* List */}
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-extrabold">כל ההוצאות</h2>
        {expenses.length === 0 ? <p className="text-ink-2">עוד אין הוצאות.</p> : groups.map((g) => (
          <div key={g.date} className="flex flex-col">
            <h3 className="text-sm font-bold text-muted">{formatDayHe(g.date) ?? g.date}</h3>
            <ul className="flex flex-col divide-y divide-line">
              {g.items.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <span className="w-6 shrink-0 text-center" aria-hidden="true">{categoryOf(e.category).icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">
                      {e.currency !== home && `${formatMoney(e.amount, e.currency)} · `}
                      {shared && `${e.paid_by === p.meId ? 'שילמת' : `${nameOf(e.paid_by)} שילם/ה`}${e.shared ? '' : ' · אישי'}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold">{formatMoney(e.home_amount, home)}</span>
                  <button type="button" onClick={() => remove(e)} aria-label={`מחיקת ${e.title}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-sand-2 hover:text-danger">×</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
