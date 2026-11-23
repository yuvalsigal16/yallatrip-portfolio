'use client';

/** "I've read and accept the terms of use and the privacy policy". Links open in a new tab so the form keeps its state. */
export function TermsCheckbox({ checked, onChange, name }: { checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${checked ? 'border-terracotta bg-[#EEF6FD]' : 'border-line bg-sand'}`}>
      <input type="checkbox" name={name} value="1" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#1B73C9]" required />
      <span className="text-[15px] leading-relaxed">
        קראתי ואני מאשר/ת את{' '}
        <a href="/terms" target="_blank" rel="noopener" className="font-bold underline">תנאי השימוש</a>
        {' '}ואת{' '}
        <a href="/privacy" target="_blank" rel="noopener" className="font-bold underline">מדיניות הפרטיות</a>
        {' '}של YallaTrip.
        <span className="mt-0.5 block text-xs text-muted">צריך לאשר רק פעם אחת, בהרשמה.</span>
      </span>
    </label>
  );
}
