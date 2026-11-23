'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Avatar } from '@/components/Avatar';
import type { TripPerson } from '@/lib/trips/queries';

type Message = { id: string; user_id: string; body: string; created_at: string };

/**
 * A chat inside a shared trip: only the people planning it can read and write.
 * New messages appear live for everyone (Supabase Realtime).
 */
export function TripChat({ tripId, meId, people }: { tripId: string; meId: string; people: TripPerson[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const byId = new Map(people.map((p) => [p.id, p]));

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) supabase.realtime.setAuth(s.session.access_token);
      const { data } = await supabase.from('trip_messages').select('id, user_id, body, created_at')
        .eq('trip_id', tripId).order('created_at', { ascending: false }).limit(200);
      if (cancelled) return;
      setMessages(((data ?? []) as Message[]).reverse());
      channel = supabase.channel(`chat-${tripId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` }, (payload) => {
          const m = payload.new as Message;
          setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
          if (!openRef.current && m.user_id !== meId) setUnread((n) => n + 1);
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tripId, meId]);

  useEffect(() => {
    if (open) { setUnread(0); list.current?.scrollTo({ top: list.current.scrollHeight }); }
  }, [open, messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setError(null);
    setText('');
    const supabase = createClient();
    const { data, error: e } = await supabase.from('trip_messages').insert({ trip_id: tripId, user_id: meId, body: body.slice(0, 2000) })
      .select('id, user_id, body, created_at').single();
    if (e || !data) { setText(body); return setError('ההודעה לא נשלחה. נסי שוב.'); }
    setMessages((ms) => (ms.some((x) => x.id === (data as Message).id) ? ms : [...ms, data as Message]));
  };

  const time = (iso: string) => new Date(iso).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-tour="chat"
        className="fixed bottom-5 left-5 z-40 flex h-14 items-center gap-2 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 font-bold text-white shadow-[0_12px_30px_-8px_rgba(27,115,201,.8)] lg:bottom-6 lg:left-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
        צ׳אט הטיול
        {unread > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-sm text-terracotta">{unread}</span>}
      </button>

      {open && (
        <section aria-label="צ׳אט הטיול" className="fixed inset-x-3 bottom-24 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:inset-x-auto sm:left-6 sm:w-[380px]">
          <header className="flex items-center justify-between bg-gradient-to-l from-[#0E4A86] to-[#1F8CD2] px-4 py-3 text-white">
            <div>
              <p className="font-extrabold">צ׳אט הטיול</p>
              <p className="text-xs text-white/80">{people.map((p) => p.name?.split(' ')[0]).filter(Boolean).join(', ')}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="סגירת הצ׳אט" className="h-9 w-9 rounded-full text-lg font-bold hover:bg-white/15">✕</button>
          </header>
          <div ref={list} className="flex min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto bg-sand p-3" aria-live="polite">
            {messages.length === 0 && <p className="m-auto text-center text-sm text-muted">עוד אין הודעות. כתבו כאן על התכנון, רק מי שבטיול רואה.</p>}
            {messages.map((m) => {
              const mine = m.user_id === meId;
              const who = byId.get(m.user_id);
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && <Avatar url={who?.avatar} name={who?.name} size={28} />}
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-[15px] ${mine ? 'rounded-bl-md bg-terracotta text-white' : 'rounded-br-md bg-white shadow-sm'}`}>
                    {!mine && <p className="text-xs font-extrabold text-terracotta">{who?.name?.split(' ')[0] ?? 'מטייל/ת'}</p>}
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[11px] ${mine ? 'text-white/75' : 'text-muted'}`}>{time(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p role="alert" className="px-3 pt-2 text-sm font-semibold text-danger">{error}</p>}
          <form className="flex items-end gap-2 border-t border-line p-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder="כתבו הודעה…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-white px-3 py-2.5 text-base" aria-label="הודעה" />
            <button type="submit" disabled={!text.trim()} className="h-11 rounded-full bg-terracotta px-4 font-bold text-white disabled:opacity-40">שליחה</button>
          </form>
        </section>
      )}
    </>
  );
}
