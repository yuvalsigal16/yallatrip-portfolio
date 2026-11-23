// The first screen of the home-screen app: a traveller walking past pins on a dotted path
// while the trips page loads, instead of a blank white screen. One self-contained HTML file (no scripts
// or styles to fetch), kept by the service worker so it shows at once, even offline.

import { WALKER_CSS, WALKER_HTML } from '@/lib/walker';

const HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1B73C9">
<meta name="robots" content="noindex">
<title>YallaTrip</title>
<style>
  html,body{margin:0;height:100%;background:#1B73C9;color:#fff;overflow:hidden}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    font-family:-apple-system,BlinkMacSystemFont,"Heebo","Segoe UI",Arial,sans-serif;
    padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}
  .name{font-size:30px;font-weight:900;letter-spacing:.5px;direction:ltr}
  .sub{font-size:16px;font-weight:600;opacity:.85}
${WALKER_CSS}
</style>
</head>
<body>
${WALKER_HTML}
<div class="name">YallaTrip</div>
<div class="sub">התכנון לטיול הבא כבר מתחיל…</div>
<script>
  // The walker keeps going (the phone animates it on its own) while the trips page loads behind it;
  // the browser keeps this screen up until that page starts drawing.
  setTimeout(function(){ location.replace('/trips'); }, 400);
</script>
</body>
</html>`;

export const dynamic = 'force-static';

export function GET() {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
