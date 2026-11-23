'use client';

// Last-resort error screen (when even the layout failed). Plain HTML on purpose.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, background: '#F3F8FC', color: '#0C2D4A' }}>
        <h1>משהו השתבש</h1>
        <p>נסו לרענן את הדף בעוד רגע.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 20px', fontWeight: 700 }}>לנסות שוב</button>
      </body>
    </html>
  );
}
