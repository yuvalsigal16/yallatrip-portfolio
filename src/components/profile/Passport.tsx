import type { Stamp } from '@/lib/profile/stats';

// Ink colors for the stamps, cycling so neighbours differ.
const INKS = ['#1B73C9', '#C2481F', '#2E7D4F', '#7A3FB0', '#0B5E73', '#B0305C'];
const TILT = [-8, 5, -3, 9, -6, 3, 7, -10];
const SHAPES = ['rounded-full', 'rounded-2xl', 'rounded-[40%]'];

const fmt = (iso: string | null) => {
  if (!iso) return 'בלי תאריך';
  const [y, m] = iso.split('-');
  return `${m}/${y!.slice(2)}`;
};

/**
 * "My passport": a stamp for every destination, plus days on the road and the distance flown.
 * Pure page content: no map and nothing asked from Google.
 */
export function Passport({ stamps, daysTraveled, kmTraveled }: { stamps: Stamp[]; daysTraveled: number; kmTraveled: number }) {
  const been = stamps.filter((s) => s.status === 'been').length;
  const laps = kmTraveled / 40075;
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-white" aria-labelledby="passport-title" data-tour="passport">
      <div className="flex items-center gap-3 bg-[#0B2F55] px-6 py-4 text-white">
        <span className="text-3xl" aria-hidden="true">🛂</span>
        <div>
          <h2 id="passport-title" className="text-lg font-extrabold">הדרכון שלי</h2>
          <p className="text-sm text-white/80">חותמת לכל יעד. יעדים שעוד לא יצאת אליהם מחכים בקווים מקווקווים.</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-px bg-line text-center">
        <div className="bg-white px-2 py-3"><dd className="text-2xl font-black text-[#0B2F55]">{been}</dd><dt className="text-xs font-bold text-ink-2">חותמות</dt></div>
        <div className="bg-white px-2 py-3"><dd className="text-2xl font-black text-[#0B2F55]">{daysTraveled}</dd><dt className="text-xs font-bold text-ink-2">ימים בדרכים</dt></div>
        <div className="bg-white px-2 py-3">
          <dd className="text-2xl font-black text-[#0B2F55]">{kmTraveled.toLocaleString('he-IL')}</dd>
          <dt className="text-xs font-bold text-ink-2">ק״מ באוויר</dt>
        </div>
      </dl>
      {laps >= 0.1 && (
        <p className="border-t border-line px-6 py-2.5 text-center text-sm font-bold text-ink-2">
          🌍 זה {laps >= 1 ? `${laps.toFixed(1)} פעמים` : `${Math.round(laps * 100)}% מהדרך`} סביב כדור הארץ{daysTraveled === 0 ? ', כולל הטיולים שבדרך' : ''}
        </p>
      )}

      {stamps.length === 0 ? (
        <p className="px-6 py-6 text-center text-ink-2">הדרכון עוד ריק. החותמת הראשונה מחכה בטיול הראשון.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-4 bg-[repeating-linear-gradient(0deg,#FBF8F1,#FBF8F1_26px,#F1ECE0_27px)] px-5 py-6 sm:grid-cols-4">
          {stamps.map((s, i) => {
            const ink = INKS[i % INKS.length]!;
            const going = s.status === 'going';
            return (
              <li key={`${s.tripId}-${i}`} className="flex justify-center">
                <a href={`/trips/${s.tripId}`} aria-label={`${s.name}${going ? ', בקרוב' : ''}`}
                  className={`flex aspect-square w-full max-w-[110px] flex-col items-center justify-center gap-0.5 border-[3px] p-2 text-center no-underline ${SHAPES[i % SHAPES.length]} ${going ? 'border-dashed opacity-60' : 'border-double'}`}
                  style={{ borderColor: ink, color: ink, transform: `rotate(${TILT[i % TILT.length]}deg)` }}>
                  <span className="text-[10px] font-black tracking-widest">{going ? 'בקרוב' : 'GOTRIP'}</span>
                  <span className="line-clamp-2 text-sm font-black leading-tight">{s.name}</span>
                  <span className="text-[11px] font-bold" dir="ltr">{fmt(s.date)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
