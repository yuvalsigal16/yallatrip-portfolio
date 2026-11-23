// The traveller on the app's start screen: a person with a cap and backpack walking along a dotted
// path while pins and clouds go by. Every moving part is its own element moved only by CSS transforms,
// so the phone animates it apart from the page's work and it keeps walking while the trips page loads
// (SVG/SMIL animations freeze then). Faces right; one stride cycle is --t.

const T = '.9s';

export const WALKER_CSS = `
.w-scene{--t:${T};position:relative;width:340px;height:250px;max-width:100%;overflow:hidden;direction:ltr;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
.w-scene *{box-sizing:border-box}
.w-sun{position:absolute;left:50%;top:18px;width:168px;height:168px;margin-left:-84px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,.06) 70%,transparent 71%)}
.w-loop{position:absolute;left:0;top:0;height:100%;will-change:transform}
.w-clouds{width:680px;animation:w-slide 14s linear infinite}
.w-pins{width:680px;animation:w-slide 5.4s linear infinite}
.w-ground{position:absolute;left:0;top:214px;width:744px;height:6px;will-change:transform;animation:w-ground var(--t) linear infinite;
  background:radial-gradient(circle,rgba(255,255,255,.9) 2.6px,transparent 3px) 0 0/16px 6px repeat-x}
.w-cloud{position:absolute;height:16px;border-radius:16px;background:rgba(255,255,255,.35)}
.w-cloud:before,.w-cloud:after{content:"";position:absolute;bottom:4px;border-radius:50%;background:inherit}
.w-cloud:before{left:10px;width:22px;height:22px}.w-cloud:after{left:24px;width:16px;height:16px}
.w-pin{position:absolute;top:166px;width:30px;height:40px}
.w-pin svg{display:block;width:100%;height:100%}
@keyframes w-slide{to{transform:translateX(-340px)}}
@keyframes w-ground{to{transform:translateX(-64px)}}

.w-fig{position:absolute;left:50%;top:44px;width:100px;height:172px;margin-left:-50px}
.w-shadow{position:absolute;left:22px;bottom:-4px;width:56px;height:9px;border-radius:50%;background:rgba(5,30,60,.28);animation:w-shadow calc(var(--t)/2) ease-in-out infinite}
.w-body{position:absolute;inset:0;will-change:transform;animation:w-bob calc(var(--t)/2) ease-in-out infinite}
.w-j{position:absolute;will-change:transform}
.w-thigh{left:42px;top:98px;width:16px;height:38px;border-radius:8px;transform-origin:8px 6px;animation:w-thigh var(--t) ease-in-out infinite}
.w-shin{left:1.5px;top:30px;width:13px;height:38px;border-radius:7px;transform-origin:6.5px 4px;animation:w-shin var(--t) linear infinite}
.w-shoe{left:-2px;top:32px;width:26px;height:11px;border-radius:6px 9px 4px 4px;background:#fff;border-bottom:3px solid #c9d6e3}
.w-uarm{left:43px;top:52px;width:12px;height:30px;border-radius:6px;transform-origin:6px 5px;animation:w-arm var(--t) ease-in-out infinite}
.w-farm{left:1px;top:24px;width:10px;height:27px;border-radius:5px;transform:rotate(-28deg);transform-origin:5px 3px}
.w-hand{left:0;top:22px;width:10px;height:10px;border-radius:50%;background:#f0c09a}
.back .w-thigh{animation-delay:calc(var(--t)/-2)}.back .w-shin{animation-delay:calc(var(--t)/-2)}
.front .w-uarm{animation-delay:calc(var(--t)/-2)}
.back .w-thigh,.back .w-shin{background:#1b2742}.front .w-thigh,.front .w-shin{background:#2b3d63}
.back .w-uarm,.back .w-farm{background:#d9542b}.front .w-uarm,.front .w-farm{background:#ff7a45}
.back .w-hand{background:#d9a27c}
.w-torso{position:absolute;left:0;top:0;width:100px;height:172px}
.w-torso svg,.w-head svg{display:block;width:100%;height:100%;overflow:visible}
.w-head{position:absolute;left:30px;top:4px;width:44px;height:46px}
@keyframes w-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes w-shadow{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.88)}}
@keyframes w-thigh{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(24deg)}}
@keyframes w-shin{0%{transform:rotate(4deg)}35%{transform:rotate(8deg)}55%{transform:rotate(14deg)}68%{transform:rotate(62deg)}85%{transform:rotate(34deg)}100%{transform:rotate(4deg)}}
@keyframes w-arm{0%,100%{transform:rotate(26deg)}50%{transform:rotate(-30deg)}}
@media (max-width:360px){.w-scene{transform:scale(.9);transform-origin:center top}}
@media (prefers-reduced-motion:reduce){.w-scene *{animation:none!important}}
`;

const pin = (x: number, c: string) =>
  `<div class="w-pin" style="left:${x}px"><svg viewBox="0 0 30 40"><path d="M15 39S2 25.5 2 15a13 13 0 0 1 26 0c0 10.5-13 24-13 24z" fill="${c}"/><circle cx="15" cy="15" r="5" fill="#1B73C9"/></svg></div>`;
const cloud = (x: number, y: number, w: number) => `<i class="w-cloud" style="left:${x}px;top:${y}px;width:${w}px"></i>`;
const twice = (f: (o: number) => string) => f(0) + f(340);

const limb = (side: 'back' | 'front') => `
<div class="${side}">
  <div class="w-j w-thigh"><div class="w-j w-shin"><div class="w-j w-shoe"></div></div></div>
</div>`;
const arm = (side: 'back' | 'front') => `
<div class="${side}">
  <div class="w-j w-uarm"><div class="w-j w-farm"><div class="w-j w-hand"></div></div></div>
</div>`;

export const WALKER_HTML = `<div class="w-scene" aria-hidden="true">
<div class="w-sun"></div>
<div class="w-loop w-clouds">${twice((o) => cloud(o + 30, 34, 54) + cloud(o + 210, 22, 40))}</div>
<div class="w-loop w-pins">${twice((o) => pin(o + 40, 'rgba(255,255,255,.55)') + pin(o + 250, '#ffc93c'))}</div>
<div class="w-ground"></div>
<div class="w-fig">
  <div class="w-shadow"></div>
  <div class="w-body">
    ${arm('back')}
    ${limb('back')}
    <div class="w-torso"><svg viewBox="0 0 100 172">
      <rect x="17" y="50" width="25" height="46" rx="9" fill="#e8a91c"/>
      <rect x="19" y="54" width="21" height="17" rx="6" fill="#ffc93c"/>
      <rect x="22" y="78" width="15" height="12" rx="4" fill="#ffd866"/>
      <rect x="44" y="38" width="10" height="14" rx="4" fill="#e9b48f"/>
      <path d="M36 54c0-6 5-10 12-10h4c7 0 11 4 11 11l1 41c0 4-3 7-7 7H42c-4 0-6-3-6-7z" fill="#ff7a45"/>
      <path d="M52 46h3c6 0 8 4 8 9l1 41c0 4-3 7-7 7h-5z" fill="#e8653a"/>
      <path d="M44 48c3 3 8 3 11 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>
      <path d="M42 48l-2 40" stroke="#b8441f" stroke-width="3" stroke-linecap="round"/>
      <rect x="36" y="92" width="28" height="9" rx="3" fill="#24334f"/>
    </svg></div>
    <div class="w-head"><svg viewBox="0 0 44 46">
      <ellipse cx="13" cy="25" rx="4" ry="5" fill="#e3a982"/>
      <path d="M8 22c0-10 6-16 15-16s15 6 15 15v4c0 9-6 16-15 16S8 34 8 25z" fill="#f0c09a"/>
      <path d="M37 22c2 1 4 3 4 5-1 1-3 1-4 1z" fill="#f0c09a"/>
      <path d="M8 24c-1-7 2-12 6-14l-1 9c-2 1-3 3-5 5z" fill="#4a2f22"/>
      <path d="M9 15c1-7 7-11 14-11 8 0 13 4 14 10z" fill="#ffffff"/>
      <path d="M15 6.5c3-1.6 9-1.8 12 0" stroke="#ff7a45" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M30 13h12c1 0 1 2 0 2.6L30 17z" fill="#cfe0f0"/>
      <circle cx="31" cy="24" r="1.8" fill="#2a1b12"/>
      <path d="M29 20.5h4.5" stroke="#4a2f22" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M31 32c2 1 4 1 5.5-.5" stroke="#b8664a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <circle cx="27" cy="29" r="2.4" fill="#f4a08a" opacity=".55"/>
    </svg></div>
    ${limb('front')}
    ${arm('front')}
  </div>
</div>
</div>`;
