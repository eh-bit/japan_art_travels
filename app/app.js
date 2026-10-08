/* Japan 2026 — reseapp. All data sparas lokalt på enheten. */

const TAG = {
  ingar:     { l: 'Ingår',      c: '#526050', b: '#dfe7d8' },
  transport: { l: 'Transport',  c: '#3e5a60', b: '#dae6e9' },
  aktivitet: { l: 'Aktivitet',  c: '#526050', b: '#dfe7d8' },
  mat:       { l: 'Mat',        c: '#8c4e2e', b: '#f1dfd2' },
  shopping:  { l: 'Shopping',   c: '#695184', b: '#e8deef' },
  bokad:     { l: 'Bokad',      c: '#6e5b20', b: '#eee0ab' },
  fri:       { l: 'Fri tid',    c: '#746b5c', b: '#ebe5d8' },
  hotell:    { l: 'Hotell',     c: '#fff',    b: '#aaa08c' },
  egen:      { l: 'Egen',       c: '#746b5c', b: '#ebe5d8' },
  oplanerad: { l: 'Oplanerad',  c: '#4a5b6b', b: '#e3e8ea' },
  ovrigt:    { l: 'Övrigt',     c: '#746b5c', b: '#ebe5d8' }
};
const DAYS = window.DAYS;
const CITIES = window.CITIES;
const KEY = 'japan2026';
const TZ = 'Asia/Tokyo';

const S = Object.assign({ done: {}, notes: {}, places: [], times: {}, tags: {}, dismissed: {}, contacts: {},
                          days: {}, citys: {}, cnotes: {}, pimg: {}, pack: null, packCats: null },
  JSON.parse(localStorage.getItem(KEY) || '{}'));
S.contacts = S.contacts || {};
// Engångsstädning: gamla "ej klar"-värden (false/0) från tidigare versioner hindrade automatiken.
if (!S.mig2) { Object.keys(S.done).forEach(k => { if (!S.done[k]) delete S.done[k]; }); S.mig2 = 1; }
if (S.auto) { Object.keys(S.auto).forEach(k => { if (S.done[k] === 1) delete S.done[k]; }); delete S.auto; }
S.days = S.days || {}; S.citys = S.citys || {}; S.cnotes = S.cnotes || {}; S.pimg = S.pimg || {};
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

let sel = 1, filt = 'all', cat = 'alla', cur = null, mediaMode = 'bild', editTags = [];
let valdSjalv = false;   // true så fort användaren själv valt en dag
const mins = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
const pad = n => String(n).padStart(2, '0');
const miniTxt = k => ((S.notes[k] || '').trim() || (IDX[k] && IDX[k].m) || '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Tid ---------- */
function now() {
  const sim = sessionStorage.getItem('simtime');
  return sim ? new Date(sim) : new Date();
}
const jp = (d, o) => new Intl.DateTimeFormat('sv-SE', Object.assign({ timeZone: TZ }, o)).format(d);

/* Äldre egna platser sparade anteckningen i p.note. Nu finns den bara som S.notes[id]. */
function migreraNoter() {
  let andrat = false;
  S.places.forEach(p => {
    if (p.url && /(google\.[a-z.]+\/maps|maps\.apple\.com)/i.test(p.url)) { if (!p.mapUrl) p.mapUrl = p.url; p.url = ''; andrat = true; }
  });
  S.places.forEach(p => {
    if (p.note) { if (!S.notes[p.id]) S.notes[p.id] = p.note; delete p.note; andrat = true; }
  });
  if (andrat) save();
}
/* ---------- Index över alla punkter ---------- */
const IDX = {};
function buildIndex() {
  for (const k in IDX) delete IDX[k];
  DAYS.forEach(d => d.acts.forEach((a, i) =>
    IDX['d' + d.n + '-' + i] = Object.assign({}, a, { dayN: d.n, date: d.date })));
  S.places.forEach(p => IDX[p.id] = {
    t: p.t, n: p.name, m: p.addr || '', d: p.addr || '',
    g: ['egen', p.cat], dayN: p.day, cityN: p.city, i: '📍', own: 1,
    lat: p.lat, lng: p.lng, photo: p.photo, credit: p.credit, mapUrl: p.mapUrl,
    L: p.url ? [['Öppna länken', p.url]] : []
  });
  Object.keys(IDX).forEach(k => {
    const a = IDX[k];
    if (S.times[k]) a.t = S.times[k];
    if (S.tags[k]) a.g = S.tags[k].slice();
    if (S.pimg[k]) { a.photo = S.pimg[k].id; a.credit = S.pimg[k].credit; }   // eget foto på programpunkt
    // Flyttad till annan dag, eller lossad från schemat och knuten till en ort
    if (S.days[k] !== undefined) a.dayN = S.days[k];
    if (S.citys[k] !== undefined) a.cityN = S.citys[k];
    if (a.dayN) { a.cityN = a.cityN || 0; }
    else if (a.cityN && !a.g.includes('oplanerad')) a.g = a.g.concat('oplanerad');
    a.date = a.dayN ? (DAYS.find(x => x.n === a.dayN) || {}).date : null;
  });
}
const tagHtml = g => (g || []).map(k => {
  const t = TAG[k];
  return t ? `<span class="tg" style="color:${t.c};background:${t.b}">${t.l}</span>` : '';
}).join('');

/* Filtergrupper för egna platser. Medlemskap följer taggarna (IDX[id].g), så ändrade taggar slår igenom direkt.
   Oplanerad är härledd: en punkt utan dag räknas dit. */
const GROUPS = ['oplanerad', 'mat', 'aktivitet', 'shopping', 'ovrigt'];
const inGroup = (p, k) => {
  const a = IDX[p.id] || {};
  return k === 'oplanerad' ? !a.dayN : (a.g || ['egen', p.cat]).includes(k);
};
const groupChips = (cur, fn, places) =>
  [['alla', 'Alla']].concat(GROUPS.map(k => [k, TAG[k].l])).map(([k, l]) => {
    const n = k === 'alla' ? places.length : places.filter(p => inGroup(p, k)).length;
    return `<button class="fch ${cur === k ? 'on' : ''}" onclick="${fn}('${k}')">${l} ${n}</button>`;
  }).join('');

/* ---------- Navigering ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-' + b.dataset.s).classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
  if (b.dataset.s === 'plan' && !keepSel) goToday();   // Resplan öppnas alltid på dagens datum
  keepSel = false;
});
document.querySelectorAll('#minaseg button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#minaseg button').forEach(x => x.classList.toggle('on', x === b));
  const v = b.dataset.v;
  document.getElementById('mina-platser').style.display = v === 'platser' ? '' : 'none';
  document.getElementById('mina-packning').style.display = v === 'packning' ? '' : 'none';
  document.getElementById('mina-info').style.display = v === 'info' ? '' : 'none';
  document.getElementById('minaSub').textContent =
    v === 'platser' ? 'Egna tips utanför programmet'
    : v === 'packning' ? 'Packning inför resan' : 'Kontakter, flyg och hotell';
  if (v === 'packning') drawPack();
  document.getElementById('scroll').scrollTop = 0;
});

/* ---------- Resplan ---------- */
let keepSel = false;   // true när en annan funktion själv valt dag och sedan öppnar Resplan
function goToday() {
  const d = todayDay();
  if (d == null) return;
  sel = d; valdSjalv = false; drawChips(); drawActs();
}
function todayDay() {
  const iso = jp(now(), { year: 'numeric', month: '2-digit', day: '2-digit' });
  const d = DAYS.find(x => x.date === iso);
  return d ? d.n : null;
}
function drawChips() {
  const td = todayDay();
  document.getElementById('chips').innerHTML = DAYS.map(d =>
    `<div class="chip ${d.n === sel ? 'sel' : ''} ${d.n === td ? 'today' : ''}" onclick="pick(${d.n})">
      <div class="d">${d.n}</div><div class="dt">${d.dl.split(' ')[0]}/10</div></div>`).join('');
  const el = document.querySelector('.chip.sel');
  // Rullar bara chipsraden i sidled. scrollIntoView skulle dra med sig hela sidan.
  if (el) {
    const c = document.getElementById('chips');
    c.scrollLeft = el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2;
  }
}
function pick(n) { sel = n; valdSjalv = true; drawChips(); drawActs(); }
function drawFilters() {
  let h = [['all', 'Alla'], ['todo', 'Kvar']].map(([k, l]) =>
    `<button class="fch ${filt === k ? 'on' : ''}" onclick="setFilt('${k}')">${l}</button>`).join('');
  h += Object.keys(TAG).filter(k => k !== 'oplanerad').map(k => {
    const t = TAG[k];
    const st = filt === k ? `background:${t.c};border-color:${t.c};color:#fff`
                          : `background:${t.b};border-color:${t.b};color:${t.c}`;
    return `<button class="fch" style="${st}" onclick="setFilt('${k}')">${t.l}</button>`;
  }).join('');
  document.getElementById('filtchips').innerHTML = h;
}
function setFilt(f) { filt = f; drawFilters(); drawActs(); }

function drawActs() {
  const d = DAYS.find(x => x.n === sel);
  drawWeatherDay(d);
  let list = Object.keys(IDX).filter(k => IDX[k].dayN === sel)
    .map(k => Object.assign({ k }, IDX[k])).sort((a, b) => mins(a.t) - mins(b.t));
  let curK = null;
  if (sel === todayDay()) { const m = mins(jp(now(), { hour: '2-digit', minute: '2-digit' })); list.forEach(a => { if (mins(a.t) <= m) curK = a.k; }); }
  const nDone = list.filter(a => isDone(a.k)).length;
  document.getElementById('dayhead').innerHTML =
    `<h2>${esc(d.title)}</h2><p>Dag ${d.n} · ${d.wd} ${d.dl} · ${esc(d.city)}</p>` + (list.length ?
    `<div class="phead"><span>Dagens program</span><span>${nDone} av ${list.length} klara</span></div>
     <div class="track" style="grid-template-columns:repeat(${list.length},1fr)">${list.map(a => `<i class="${isDone(a.k) ? 'done' : a.k === curK ? 'now' : ''}"></i>`).join('')}</div>` : '');
  if (filt === 'todo') list = list.filter(a => !isDone(a.k));
  else if (filt !== 'all') list = list.filter(a => (a.g || []).includes(filt));
  document.getElementById('acts').innerHTML = list.length ? list.map(a => {
    const dn = isDone(a.k), nt = S.notes[a.k];
    const own = a.photo && PHOTOS[a.photo];
    const thumb = own ? `<img class="athumb" src="${own}" alt="">`
      : a.img ? `<img class="athumb" src="img/${a.img}.jpg" alt="">`
      : `<div class="athumb ph">${a.i || '📍'}</div>`;
    return `<div class="act ${dn ? 'done' : ''} ${a.k === curK ? 'current' : ''}" onclick="openAct('${a.k}')">
      <div class="tick"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M4 12.5l5.5 5.5L20 7"/></svg></div>
      ${thumb}
      <div class="abody"><div class="at">${a.t}</div><div class="an">${esc(a.n)}</div>
      ${a.m ? `<div class="ameta">${esc(a.m)}</div>` : ''}
      ${(nt || '').trim() ? `<div class="ameta mnote">${esc(nt.trim())}</div>` : ''}
      <div class="tags">${tagHtml(a.g)}</div></div></div>`;
  }).join('') : '<div class="empty"><div class="e">✓</div><p>Inget matchar filtret.</p></div>';
}

/* ---------- Väder ----------
   Prognosen kräver nät och sparas med tidsstämpel. Normalvärdena ligger i
   data.js och fungerar offline, så det finns alltid något att visa. */
const WXKEY = 'japan2026_wx';
let WX = JSON.parse(localStorage.getItem(WXKEY) || '{"at":0,"d":{},"h":{}}');
const wxSave = () => localStorage.setItem(WXKEY, JSON.stringify(WX));
const WXKOD = {
  0: ['☀️', 'Klart'], 1: ['🌤', 'Mest klart'], 2: ['⛅', 'Växlande moln'], 3: ['☁️', 'Mulet'],
  45: ['🌫', 'Dimma'], 48: ['🌫', 'Dimma'],
  51: ['🌦', 'Duggregn'], 53: ['🌦', 'Duggregn'], 55: ['🌦', 'Duggregn'],
  61: ['🌧', 'Regn'], 63: ['🌧', 'Regn'], 65: ['🌧', 'Kraftigt regn'],
  71: ['🌨', 'Snö'], 73: ['🌨', 'Snö'], 75: ['🌨', 'Snö'],
  80: ['🌦', 'Skurar'], 81: ['🌦', 'Skurar'], 82: ['🌦', 'Kraftiga skurar'],
  95: ['⛈', 'Åska'], 96: ['⛈', 'Åska'], 99: ['⛈', 'Åska']
};
const wxIkon = k => (WXKOD[k] || ['🌤', 'Växlande'])[0];
const wxText = k => (WXKOD[k] || ['🌤', 'Växlande'])[1];
const FARSK = 24 * 3600 * 1000;      // prognos äldre än ett dygn används inte

// Vilka orter en dag tillbringas i. Två betyder att dagen är delad.
function cityOfDay(n) {
  return CITIES.filter(c => c.d1 <= n && n <= c.d2)
    .sort((a, b) => (a.d2 - a.d1) - (b.d2 - b.d1) || a.n - b.n);
}
// Klockslaget då gruppen byter ort: transporten mellan sista punkten på A och första på B.
function bytTid(d, a, b) {
  const avst = (act, c) => Math.hypot(act.lat - c.lat, (act.lng - c.lng) * .8);
  const vems = act => act.lat == null ? null : (avst(act, a) <= avst(act, b) ? 'a' : 'b');
  const acts = d.acts;
  let sistA = -1, forstB = -1;
  acts.forEach((x, i) => {
    const v = vems(x);
    if (v === 'a') sistA = i;
    if (v === 'b' && forstB < 0) forstB = i;
  });
  const slut = forstB < 0 ? acts.length : forstB;
  for (let i = sistA + 1; i < slut; i++)
    if ((acts[i].g || []).includes('transport')) return acts[i].t;
  if (forstB >= 0) return acts[forstB].t;
  for (let i = sistA + 1; i < acts.length; i++)
    if ((acts[i].g || []).includes('transport')) return acts[i].t;
  return '15:00';
}

async function wxHamta() {
  if (!navigator.onLine) return false;
  try {
    for (const c of CITIES) {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max' +
        '&timezone=Asia%2FTokyo&forecast_days=16';
      const r = await (await fetch(u)).json();
      WX.d[c.n] = {};
      r.daily.time.forEach((dag, i) => {
        const mx = r.daily.temperature_2m_max[i], mn = r.daily.temperature_2m_min[i];
        // Prognosens sista dygn kan sakna v\u00e4rden \u2014 d\u00e5 \u00e4r normalv\u00e4rdet b\u00e4ttre \u00e4n noll
        if (mx == null || mn == null) return;
        WX.d[c.n][dag] = {
          max: Math.round(mx), min: Math.round(mn),
          kod: r.daily.weather_code[i],
          regn: r.daily.precipitation_probability_max[i]
        };
      });
    }
    WX.at = Date.now(); wxSave();
    return true;
  } catch (e) { return false; }
}

// Delar upp ett dygn i perioder. Behövs bara för delade dagar.
async function wxTimmar(c, datum, fran, till) {
  const nyckel = `${c.n}|${datum}|${fran}|${till}`;
  if (WX.h[nyckel] && Date.now() - WX.at < FARSK) return WX.h[nyckel];
  if (!navigator.onLine) return null;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
      '&hourly=temperature_2m,weather_code,precipitation_probability' +
      `&timezone=Asia%2FTokyo&start_date=${datum}&end_date=${datum}`;
    const h = (await (await fetch(u)).json()).hourly;
    const idx = h.time.map((t, i) => [+t.slice(11, 13), i])
      .filter(([tim]) => tim >= fran && tim < till).map(([, i]) => i);
    if (!idx.length) return null;
    const temps = idx.map(i => h.temperature_2m[i]);
    const koder = idx.map(i => h.weather_code[i]);
    const v = {
      max: Math.round(Math.max(...temps)), min: Math.round(Math.min(...temps)),
      kod: koder.slice().sort((a, b) =>
        koder.filter(x => x === b).length - koder.filter(x => x === a).length)[0],
      regn: Math.max(...idx.map(i => h.precipitation_probability[i]))
    };
    WX.h[nyckel] = v; wxSave();
    return v;
  } catch (e) { return null; }
}

const wxPrognos = (c, datum) =>
  (Date.now() - WX.at < FARSK && (WX.d[c.n] || {})[datum]) || null;
const wxNormal = (c, datum) => (c.norm || {})[datum.slice(5)] || null;

function wxRad(c, datum, etikett) {
  const p = wxPrognos(c, datum);
  if (p) return `<div class="wx"><div class="ic">${wxIkon(p.kod)}</div>
    <div class="b"><div class="t">${wxText(p.kod)}${p.regn >= 30 ? ' · ' + p.regn + '% regn' : ''}</div>
    <div class="m">${esc(etikett || c.name)} · prognos</div></div>
    <div class="tm"><div class="dg">${p.max}°</div><div class="nt">natt ${p.min}°</div></div></div>`;
  const n = wxNormal(c, datum);
  if (!n) return '';
  return `<div class="wx norm"><div class="ic">${n[2] >= 50 ? '🌦' : '🌤'}</div>
    <div class="b"><div class="t">Normalt för årstiden</div>
    <div class="m">${esc(etikett || c.name)} · sjuårsmedel${n[2] >= 50 ? ' · regn vanligt' : ''}</div></div>
    <div class="tm"><div class="dg">${Math.round(n[0])}°</div>
    <div class="nt">natt ${Math.round(n[1])}°</div></div></div>`;
}

async function drawWeatherDay(d) {
  const box = document.getElementById('wxday');
  const orter = cityOfDay(d.n);
  if (!orter.length) { box.innerHTML = ''; return; }
  if (orter.length === 1) { box.innerHTML = wxRad(orter[0], d.date); return; }

  const [a, b] = orter;
  const byt = bytTid(d, a, b);
  const tim = +byt.slice(0, 2);
  const pa = await wxTimmar(a, d.date, 7, tim);
  const pb = await wxTimmar(b, d.date, tim, 24);
  if (pa && pb) {
    const rad = (c, p, fran, till, txt) => `<div class="wxleg">
      <div class="pd">${pad(fran)}–${pad(till)}<br>${esc(c.name.split(' och ')[0])}</div>
      <div class="ic">${wxIkon(p.kod)}</div>
      <div class="b"><div class="t">${wxText(p.kod)}</div><div class="m">${txt}</div></div>
      <div class="tm">${p.max}°</div></div>`;
    box.innerHTML = `<div class="wxsplit">
      ${rad(a, pa, 7, tim, 'Fram till avfärd' + (pa.regn >= 30 ? ' · ' + pa.regn + '% regn' : ''))}
      ${rad(b, pb, tim, 24, 'Kväll och natt · ner mot ' + pb.min + '°')}</div>`;
    return;
  }
  // Utan timprognos blir det en normalrad per ort
  const norm = (c) => {
    const n = wxNormal(c, d.date);
    return n ? `<div class="wxleg"><div class="pd">${esc(c.name.split(' och ')[0])}</div>
      <div class="ic">${n[2] >= 50 ? '🌦' : '🌤'}</div>
      <div class="b"><div class="t">Normalt ${Math.round(n[0])}° / natt ${Math.round(n[1])}°</div>
      <div class="m">sjuårsmedel</div></div></div>` : '';
  };
  const h = norm(a) + norm(b);
  box.innerHTML = h ? `<div class="wxsplit norm">${h}</div>` : '';
}

/* ---------- Resrutten ---------- */
/* Fast utsnitt runt de nio orterna. Konstanterna är desamma i build_assets.py,
   så appen aldrig begär en kartruta som inte finns nedladdad. */
const RZ = 7, RPAD = 64, RASPECT = .88, RTALL = 300;
let routeV = null;

function worldPx(lat, lng, z) {
  const n = 2 ** z * 256, lr = lat * Math.PI / 180;
  return { x: (lng + 180) / 360 * n,
           y: (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n };
}
function routeView(w, h) {
  const pts = CITIES.map(c => Object.assign({ n: c.n }, worldPx(c.lat, c.lng, RZ)));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const vw = Math.max(...xs) - Math.min(...xs) + RPAD * 2, vh = vw * RASPECT;
  const ox = Math.min(...xs) - RPAD, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - vh / 2;
  const s = Math.max(w / vw, h / vh);
  // Remsan får vara precis så hög att alla nio punkter ryms med sina cirklar.
  const short = Math.min(h, Math.round((Math.max(...ys) - Math.min(...ys)) * s) + 34);
  return { pts, vw, vh, ox, oy, s, short, dx: (w - vw * s) / 2, dy: (h - vh * s) / 2 };
}
function routeMapHtml(w, h, opts) {
  opts = opts || {};
  const v = routeView(w, h);
  let t = '';
  for (let tx = Math.floor(v.ox / 256); tx <= Math.floor((v.ox + v.vw) / 256); tx++)
    for (let ty = Math.floor(v.oy / 256); ty <= Math.floor((v.oy + v.vh) / 256); ty++)
      t += `<img class="tl" src="tiles/${RZ}/${tx}/${ty}.png" alt=""
             style="left:${Math.round(tx * 256 - v.ox)}px;top:${Math.round(ty * 256 - v.oy)}px">`;
  const at = p => [(p.x - v.ox) * v.s + v.dx, (p.y - v.oy) * v.s + v.dy];
  const line = v.pts.map(p => at(p).map(Math.round).join(',')).join(' ');
  const dots = opts.dots === false ? '' : v.pts.map(p => {
    const [x, y] = at(p);
    const st = cityStatus(CITIES.find(c => c.n === p.n));
    return `<div class="rdot ${st === 'visited' ? 'visited' : ''} ${p.n === routeSel ? 'on' : ''}" style="left:${Math.round(x)}px;top:${Math.round(y)}px"
      onclick="selectCity(${p.n})">${p.n}</div>`;
  }).join('');
  if (opts.keep) routeV = v;
  return `<div class="rmap" style="height:${h}px;--dx:${v.dx}px;--dy:${v.dy}px;--s:${v.s}">
    <div class="layer" style="width:${Math.round(v.vw)}px;height:${Math.round(v.vh)}px">${t}</div>
    <div class="ovl"><svg>
      <polyline points="${line}" fill="none" stroke="#fff" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
      <polyline points="${line}" fill="none" stroke="#d9564f" stroke-width="2.6"
        stroke-dasharray="3,5.5" stroke-linecap="round"/></svg>${dots}</div>
    ${opts.att === false ? '' : '<div class="satt">© OpenStreetMap</div>'}</div>`;
}

function drawRoute() {
  document.getElementById('routecard').innerHTML =
    `<div class="routecard" onclick="openRoute()">
      <div class="rthumb">${routeMapHtml(84, 66, { dots: false, att: false })}</div>
      <div class="rb">
        <div class="lb">Resrutten</div>
        <div class="t">${CITIES.length} städer · ${esc(CITIES[0].name)} → ${esc(CITIES[CITIES.length - 1].name)}</div>
        <div class="m">Karta och fakta om varje stad</div>
      </div><div class="arr">›</div></div>`;
}
function cityStatus(c) {
  let n = todayDay();
  if (n == null) n = jp(now(), { year: 'numeric', month: '2-digit', day: '2-digit' }) < DAYS[0].date ? 0 : 999;
  return c.d2 < n ? 'visited' : (c.d1 <= n && n <= c.d2 ? 'now' : 'next');
}
let routeSel = null;
const cityDagar = c => c.d1 === c.d2 ? 'Dag ' + c.d1 : 'Dagar ' + c.d1 + '–' + c.d2;
function drawCities() {
  document.getElementById('ruttSub').textContent =
    `${CITIES.length} städer · ${CITIES[0].name} till ${CITIES[CITIES.length - 1].name}`;
  if (routeSel == null) routeSel = (CITIES.find(c => cityStatus(c) === 'now') || CITIES[0]).n;
  document.getElementById('citylist').innerHTML = CITIES.map(c => {
    const st = cityStatus(c);
    return `<div class="city-row ${st === 'visited' ? 'visited' : ''} ${c.n === routeSel ? 'active' : ''}" id="city-${c.n}" onclick="selectCity(${c.n})">
      <b>${c.n}</b><h3>${esc(c.name)}</h3><span>${cityDagar(c)}</span></div>`;
  }).join('');
  const c = CITIES.find(x => x.n === routeSel), st = cityStatus(c);
  document.getElementById('selcard').innerHTML =
    `<div class="selected-card" onclick="openCity(${c.n})"><img src="img/${c.img}.jpg" alt="">
      <div class="selected-copy"><small>${cityDagar(c)} · ${esc(c.dl.replace(/^Dag(ar)?\s[^·]*·\s*/, ''))}</small><h2>${esc(c.name)}</h2><p>${esc(c.txt)}</p>
      <span class="visited-label">${st === 'visited' ? 'Besökt' : st === 'now' ? 'Nuvarande destination' : 'Kommande'} · tryck för mer</span></div></div>`;
  document.querySelectorAll('.rdot').forEach(e => e.classList.toggle('on', +e.textContent === routeSel));
}
function selectCity(n) { routeSel = n; drawCities(); }

/* ---------- Stadskort ---------- */
let curCity = null, cyFilt = 'alla', cyMedia = 'bild';

function openCity(n) {
  curCity = n; cyMedia = 'bild';
  const c = CITIES.find(x => x.n === n);
  const natter = c.d2 - c.d1 + 1;
  document.getElementById('cyT').textContent = c.name;
  document.getElementById('cyM').textContent = `${c.dl} · ${natter} ${natter === 1 ? 'dag' : 'dagar'}`;
  document.getElementById('cyD').textContent = c.txt;
  document.getElementById('cyN').value = S.cnotes[n] || '';
  drawCityNoteView();
  setCityEdit(false);
  document.getElementById('cyL').innerHTML =
    `<a href="${c.url}" target="_blank" rel="noopener">↗ ${esc(c.lk)}</a>`;
  drawCityMedia();
  drawCityWx(c);
  drawCityPlaces();
  document.getElementById('citysheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
}
function setCityMedia(m) { cyMedia = m; drawCityMedia(); }
// Samma konstanter som i build_assets.py, annars saknas rutorna offline.
const CYZ = 12, CYW = 560, CYH = 210;
function drawCityMedia() {
  const c = CITIES.find(x => x.n === curCity), el = document.getElementById('cyMedia');
  const kart = cyMedia === 'karta';
  const inner = kart
    ? tileMap(c.lat, c.lng, CYZ, CYW, CYH, false)
    : `<img src="img/${c.img}.jpg" alt="">`;
  const nat = c.d2 - c.d1 + 1;
  el.classList.toggle('mapmode', kart);
  el.innerHTML = inner + `<div class="hshade hov"></div>
    <div class="hcopy hov"><div class="htype">Plats ${pad(c.n)} · ${cityDagar(c)}</div><h2>${esc(c.name)}</h2>
    <p>${esc(c.dl)} · ${nat} ${nat === 1 ? 'dag' : 'dagar'}</p></div>
    <div class="mtoggle">
    <button class="${cyMedia === 'bild' ? 'on' : ''}" onclick="setCityMedia('bild')">Bild</button>
    <button class="${cyMedia === 'karta' ? 'on' : ''}" onclick="setCityMedia('karta')">Karta</button></div>`;
}
function drawCityWx(c) {
  const dagar = DAYS.filter(d => c.d1 <= d.n && d.n <= c.d2);
  document.getElementById('cyWx').innerHTML = dagar.map(d => {
    const p = wxPrognos(c, d.date), n = wxNormal(c, d.date);
    const v = p || (n ? { max: Math.round(n[0]), min: Math.round(n[1]), kod: n[2] >= 50 ? 61 : 1 } : null);
    if (!v) return '';
    return `<div class="wxd ${p ? 'prognos' : ''}"><div class="dd">${d.wd.slice(0, 3)} ${d.dl.split(' ')[0]}</div>
      <div class="ii">${wxIkon(v.kod)}</div><div class="tt">${v.max}°</div><div class="nn">${v.min}°</div></div>`;
  }).join('') || '<p class="hint">Inga väderuppgifter för de här dagarna.</p>';
}
function setCyFilt(f) { cyFilt = f; drawCityPlaces(); }
function drawCityPlaces() {
  const egna = S.places.filter(p => {
    const a = IDX[p.id] || {};
    return p.city === curCity || (a.dayN && cityOfDay(a.dayN).some(c => c.n === curCity));
  });
  document.getElementById('cyFilt').innerHTML = groupChips(cyFilt, 'setCyFilt', egna);
  const lista = egna.filter(p => cyFilt === 'alla' || inGroup(p, cyFilt));
  const ic = { mat: '🍜', aktivitet: '🖼️', shopping: '🛍️', ovrigt: '📍' };
  document.getElementById('cyPlaces').innerHTML = lista.length ? lista.map(p => {
    const a = IDX[p.id] || {}, d = DAYS.find(x => x.n === a.dayN);
    return `<div class="mini" onclick="openAct('${p.id}')" style="cursor:pointer">
      ${p.photo && PHOTOS[p.photo] ? `<img class="pthumb" src="${PHOTOS[p.photo]}" alt="">`
        : `<div class="ico">${ic[p.cat] || '📍'}</div>`}
      <div class="mb"><div class="mn">${esc(p.name)}</div>
      <div class="mm">${d ? 'Dag ' + d.n + ' · ' + a.t : 'Ingen tid satt'}</div>
      ${(S.notes[p.id] || '').trim() ? `<div class="mm mnote">${esc(S.notes[p.id].trim())}</div>` : ''}</div>
      <div class="tags" style="margin-top:0">${tagHtml((a.g || [p.cat]).filter(k => k !== 'egen'))}</div></div>`;
  }).join('') : `<p class="hint">Inget här än${cyFilt !== 'alla' ? ' under det filtret' : ''}.</p>`;
}
// Stadskortet öppnas i visningsläge. Anteckningen går bara att ändra efter tryck på Redigera.
function setCityEdit(on) { document.getElementById('citysheet').classList.toggle('view', !on); }
function drawCityNoteView() {
  const el = document.getElementById('cyNView'), t = S.cnotes[curCity] || '';
  el.textContent = t || 'Inga anteckningar än. Tryck på Redigera för att lägga till.';
  el.classList.toggle('hint', !t);
}
function startEditCity() {
  document.getElementById('cyN').value = S.cnotes[curCity] || '';
  setCityEdit(true);
}
function cancelEditCity() {
  document.getElementById('cyN').value = S.cnotes[curCity] || '';
  setCityEdit(false);
}
function saveCityNote() {
  S.cnotes[curCity] = document.getElementById('cyN').value.trim();
  if (!S.cnotes[curCity]) delete S.cnotes[curCity];
  save(); drawCities(); drawCityNoteView(); setCityEdit(false); toast('Anteckningen sparad.');
}
function addInCity() {
  const n = curCity;
  closeSheets();
  openAdd(1);
  setWhen('ad', 'plats');
  document.getElementById('adCity').value = n;
}
function cityDays() {
  const c = CITIES.find(x => x.n === curCity);
  closeSheets();
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.s === 'plan'));
  closeRoute();
  pick(c.d1);
}
function openRoute() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-rutt').classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
  const el = document.getElementById('ruttmap');
  el.innerHTML = routeMapHtml(el.clientWidth, RTALL, { keep: true });
  drawCities();
}
function closeRoute() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-plan').classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
}
function goDay(n) {
  closeRoute();
  pick(n);
  // Dagen ritas om först — nollställ därefter, annars kan webbläsaren
  // återställa den gamla rullningspositionen när innehållet byts ut.
  const s = document.getElementById('scroll');
  s.scrollTop = 0;
  requestAnimationFrame(() => { s.scrollTop = 0; });
}
/* ---------- Detaljpanel ---------- */
/* ---------- När hör punkten hemma? ---------- */
// Byter mellan schemalagd (datum + tid) och bara knuten till en ort.
function setWhen(pre, lage) {
  document.querySelectorAll('#' + pre + 'WhenSeg button')
    .forEach(b => b.classList.toggle('on', b.dataset.w === lage));
  document.getElementById(pre + 'WhenTid').style.display = lage === 'tid' ? '' : 'none';
  document.getElementById(pre + 'WhenPlats').style.display = lage === 'plats' ? '' : 'none';
  document.getElementById(pre + 'WhenHint').textContent = lage === 'tid'
    ? 'Punkten ligger i Resplan på det datumet. Byter du datum flyttas den dit.'
    : 'Ingen tid sätts. Punkten får taggen Oplanerad och syns på ortens kort.';
}
const whenLage = pre =>
  document.querySelector('#' + pre + 'WhenSeg button.on').dataset.w;
function fyllStadsval(id, vald) {
  document.getElementById(id).innerHTML = CITIES.map(c =>
    `<option value="${c.n}" ${c.n === vald ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}
['sh', 'ad'].forEach(pre => document.querySelectorAll('#' + pre + 'WhenSeg button')
  .forEach(b => b.onclick = () => {
    setWhen(pre, b.dataset.w);
    if (pre !== 'sh') return;
    // Taggen Oplanerad följer valet: "Dag och tid" tar bort den, "Bara en plats" lägger till den
    const i = editTags.indexOf('oplanerad');
    if (b.dataset.w === 'tid' && i >= 0) editTags.splice(i, 1);
    if (b.dataset.w === 'plats' && i < 0) editTags.push('oplanerad');
    renderTagEdit();
  }));

function openAct(k) {
  // Stadskortet ligger över aktivitetskortet (samma z-index, senare i DOM) — lägg undan det
  // och kom ihåg staden så vi kan gå tillbaka dit när aktivitetskortet stängs.
  const cs = document.getElementById('citysheet');
  if (cs.classList.contains('on')) { retCity = curCity; cs.classList.remove('on'); cs.style.transform = ''; }
  cur = k; mediaMode = 'bild';
  const a = IDX[k], d = DAYS.find(x => x.n === a.dayN);
  document.getElementById('shT').textContent = a.n;
  document.getElementById('shM').textContent = a.dayN ? `Dag ${a.dayN}${d ? ' · ' + d.wd + ' ' + d.dl : ''}${a.t ? ' · ' + a.t : ''}` : 'Oplanerad';
  document.getElementById('shTime').value = a.t;
  document.getElementById('shDate').value = a.date || (DAYS.find(x => x.n === sel) || DAYS[0]).date;
  fyllStadsval('shCity', a.cityN || (cityOfDay(a.dayN || sel)[0] || CITIES[0]).n);
  setWhen('sh', a.dayN ? 'tid' : 'plats');
  editTags = (a.g || []).slice();
  renderTagEdit();
  // Beskrivning och egen anteckning visas på samma ställe. Anteckningen läggs under beskrivningen.
  const nt0 = (S.notes[k] || '').trim(), besk = a.d || a.m || '';
  const shD = document.getElementById('shD');
  shD.textContent = besk || (nt0 ? '' : 'Ingen beskrivning — tryck på Redigera för att lägga till en anteckning.');
  shD.classList.toggle('hint', !besk && !nt0);
  shD.style.display = shD.textContent ? '' : 'none';
  const shNV = document.getElementById('shNV');
  shNV.textContent = nt0;
  document.getElementById('shNoteWrap').style.display = nt0 ? '' : 'none';
  document.getElementById('shMapBtn').innerHTML = a.lat != null
    ? `<div class="maprow">
        <a class="maplink" href="${a.mapUrl && /maps\.apple\.com/i.test(a.mapUrl) ? a.mapUrl : `https://maps.apple.com/?ll=${a.lat},${a.lng}&q=${encodeURIComponent(a.n)}`}" target="_blank" rel="noopener">Apple Kartor</a>
        <a class="maplink" href="${a.mapUrl && /google\.[a-z.]+\/maps/i.test(a.mapUrl) ? a.mapUrl : `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`}" target="_blank" rel="noopener">Google Maps</a>
       </div>` : '';
  document.getElementById('shL').innerHTML = (a.L || []).map(([t, u]) =>
    `<a class="${/youtube/.test(u) ? 'yt' : ''}" href="${u}" target="_blank" rel="noopener">${/youtube/.test(u) ? '▶' : '↗'} ${esc(t)}</a>`).join('');
  document.getElementById('shN').value = S.notes[k] || '';
  document.getElementById('shTagsView').innerHTML = tagHtml(a.g);
  document.getElementById('sheet').classList.add('view');   // alltid visningsläge när kortet öppnas
  document.getElementById('shSw').classList.toggle('on', isDone(k));
  document.getElementById('delBtn').style.display = a.own ? '' : 'none';
  drawMedia();
  editPhoto = null;
  phReset('sh');
  document.getElementById('sheet').scrollTop = 0;
  document.getElementById('sheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
  shBase = shSnapshot();
}
// Aktivitetskortet öppnas i visningsläge. Redigera låser upp fälten, Avbryt återställer dem.
function startEditAct() {
  document.getElementById('sheet').classList.remove('view');
  shBase = shSnapshot();
}
function cancelEditAct() {
  if (shDirty() && !confirm('Kasta dina ändringar?')) return;
  openAct(cur);
}
function drawMedia() {
  const a = IDX[cur], el = document.getElementById('shMedia');
  const own = a.photo && PHOTOS[a.photo] ? PHOTOS[a.photo] : null;
  const hasImg = !!a.img || !!own, hasMap = a.lat != null;
  const pic = own ? `<img src="${own}" alt="">${a.credit ? `<div class="satt" style="left:4px;right:auto;max-width:70%">${esc(a.credit)}</div>` : ''}`
    : (a.img ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="noimg">${a.i || '📍'}</div>`);
  const kart = hasMap && (mediaMode === 'karta' || !hasImg);
  let inner = kart ? tileMap(a.lat, a.lng, 15, el.clientWidth || 390, 210, !!a.own) : pic;
  el.classList.toggle('mapmode', kart);
  const d = DAYS.find(x => x.n === a.dayN);
  const typ = (a.g || []).map(k => TAG[k] && TAG[k].l).filter(Boolean).slice(0, 2).join(' · ');
  inner += `<div class="hshade hov"></div>
    <div class="htop hov"><span>Japansk tid · ${jp(now(), { hour: '2-digit', minute: '2-digit' })}</span><span>${a.dayN ? 'Dag ' + a.dayN + ' / ' + DAYS.length : 'Oplanerad'}</span></div>
    <div class="hcopy hov"><div class="htype">${esc(typ || 'Punkt')}</div><h1>${esc(a.n)}</h1>
    <div class="hmeta"><p>${d ? d.wd + ' ' + d.dl : esc(a.m || '')}</p><p>${a.dayN ? a.t : ''}</p></div></div>`;
  if (hasMap && hasImg) inner += `<div class="mtoggle">
    <button class="${mediaMode === 'bild' ? 'on' : ''}" onclick="setMedia('bild')">Bild</button>
    <button class="${mediaMode === 'karta' ? 'on' : ''}" onclick="setMedia('karta')">Karta</button></div>`;
  el.innerHTML = inner;
}
const tileUrl = (z, x, y, remote) => remote
  ? `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  : `tiles/${z}/${x}/${y}.png`;
function tileCoords(lat, lng, z, W, H) {
  const n = 2 ** z, xw = (lng + 180) / 360 * n, lr = lat * Math.PI / 180;
  const yw = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
  const left = xw * 256 - W / 2, top = yw * 256 - H / 2, out = [];
  for (let tx = Math.floor(left / 256); tx <= Math.floor((left + W) / 256); tx++)
    for (let ty = Math.floor(top / 256); ty <= Math.floor((top + H) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      out.push({ z, x: ((tx % n) + n) % n, y: ty,
                 px: Math.round(tx * 256 - left), py: Math.round(ty * 256 - top) });
    }
  return out;
}
function tileMap(lat, lng, z, W, H, remote) {
  const t = tileCoords(lat, lng, z, W, H).map(c =>
    `<img class="tl" src="${tileUrl(c.z, c.x, c.y, remote)}" style="left:${c.px}px;top:${c.py}px" alt="">`).join('');
  return `<div class="smap">${t}<div class="smk"></div><div class="satt">© OpenStreetMap</div></div>`;
}
// Hämtar hem rutorna direkt så den nya platsen fungerar utan nät senare
function warmTiles(lat, lng) {
  const urls = tileCoords(lat, lng, 15, 440, 260).map(c => tileUrl(c.z, c.x, c.y, true));
  return Promise.allSettled(urls.map(u => fetch(u, { mode: 'no-cors' })));
}
function setMedia(m) { mediaMode = m; drawMedia(); }
function renderTagEdit() {
  document.getElementById('shTags').innerHTML = Object.keys(TAG).map(k => {
    const t = TAG[k], on = editTags.includes(k);
    return `<span class="tg ${on ? 'on' : ''}" style="color:${on ? '#fff' : t.c};background:${on ? t.c : t.b}" onclick="togTag('${k}')">${t.l}</span>`;
  }).join('');
}
function togTag(k) {
  const i = editTags.indexOf(k);
  if (i < 0) editTags.push(k); else editTags.splice(i, 1);
  renderTagEdit();
}
function toggleDone() {
  S.done[cur] = !isDone(cur); save();
  document.getElementById('shSw').classList.toggle('on', isDone(cur));
  drawActs(); drawNow();
}
async function saveDetail() {
  const nyNot = document.getElementById('shN').value.trim();
  if (nyNot) S.notes[cur] = nyNot; else delete S.notes[cur];
  const p = S.places.find(x => x.id === cur);
  if (editPhoto) {
    const old = p ? p.photo : (S.pimg[cur] || {}).id;
    try {
      if (editPhoto.blob) {
        const id = 'ph' + Date.now();
        await photoPut(id, editPhoto.blob);
        if (p) { p.photo = id; p.credit = editPhoto.credit; if (editPhoto.src) p.psrc = editPhoto.src; else delete p.psrc; }
        else S.pimg[cur] = { id, credit: editPhoto.credit, src: editPhoto.src };
        if (old) photoDel(old);
      } else if (editPhoto.remove) {
        if (p) { delete p.photo; delete p.credit; delete p.psrc; } else delete S.pimg[cur];
        if (old) photoDel(old);
      }
    } catch (e) { alert('Fotot kunde inte sparas: ' + e.message); }
  }
  if (whenLage('sh') === 'tid') {
    const tv = document.getElementById('shTime').value;
    if (tv) { S.times[cur] = tv; if (p) p.t = tv; }
    const dv = document.getElementById('shDate').value;
    const nyDag = DAYS.find(x => x.date === dv);
    if (nyDag) { S.days[cur] = nyDag.n; if (p) p.day = nyDag.n; }
    delete S.citys[cur];
    if (p) delete p.city;
  } else {
    S.days[cur] = 0;
    S.citys[cur] = +document.getElementById('shCity').value;
    if (p) { p.day = 0; p.city = S.citys[cur]; }
  }
  S.tags[cur] = editTags.filter(t => t !== 'oplanerad');
  save(); buildIndex(); closeSheets();
  drawActs(); drawPlaces(); drawNow(); drawCities();
}
function delPlace() {
  if (!confirm('Ta bort den här platsen?')) return;
  const p = S.places.find(x => x.id === cur);
  if (p && p.photo) photoDel(p.photo);
  S.places = S.places.filter(p => p.id !== cur);
  delete S.notes[cur]; delete S.done[cur]; delete S.times[cur]; delete S.tags[cur];
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces();
}
let retCity = null;      // stad att återvända till när ett aktivitetskort öppnats från stadskortet
function closeSheets() {
  const fromAct = document.getElementById('sheet').classList.contains('on');
  document.querySelectorAll('.sheet').forEach(s => { s.classList.remove('on'); s.style.transform = ''; });
  document.getElementById('scrim').classList.remove('on');
  shBase = null; curCity = null;
  const back = fromAct ? retCity : null;
  retCity = null;
  if (back) openCity(back);
}

let toastT = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2400);
}

/* ---------- Dra ned för att stänga ---------- */
let shBase = null;
const shSnapshot = () => JSON.stringify([
  document.getElementById('shN').value,
  document.getElementById('shTime').value,
  document.getElementById('shDate').value,
  whenLage('sh'),
  document.getElementById('shCity').value,
  editTags.slice().sort(),
  editPhoto ? (editPhoto.remove ? 'r' : 'n' + editPhoto.blob.size) : '']);
const shDirty = () => shBase !== null && shSnapshot() !== shBase;

(function dragToClose() {
  ['sheet', 'citysheet'].forEach(id => {
    const sh = document.getElementById(id);
    let y0 = null, dy = 0, aktiv = false;
    sh.addEventListener('touchstart', e => {
      y0 = null;
      // Bara från toppen av kortet, och inte när man träffar något man kan trycka på.
      if (e.touches.length !== 1 || sh.scrollTop > 0 ||
          e.target.closest('button,a,input,select,textarea,.tg,.wxrow,.fchips')) return;
      y0 = e.touches[0].clientY; dy = 0; aktiv = false;
    }, { passive: true });
    sh.addEventListener('touchmove', e => {
      if (y0 === null) return;
      const d = e.touches[0].clientY - y0;
      if (!aktiv) {
        if (d < 8) return;                  // vänta tills riktningen är tydlig
        aktiv = true;
        sh.style.transition = 'none';
      }
      dy = Math.max(0, d);
      e.preventDefault();                   // annars tar Safari över gesten som rullning
      sh.style.transform = `translateY(${dy}px)`;
    }, { passive: false });
    const slapp = () => {
      if (y0 === null) return;
      sh.style.transition = '';
      sh.style.transform = '';
      if (aktiv && dy > 90) {
        if (id === 'sheet' && shDirty()) toast('Du har ändringar — spara eller stäng.');
        else closeSheets();
      }
      y0 = null; aktiv = false;
    };
    sh.addEventListener('touchend', slapp);
    sh.addEventListener('touchcancel', slapp);
  });
})();

/* ---------- Egna platser ---------- */
let picked = null, results = [], sugg = [];

/* Namn och koordinater ligger i själva Maps-adressen. Kortlänkar saknar dem och
   kan inte slås upp härifrån — Google skickar inga CORS-headers. */
function parseMapsUrl(u) {
  const ll = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
          || u.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
          || u.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
          || u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (!ll) return null;
  const nm = u.match(/\/place\/([^/@?]+)/);
  return { name: nm ? decodeURIComponent(nm[1]).replace(/\+/g, ' ') : '', lat: +ll[1], lng: +ll[2], url: u };
}

async function lookup() {
  const q = document.getElementById('adQ').value.trim();
  const box = document.getElementById('adRes');
  if (!q) return;

  if (/^https?:\/\//i.test(q)) {
    if (/goo\.gl|maps\.app/i.test(q)) {
      box.innerHTML = '<p class="searching">Det här är en kortlänk utan platsinfo. Öppna den i Safari först och kopiera den långa adressen — eller sök på namnet istället.</p>';
      return;
    }
    const p = parseMapsUrl(q);
    if (!p) {
      box.innerHTML = '<p class="searching">Hittade inga koordinater i länken. Prova att söka på namnet.</p>';
      return;
    }
    setPicked({ name: p.name, lat: p.lat, lng: p.lng, addr: '', url: '', mapUrl: p.url });   // kartlänken blir inte en egen länk — kortets Kartknapp används
    return;
  }

  box.innerHTML = '<p class="searching">Söker…</p>';
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q));
    results = await r.json();
    if (!results.length) {
      box.innerHTML = '<p class="searching">Inga träffar. Prova med staden efter namnet, t.ex. ”Nishiki Market Kyoto”.</p>';
      return;
    }
    box.innerHTML = '<div class="res">' + results.map((x, i) =>
      `<div class="r" onclick="pickResult(${i})">
        <div class="rn">${esc(x.name || x.display_name.split(',')[0])}</div>
        <div class="ra">${esc(x.display_name)}</div></div>`).join('') + '</div>';
  } catch (e) {
    box.innerHTML = '<p class="searching">Sökningen misslyckades — kräver nät.</p>';
  }
}
function pickResult(i) {
  const x = results[i];
  setPicked({ name: x.name || x.display_name.split(',')[0], lat: +x.lat, lng: +x.lon, addr: x.display_name, url: '' });
}
function setPicked(p) {
  picked = p;
  document.getElementById('adSugBtn').disabled = false;
  const nf = document.getElementById('adN');
  if (p.name && !nf.value.trim()) nf.value = p.name;
  document.getElementById('adRes').innerHTML =
    `<div class="picked"><div style="font-size:16px">📍</div><div class="pk">
      <b>${esc(p.name || 'Vald plats')}</b>${esc(p.addr || (p.lat.toFixed(5) + ', ' + p.lng.toFixed(5)))}</div>
      <button onclick="clearPicked()">Ta bort</button></div>`;
}
function clearPicked() {
  picked = null;
  document.getElementById('adRes').innerHTML = '';
  document.getElementById('adSugBtn').disabled = true;
  document.getElementById('adSug').innerHTML = '';
}

/* ---------- Foton ----------
   Ligger i IndexedDB, inte localStorage — localStorage tar slut vid ~5 MB och då
   skulle även anteckningar sluta sparas. */
let DB = null;
const PHOTOS = {};          // id -> objekt-URL för visning
let newPhoto = null;        // { blob, credit } för platsen som håller på att läggas till

function idb() {
  return new Promise((res, rej) => {
    if (DB) return res(DB);
    const r = indexedDB.open('japan2026', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
    r.onsuccess = () => { DB = r.result; res(DB); };
    r.onerror = () => rej(r.error);
  });
}
async function photoPut(id, blob) {
  const db = await idb();
  await new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put({ id, blob });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  if (PHOTOS[id]) URL.revokeObjectURL(PHOTOS[id]);
  PHOTOS[id] = URL.createObjectURL(blob);
}
async function photoDel(id) {
  if (!id) return;
  const db = await idb();
  await new Promise(res => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(id);
    tx.oncomplete = res;
  });
  if (PHOTOS[id]) { URL.revokeObjectURL(PHOTOS[id]); delete PHOTOS[id]; }
}
async function loadPhotos() {
  try {
    const db = await idb();
    const all = await new Promise((res, rej) => {
      const q = db.transaction('photos', 'readonly').objectStore('photos').getAll();
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    all.forEach(r => PHOTOS[r.id] = URL.createObjectURL(r.blob));
  } catch (e) { console.warn('Kunde inte läsa foton:', e); }
}

/* Skalar ner till 900 px innan lagring — ett telefonfoto på 4 MB blir ca 60 kB. */
function shrink(src, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(src);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('komprimering misslyckades')), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('kunde inte läsa bilden')); };
    img.src = url;
  });
}

let editPhoto = null;   // vid redigering: null = oförändrad · {blob,credit} = nytt foto · {remove:true} = ta bort
const phGet = pre => pre === 'sh' ? editPhoto : newPhoto;
const phSet = (pre, v) => { if (pre === 'sh') editPhoto = v; else newPhoto = v; };
const PH_HINT = {
  ad: 'Fotot sparas på enheten och visas på platsen. ”Från platsen” kräver att du valt en plats ovan.',
  sh: 'Fotot sparas på enheten och visas på kortet. ”Från platsen” kräver att punkten har en position.'
};
const phExisting = () => { const a = IDX[cur] || {}; return a.photo && PHOTOS[a.photo] ? a.photo : null; };
// Nollställ fotodelen av redigeringskortet när det öppnas
function phReset(pre) {
  document.getElementById(pre + 'PhotoHint').textContent = PH_HINT[pre];
  document.getElementById(pre + 'Sug').innerHTML = '';
  const a = IDX[cur] || {};
  document.getElementById('shSugBtn').disabled = a.lat == null;
  drawPhotoPrev(pre);
}

async function pickPhoto(input, pre = 'ad') {
  const f = input.files[0];
  input.value = '';
  if (!f) return;
  const hint = document.getElementById(pre + 'PhotoHint');
  hint.textContent = 'Bearbetar fotot…';
  try {
    const ph = { blob: await shrink(f), credit: '' };
    phSet(pre, ph);
    drawPhotoPrev(pre);
    hint.textContent = `Fotot sparas på enheten (${Math.round(ph.blob.size / 1024)} kB).`;
  } catch (e) {
    hint.textContent = 'Kunde inte läsa fotot: ' + e.message;
  }
}
function drawPhotoPrev(pre = 'ad') {
  const el = document.getElementById(pre + 'PhotoPrev'), ph = phGet(pre);
  const arg = pre === 'sh' ? "'sh'" : '';
  if (ph && ph.blob) {
    const u = URL.createObjectURL(ph.blob);
    el.innerHTML = `<div class="pprev"><img src="${u}" alt="">
      <button onclick="clearPhoto(${arg})">${pre === 'sh' ? 'Ångra' : 'Ta bort'}</button>
      ${ph.credit ? `<div class="cr">${esc(ph.credit)}</div>` : ''}</div>`;
  } else if (pre === 'sh' && ph && ph.remove) {
    el.innerHTML = `<p class="hint">Fotot tas bort när du sparar. <button class="editlink" onclick="clearPhoto('sh')">Ångra</button></p>`;
  } else if (pre === 'sh' && phExisting()) {
    const a = IDX[cur];
    el.innerHTML = `<div class="pprev"><img src="${PHOTOS[a.photo]}" alt="">
      <button onclick="clearPhoto('sh')">Ta bort</button>
      ${a.credit ? `<div class="cr">${esc(a.credit)}</div>` : ''}</div>`;
  } else el.innerHTML = '';
}
function clearPhoto(pre = 'ad') {
  if (pre === 'sh') {
    // Har man valt något nytt eller markerat borttagning: ångra. Annars: markera befintligt foto för borttagning.
    editPhoto = editPhoto ? null : (phExisting() ? { remove: true } : null);
    document.getElementById('shSug').innerHTML = '';
    document.getElementById('shPhotoHint').textContent = PH_HINT.sh;
    drawPhotoPrev('sh');
    return;
  }
  newPhoto = null;
  document.getElementById('adPhotoPrev').innerHTML = '';
  document.getElementById('adPhotoHint').textContent = PH_HINT.ad;
}

/* Bilder nära koordinaten, från Wikimedia Commons. Träffar beror på vad som finns
   fotograferat — bra för sevärdheter, ofta tomt för små restauranger. */
async function suggestPhotos(pre = 'ad') {
  const src = pre === 'sh' ? IDX[cur] : picked;
  if (!src || src.lat == null) return;
  const box = document.getElementById(pre + 'Sug');
  box.innerHTML = '<p class="searching">Söker bilder nära platsen…</p>';
  try {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=geosearch&ggsnamespace=6&ggslimit=10&ggsradius=400' +
      `&ggscoord=${src.lat}|${src.lng}` +
      '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=300';
    const d = await (await fetch(u)).json();
    const pages = Object.values((d.query || {}).pages || {});
    if (!pages.length) {
      box.innerHTML = '<p class="searching">Inga bilder hittades här. Ta ett eget foto i stället.</p>';
      return;
    }
    sugg = pages.map(p => {
      const ii = (p.imageinfo || [{}])[0], m = ii.extmetadata || {};
      const strip = s => String(s || '').replace(/<[^>]+>/g, '').trim();
      return {
        title: p.title,
        thumb: ii.thumburl,
        credit: (strip(m.Artist && m.Artist.value) || 'Wikimedia Commons') +
                ' · ' + (strip(m.LicenseShortName && m.LicenseShortName.value) || 'se Commons')
      };
    }).filter(x => x.thumb);
    box.innerHTML = '<div class="sugg">' + sugg.map((x, i) =>
      `<img src="${x.thumb}" alt="" onclick="useSuggestion(${i},this,'${pre}')">`).join('') + '</div>';
  } catch (e) {
    box.innerHTML = '<p class="searching">Bilsökningen misslyckades — kräver nät.</p>';
  }
}
async function useSuggestion(i, el, pre = 'ad') {
  const s = sugg[i];
  el.classList.add('busy');
  const hint = document.getElementById(pre + 'PhotoHint');
  hint.textContent = 'Hämtar bilden…';
  try {
    // Be api:et om 900 px — är originalet mindre får vi originalstorleken i stället
    // för ett 400-svar, vilket uppskalning i url:en ger.
    const q = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&prop=imageinfo&iiprop=url&iiurlwidth=900&titles=' + encodeURIComponent(s.title);
    const d = await (await fetch(q)).json();
    const ii = (Object.values(d.query.pages)[0].imageinfo || [{}])[0];
    const url = ii.thumburl || ii.url;
    if (!url) throw new Error('ingen bildadress');
    const blob = await (await fetch(url)).blob();
    const ph = { blob: await shrink(blob), credit: s.credit, src: { url, title: s.title } };
    phSet(pre, ph);
    drawPhotoPrev(pre);
    document.getElementById(pre + 'Sug').innerHTML = '';
    hint.textContent = `Bilden sparas på enheten (${Math.round(ph.blob.size / 1024)} kB).`;
  } catch (e) {
    el.classList.remove('busy');
    hint.textContent = 'Kunde inte hämta bilden: ' + e.message;
  }
}

function openAdd(fromPlaces) {
  document.getElementById('adT').textContent = fromPlaces ? 'Ny plats' : 'Ny punkt';
  const d = DAYS.find(x => x.n === sel) || DAYS[0];
  document.getElementById('adDate').value = d.date;
  fyllStadsval('adCity', (cityOfDay(sel)[0] || CITIES[0]).n);
  setWhen('ad', fromPlaces ? 'plats' : 'tid');
  document.getElementById('adTi').value = '12:00';
  document.getElementById('adN').value = '';
  document.getElementById('adNo').value = '';
  document.getElementById('adQ').value = '';
  clearPicked();
  clearPhoto();
  document.getElementById('adSug').innerHTML = '';
  document.getElementById('addsheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
}
async function savePlace() {
  const n = document.getElementById('adN').value.trim();
  if (!n) { document.getElementById('adN').focus(); return; }
  const schemalagd = whenLage('ad') === 'tid';
  const dag = schemalagd
    ? (DAYS.find(x => x.date === document.getElementById('adDate').value) || {}).n || 0 : 0;
  const p = {
    id: 'p' + Date.now(), name: n,
    cat: document.getElementById('adC').value,
    t: schemalagd ? document.getElementById('adTi').value : '12:00',
    day: dag,
    city: schemalagd ? 0 : +document.getElementById('adCity').value,
    note: ''
  };
  const nyNote = document.getElementById('adNo').value.trim();
  if (picked) {
    p.lat = picked.lat; p.lng = picked.lng;
    p.addr = picked.addr; p.url = picked.url;
    if (picked.mapUrl) p.mapUrl = picked.mapUrl;
    warmTiles(picked.lat, picked.lng);
  }
  if (newPhoto) {
    p.photo = 'ph' + Date.now();
    p.credit = newPhoto.credit;
    if (newPhoto.src) p.psrc = newPhoto.src;
    try { await photoPut(p.photo, newPhoto.blob); }
    catch (e) { delete p.photo; alert('Fotot kunde inte sparas: ' + e.message); }
  }
  S.places.push(p);
  if (nyNote) S.notes[p.id] = nyNote;   // samma plats som "Min anteckning" på kortet
  save(); buildIndex(); closeSheets();
  drawActs(); drawPlaces(); drawCities(); backupInfo();
}
function setCat(c) { cat = c; drawPlaces(); }
function drawPlaces() {
  const ic = { mat: '🍜', aktivitet: '🖼️', shopping: '🛍️', ovrigt: '📍' };
  document.getElementById('catseg2').innerHTML = groupChips(cat, 'setCat', S.places);
  const l = S.places.filter(p => cat === 'alla' || inGroup(p, cat));
  document.getElementById('places').innerHTML = l.length ? l.map(p => {
    const a = IDX[p.id] || {}, d = DAYS.find(x => x.n === a.dayN);
    const ort = !d && p.city ? (CITIES.find(c => c.n === p.city) || {}).name : null;
    return `<div class="card" onclick="openAct('${p.id}')" style="cursor:pointer">
      <div style="display:flex;gap:11px;align-items:center">
        ${p.photo && PHOTOS[p.photo] ? `<img class="pthumb" src="${PHOTOS[p.photo]}" alt="">`
          : `<div class="ico">${ic[p.cat] || '📍'}</div>`}
        <div style="flex:1;min-width:0">
          <div class="pl-n">${esc(p.name)}</div>
          <div class="pl-m" style="margin-top:2px">${
            d ? a.t + ' · Dag ' + d.n + ' (' + d.dl + ')'
              : (ort ? '📍 ' + esc(ort) + ' · ingen tid satt' : 'Ingen tid satt')}</div>
        </div></div>
      ${p.addr ? `<p class="pl-a">📍 ${esc(p.addr)}</p>` : ''}
      ${(S.notes[p.id] || '').trim() ? `<p class="pl-note">${esc(S.notes[p.id].trim())}</p>` : ''}
      <div class="tags" style="margin-top:8px">${tagHtml(a.g || ['egen', p.cat])}</div></div>`;
  }).join('') : '<div class="empty"><div class="e">🍜</div><p>Inga egna platser än.<br>Lägg till restauranger och museer<br>ni hittar på vägen.</p></div>';
}

/* ---------- Packning ---------- */
function packForslag() {
  const ut = [];
  let lagst = 99, lagstOrt = '', regn = 0, dagar = 0;
  DAYS.forEach(d => {
    const c = cityOfDay(d.n).slice(-1)[0];
    const n = c && wxNormal(c, d.date);
    if (!n) return;
    dagar++;
    if (n[1] < lagst) { lagst = n[1]; lagstOrt = c.name.split(' och ')[0]; }
    if (n[2] >= 50) regn++;
  });
  if (dagar) {
    if (lagst < 10) ut.push({ t: 'Varma lager', vf: Math.round(lagst) + '° i ' + lagstOrt });
    if (regn) ut.push({ t: 'Regnjacka', vf: regn + ' regndagar' });
  }
  // Dagar d\u00e4r bagaget skickas separat kr\u00e4ver en v\u00e4ska f\u00f6r en natt
  DAYS.forEach(d => {
    if (d.warn && /separat|liten v\u00e4ska|dygnsv/i.test(d.warn))
      ut.push({ t: 'Dygnsv\u00e4ska f\u00f6r en natt', vf: 'Dag ' + d.n });
  });
  return ut;
}
/* Packlistan är nu kategorier: S.packCats = [{ id, name, collapsed, done, items: [{ id, t, vf, done }] }].
   Äldre, platt lista (S.pack) flyttas över till en första kategori. */
function packInit() {
  if (Array.isArray(S.packCats)) return;
  const old = Array.isArray(S.pack) ? S.pack : null;
  const items = old || packForslag().map((x, i) => ({ id: 'f' + i, t: x.t, vf: x.vf, done: 0 }));
  S.packCats = items.length
    ? [{ id: 'c' + Date.now(), name: old ? 'Packlista' : 'Förslag från vädret', collapsed: 0, done: 0, items }]
    : [];
  S.pack = null;
  save();
}
const pkAll = () => S.packCats.flatMap(c => c.items);
const catDone = c => c.items.length ? c.items.every(x => x.done) : !!c.done;
const PK_GRIP = '<svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor"><circle cx="4" cy="3" r="1.6"/><circle cx="10" cy="3" r="1.6"/><circle cx="4" cy="9" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="4" cy="15" r="1.6"/><circle cx="10" cy="15" r="1.6"/></svg>';
const PK_CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M4 12.5l5.5 5.5L20 7"/></svg>';
const PK_DASH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M6 12h12"/></svg>';
const PK_CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 5l7 7-7 7"/></svg>';

function drawPackSum() {
  let varm = null, kall = null, natt = null, regn = 0, dagar = 0, prog = 0;
  DAYS.forEach(d => {
    const c = cityOfDay(d.n).slice(-1)[0];
    if (!c) return;
    const p = wxPrognos(c, d.date), n = wxNormal(c, d.date);
    const v = p ? { max: p.max, min: p.min, regn: p.regn >= 50 } : n ? { max: n[0], min: n[1], regn: n[2] >= 50 } : null;
    if (!v) return;
    dagar++; if (p) prog++;
    const r = { max: Math.round(v.max), min: Math.round(v.min), ort: c.name.split(' och ')[0] };
    if (!varm || r.max > varm.max) varm = r;      // högsta dagstemperatur
    if (!kall || r.max < kall.max) kall = r;      // lägsta dagstemperatur
    if (!natt || r.min < natt.min) natt = r;      // kallaste natten
    if (v.regn) regn++;
  });
  const kalla = !prog ? 'Normalvärden för årstiden (sjuårsmedel).'
    : prog === dagar ? 'Aktuell prognos.'
    : `Prognos för ${prog} av ${dagar} dagar, resten normalvärden.`;
  document.getElementById('packsum').innerHTML = dagar ? `<div class="wsum">
    <div class="lb">Vädret under resan</div>
    <div class="big">${kall.max}° till ${varm.max}°</div>
    <div class="sub">Dagstemperatur, natt inom parentes. Kallaste natten ${natt.min}° i ${esc(natt.ort)}.
      Regn mer troligt än inte ${regn} av ${dagar} dagar. ${kalla}</div>
    <div class="delar">
      <div class="del"><div class="k">Högsta dag</div><div class="v">${varm.max}° (${varm.min}°)</div><div class="n">${esc(varm.ort)}</div></div>
      <div class="del"><div class="k">Lägsta dag</div><div class="v">${kall.max}° (${kall.min}°)</div><div class="n">${esc(kall.ort)}</div></div>
      <div class="del"><div class="k">Regndagar</div><div class="v">${regn}</div><div class="n">av ${dagar}</div></div>
    </div></div>` : '';
}
function drawPack() {
  packInit();
  drawPackSum();
  const alla = pkAll(), klara = alla.filter(x => x.done).length;
  document.getElementById('packprog').innerHTML = alla.length
    ? `<div class="bar"><i style="width:${Math.round(klara / alla.length * 100)}%"></i></div>
       <div class="n">${klara} av ${alla.length}</div>` : '';
  document.getElementById('packlist').innerHTML = S.packCats.length ? S.packCats.map(packCatHtml).join('')
    : '<div class="empty"><div class="e">🧳</div><p>Inga kategorier än.<br>Skapa en, t.ex. ”Kameraväska” eller ”Kabinväska”,<br>och lägg sakerna i den.</p></div>';
}
function packRowHtml(x) {
  return `<div class="pk ${x.done ? 'klar' : ''}" data-id="${x.id}" onclick="togPack('${x.id}')">
    <div class="grip" onpointerdown="pkDown(event,'item','${x.id}')" onclick="event.stopPropagation()">${PK_GRIP}</div>
    <div class="box">${x.done ? PK_CHECK : ''}</div>
    <div class="t">${esc(x.t)}</div>
    ${x.vf ? `<span class="vf">${esc(x.vf)}</span>` : ''}
    <button class="del" onclick="event.stopPropagation();delPack('${x.id}')">×</button></div>`;
}
function packCatHtml(c) {
  const all = catDone(c), some = !all && c.items.some(x => x.done);
  const n = c.items.length, k = c.items.filter(x => x.done).length;
  return `<div class="pkcat ${all ? 'klar' : ''} ${c.collapsed ? 'coll' : ''}" data-cid="${c.id}">
    <div class="pkhead">
      <div class="grip" onpointerdown="pkDown(event,'cat','${c.id}')">${PK_GRIP}</div>
      <div class="cbox ${all ? 'on' : some ? 'part' : ''}" onclick="togCat('${c.id}')">${all ? PK_CHECK : some ? PK_DASH : ''}</div>
      ${pkEditId === c.id
        ? `<input type="text" class="cedit" id="pkren-${c.id}" value="${esc(c.name)}" enterkeyhint="done"
             onkeydown="if(event.key==='Enter')this.blur();else if(event.key==='Escape'){this.dataset.x=1;this.blur();}"
             onblur="finishRename('${c.id}',this)">`
        : `<div class="ctitle" onclick="togColl('${c.id}')">${PK_CHEV}<span class="cn">${esc(c.name)}</span><span class="cc">${n ? k + '/' + n : 'tom'}</span></div>`}
      <button type="button" class="cb" onclick="renameCat('${c.id}')" aria-label="Byt namn">✎</button>
      <button class="cb" onclick="delCat('${c.id}')" aria-label="Ta bort kategori">×</button>
    </div>
    <div class="pkwrap">
      <div class="pkbody">${c.items.map(packRowHtml).join('')}</div>
      <div class="pkaddrow">
        <input type="text" id="pkin-${c.id}" placeholder="Lägg till sak…" enterkeyhint="done"
          onkeydown="if(event.key==='Enter')addPackItem('${c.id}')">
        <button onclick="addPackItem('${c.id}')">+</button>
      </div>
    </div>
  </div>`;
}
const catById = id => S.packCats.find(c => c.id === id);
function togPack(id) {
  const x = pkAll().find(p => p.id === id);
  if (x) { x.done = x.done ? 0 : 1; save(); drawPack(); }
}
function togCat(id) {          // bocka av hela kategorin (eller ta bort alla bockar)
  const c = catById(id); if (!c) return;
  const v = catDone(c) ? 0 : 1;
  c.done = v; c.items.forEach(x => x.done = v);
  save(); drawPack();
}
function togColl(id) {         // fäll ihop / fäll ut
  const c = catById(id); if (!c) return;
  c.collapsed = c.collapsed ? 0 : 1; save(); drawPack();
}
let pkEditId = null;
function renameCat(id) {          // byt namn direkt i listan (prompt() fungerar inte i iOS-appar)
  if (!catById(id)) return;
  pkEditId = id; drawPack();
  const el = document.getElementById('pkren-' + id);
  if (el) { el.focus(); el.select(); }
}
function finishRename(id, el) {
  if (pkEditId !== id) return;
  pkEditId = null;
  const c = catById(id), n = el.value.trim();
  if (c && n && !el.dataset.x) { c.name = n; save(); }
  drawPack();
}
function delCat(id) {
  const c = catById(id); if (!c) return;
  if (c.items.length && !confirm(`Ta bort ”${c.name}” och de ${c.items.length} sakerna i den?`)) return;
  S.packCats = S.packCats.filter(x => x.id !== id); save(); drawPack();
}
function delPack(id) {
  S.packCats.forEach(c => { c.items = c.items.filter(p => p.id !== id); });
  save(); drawPack();
}
function addCat() {
  const el = document.getElementById('packCatNy'), name = el.value.trim();
  if (!name) return;
  const c = { id: 'c' + Date.now(), name, collapsed: 0, done: 0, items: [] };
  S.packCats.push(c);
  el.value = ''; save(); drawPack();
  const inp = document.getElementById('pkin-' + c.id); if (inp) inp.focus();
}
function addPackItem(cid) {
  const c = catById(cid), el = document.getElementById('pkin-' + cid);
  if (!c || !el) return;
  const t = el.value.trim(); if (!t) return;
  c.items.push({ id: 'p' + Date.now() + Math.random().toString(36).slice(2, 5), t, done: 0 });
  if (c.items.length === 1) c.done = 0;
  save(); drawPack();
  const again = document.getElementById('pkin-' + cid); if (again) again.focus();
}
document.getElementById('packCatNy').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCat();
});

/* ---- Dra och släpp (pekskärm + mus). Handtaget (⋮⋮) startar dragningen. ----
   Den dragna raden står kvar i DOM:en men kollapsas; en streckad plats-hållare (ph)
   flyttas dit den skulle hamna. Vid släpp läses ordningen av från DOM:en. */
let pkd = null;
function pkDown(e, kind, id) {
  if (pkd || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); e.stopPropagation();
  const el = document.querySelector(kind === 'item' ? `.pk[data-id="${id}"]` : `.pkcat[data-cid="${id}"]`);
  if (!el) return;
  const ref = kind === 'item' ? el : el.querySelector('.pkhead');
  const r = ref.getBoundingClientRect();
  const ghost = ref.cloneNode(true);
  ghost.classList.add('pkghost');
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
  document.body.appendChild(ghost);
  const ph = document.createElement('div');
  ph.className = 'pkph';
  ph.style.height = r.height + 'px';
  ph.style.marginBottom = getComputedStyle(el).marginBottom;
  el.parentNode.insertBefore(ph, el);
  el.classList.add('dragging');
  document.body.classList.add('pkdrag');
  pkd = { kind, id, el, ph, ghost, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, raf: 0 };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  window.addEventListener('pointermove', pkMove);
  window.addEventListener('pointerup', pkUp);
  window.addEventListener('pointercancel', pkCancel);
  pkd.raf = requestAnimationFrame(pkLoop);
  pkPlace();
}
function pkMove(e) {
  if (!pkd) return;
  pkd.x = e.clientX; pkd.y = e.clientY;
  pkPlace();
}
function pkPlace() {
  const d = pkd; if (!d) return;
  d.ghost.style.top = (d.y - d.dy) + 'px';
  const list = document.getElementById('packlist');
  const lr = list.getBoundingClientRect();
  if (d.kind === 'cat') {
    const cats = [...list.querySelectorAll(':scope > .pkcat:not(.dragging)')];
    const before = cats.find(c => { const b = c.querySelector('.pkhead').getBoundingClientRect(); return d.y < b.top + b.height / 2; });
    before ? list.insertBefore(d.ph, before) : list.appendChild(d.ph);
    return;
  }
  const under = document.elementFromPoint(lr.left + lr.width / 2, d.y);
  const cat = under && under.closest('.pkcat');
  if (!cat) return;
  const body = cat.querySelector('.pkbody');
  if (cat.classList.contains('coll')) body.appendChild(d.ph);          // hamnar sist i ihopfälld kategori
  else if (under.closest('.pkhead')) body.insertBefore(d.ph, body.firstChild);
  else {
    const rows = [...body.querySelectorAll(':scope > .pk:not(.dragging)')];
    const before = rows.find(x => { const b = x.getBoundingClientRect(); return d.y < b.top + b.height / 2; });
    before ? body.insertBefore(d.ph, before) : body.appendChild(d.ph);
  }
  list.querySelectorAll('.pkcat.droptarget').forEach(c => c.classList.remove('droptarget'));
  cat.classList.add('droptarget');
}
function pkLoop() {                // rulla när fingret närmar sig kanten
  if (!pkd) return;
  const sc = document.getElementById('scroll'), sr = sc.getBoundingClientRect();
  const top = sr.top + 90, bot = sr.bottom - 140;
  let v = 0;
  if (pkd.y < top) v = -Math.min(16, (top - pkd.y) / 4);
  else if (pkd.y > bot) v = Math.min(16, (pkd.y - bot) / 4);
  if (v) { sc.scrollTop += v; pkPlace(); }
  pkd.raf = requestAnimationFrame(pkLoop);
}
function pkEnd(commit) {
  const d = pkd; if (!d) return;
  pkd = null;
  cancelAnimationFrame(d.raf);
  window.removeEventListener('pointermove', pkMove);
  window.removeEventListener('pointerup', pkUp);
  window.removeEventListener('pointercancel', pkCancel);
  d.ghost.remove();
  document.body.classList.remove('pkdrag');
  if (commit) pkCommit(d);
  save(); drawPack();
}
const pkUp = () => pkEnd(true);
const pkCancel = () => pkEnd(false);
function pkCommit(d) {
  const list = document.getElementById('packlist');
  if (d.kind === 'item') {
    const byId = Object.fromEntries(pkAll().map(x => [x.id, x]));
    S.packCats.forEach(c => {
      const cel = list.querySelector(`.pkcat[data-cid="${c.id}"] .pkbody`);
      if (!cel) return;
      c.items = [...cel.children].map(n => n === d.ph ? byId[d.id]
        : (n.classList.contains('pk') && !n.classList.contains('dragging') ? byId[n.dataset.id] : null)).filter(Boolean);
    });
  } else {
    const byId = Object.fromEntries(S.packCats.map(c => [c.id, c]));
    S.packCats = [...list.children].map(n => n === d.ph ? byId[d.id]
      : (n.classList.contains('pkcat') && !n.classList.contains('dragging') ? byId[n.dataset.cid] : null)).filter(Boolean);
  }
}

/* ---------- Färdledare ----------
   Numren ligger medvetet inte i koden — de fylls i på enheten och sparas bara där. */
const LEADERS = [
  { id: 'mo', init: 'MO', name: 'Markus Oxelman',
    role: 'Möter gruppen på Haneda med skylt och följer med till Osaka. Hans nummer är privat och gäller från avresedagen.',
    fields: [{ k: 'mo_jp', l: 'Japansk mobil', icon: '🇯🇵' }] },
  { id: 'jf', init: 'JF', name: 'Jörgen Fredriksson',
    role: 'Tar över som färdledare från Mishima (dag 8) och resan ut.',
    fields: [{ k: 'jf_se', l: 'Svensk mobil', icon: '📞' }, { k: 'jf_jp', l: 'Japansk mobil', icon: '🇯🇵' }] }
];
let editLeader = null;

function drawLeaders() {
  document.getElementById('leaders').innerHTML = LEADERS.map(p => {
    const nums = p.fields.filter(f => S.contacts[f.k]);
    let body;
    if (editLeader === p.id) {
      body = '<div class="numform">' + p.fields.map(f =>
        `<label class="fl">${f.l}</label><input type="tel" id="c_${f.k}" value="${esc(S.contacts[f.k] || '')}" placeholder="+46…">`).join('') +
        `<button class="btn" style="margin-top:6px" onclick="saveContact('${p.id}')">Spara</button>
         <button class="btn sec" onclick="editLeader=null;drawLeaders()">Avbryt</button></div>`;
    } else {
      body = (nums.length
        ? nums.map(f => `<a class="tel${f.k.endsWith('jp') ? ' alt' : ''}" href="tel:${S.contacts[f.k].replace(/[^\d+]/g, '')}">${f.icon} ${esc(S.contacts[f.k])}</a>`).join('')
        : '<div class="nonum">Inget nummer sparat än.</div>') +
        `<br><button class="editlink" onclick="editLeader='${p.id}';drawLeaders()">${nums.length ? 'Ändra nummer' : 'Lägg till nummer'}</button>`;
    }
    return `<div class="prow"><div class="pav">${p.init}</div><div class="pb">
      <div class="pn">${p.name}</div><div class="pr">${p.role}</div>${body}</div></div>`;
  }).join('') +
  '<p class="hint">Färdledarnas nummer finns inte i appen av integritetsskäl. Skriv in dem från avreseinformationen — de sparas bara på den här enheten och följer med i säkerhetskopian.</p>';
}
function saveContact(id) {
  const p = LEADERS.find(x => x.id === id);
  p.fields.forEach(f => {
    const v = document.getElementById('c_' + f.k).value.trim();
    if (v) S.contacts[f.k] = v; else delete S.contacts[f.k];
  });
  editLeader = null; save(); drawLeaders();
}

/* ---------- Hotellista, byggd ur resplanen ---------- */
function drawHotels() {
  const g = [];
  DAYS.forEach(d => {
    if (d.hotel === '—' || d.hotel === 'Ombord') return;
    const last = g[g.length - 1];
    if (last && last.h === d.hotel) last.to = d.n;
    else g.push({ h: d.hotel, addr: d.addr, from: d.n, to: d.n });
  });
  document.getElementById('hotels').innerHTML = g.map(x => {
    const tel = (x.addr.match(/\+[\d\s-]+/) || [''])[0].trim();
    const adr = x.addr.replace(/\s*·\s*\+[\d\s-]+/, '');
    return `<div class="flt"><div class="fno">${x.from === x.to ? 'Dag ' + x.from : 'Dag ' + x.from + '–' + x.to}</div>
      <div class="fb"><div class="frt">${esc(x.h)}</div><div class="ftm">${esc(adr)}</div></div>
      ${tel ? `<a class="tel" style="margin:0" href="tel:${tel.replace(/[\s-]/g, '')}">📞</a>` : ''}</div>`;
  }).join('');
}

/* ---------- Nu ---------- */
// Aktiviteter utan egen bild (resor m.m.): ortens bild som fond, stor ikon och en förloppslinje till nästa punkt
function nowCityImg(d, m) {
  const o = cityOfDay(d.n);
  if (!o.length) return null;
  const c = o.length > 1 && m >= mins(bytTid(d, o[0], o[1])) ? o[1] : o[0];
  return c.img || null;
}
function coverHtml(o) {
  const bg = o.src ? `url('${o.src}')` : o.img ? `url(img/${o.img}.jpg)` : 'linear-gradient(145deg,#62651e,#49351d)';
  const tint = '';
  return `<section class="cover" style="background-image:linear-gradient(180deg,rgba(25,21,15,.04) 25%,rgba(25,21,15,.2) 55%,rgba(25,21,15,.88) 100%),${tint}${bg}" onclick="${o.go}">
    <div class="ctop"><div><span class="lt">Japansk tid · ${o.hm}</span><span class="hn">${o.label}</span></div>
    <div class="cr"><span class="lt">${o.dayTxt}</span><span class="fd">${o.dateTxt}</span></div></div>
    <div class="ccopy"><h1>${esc(o.title)}</h1><div class="cdesc">${esc(o.desc)}</div>
    <div class="cmeta"><div class="ct">${o.time}</div><div class="cp">${o.place}</div></div></div></section>`;
}
function drawNow() {
  const t = now();
  const iso = jp(t, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const hm = jp(t, { hour: '2-digit', minute: '2-digit' });
  document.getElementById('jst').textContent = hm;

  const nb = document.getElementById('nowbox'), wb = document.getElementById('warnbox');
  const ex = document.getElementById('nowextra');
  let d = DAYS.find(x => x.date === iso), pre = null;
  if (!d) {   // före/efter resan: nedräkningsomslag, men resten av sidan visar första dagen
    const first = new Date(DAYS[0].date + 'T00:00:00+09:00');
    const diff = Math.ceil((first - t) / 864e5);
    pre = { diff };
    d = diff > 0 ? DAYS[0] : DAYS[DAYS.length - 1];
  }

  document.getElementById('nusub').textContent = `Dag ${d.n} · ${d.wd} ${d.dl}`;
  const m = pre ? (pre.diff > 0 ? -1 : 1440) : mins(hm);
  // Alla planerade punkter med tid den här dagen, även egna. Startar flera samtidigt
  // går Egna först och en enda väljs (de övriga syns fortfarande i Resplan).
  const tidOk = k => /^\d{1,2}:\d{2}$/.test(IDX[k].t || '');
  const grupper = {};
  Object.keys(IDX).filter(k => IDX[k].dayN === d.n && tidOk(k)).forEach(k => {
    const mm = mins(IDX[k].t);
    const egen = x => (IDX[x].g || []).includes('egen');
    if (!(mm in grupper) || (egen(k) && !egen(grupper[mm]))) grupper[mm] = k;
  });
  const order = Object.keys(grupper).map(Number).sort((x, y) => x - y).map(mm => grupper[mm]);
  const eff = k => IDX[k].t;
  const bildSrc = a => a.photo && PHOTOS[a.photo] ? PHOTOS[a.photo] : (a.img ? `img/${a.img}.jpg` : '');
  const bg = a => { const s = bildSrc(a); return s ? `background-image:url('${s}')` : ''; };
  let ci = -1, ni = -1;
  order.forEach((k, n) => { if (mins(eff(k)) <= m) ci = n; else if (ni < 0) ni = n; });

  const ckn = ci >= 0 ? ci : 0, ck = order[ckn], ca = ck ? IDX[ck] : { n: d.title, d: '', m: '' };
  let h = pre ? coverHtml({ img: 'nijo', label: pre.diff > 0 ? 'Nedräkning' : 'Tack för resan',
    title: pre.diff > 0 ? (pre.diff === 1 ? 'Imorgon bär det av' : pre.diff + ' dagar kvar') : 'Resan är genomförd',
    desc: pre.diff > 0 ? 'Första dagen: ' + d.title : '16 dagar, Kyoto till Tokyo.', time: pre.diff > 0 && ck ? eff(ck) : '', place: pre.diff > 0 ? esc(d.city) : 'Tokyo',
    hm, go: pre.diff > 0 && ck ? `openAct('${ck}')` : 'goPlan(1)', dayTxt: `${DAYS.length} dagar`, dateTxt: '12–27 oktober 2026' }) :
    coverHtml({ src: bildSrc(ca), img: bildSrc(ca) ? null : nowCityImg(d, m),
    label: ci >= 0 ? 'Pågår nu' : 'Dagen börjar', title: ci >= 0 ? ca.n : d.title,
    desc: ca.d || ca.m || '', time: ck ? eff(ck) : '', place: esc(d.city), hm, go: ck ? `openAct('${ck}')` : 'goPlan(' + d.n + ')',
    dayTxt: `Dag ${pad(d.n)} / ${DAYS.length}`, dateTxt: `${d.wd} ${d.dl}` });
  const tot0 = order.length, dn0 = order.filter(k => isDone(k)).length;
  h += `<div class="nowbody"><div class="phead"><span>Dagens program</span><span>${dn0} av ${tot0} klara</span></div>
    <div class="track" style="grid-template-columns:repeat(${Math.max(tot0, 1)},1fr)">${order.map((k, n) => `<i class="${isDone(k) ? 'done' : n === ci ? 'now' : ''}"></i>`).join('')}</div>`;
  if (ni >= 0) {
    const nk = order[ni], a = IDX[nk], dm = mins(eff(nk)) - m;
    h += `<div class="heading"><strong>${pre ? 'Första dagen' : 'Härnäst'}</strong><em>${pre ? d.wd + ' ' + d.dl : 'om ' + (dm >= 60 ? Math.floor(dm / 60) + ' tim' + (dm % 60 ? ' ' + pad(dm % 60) + ' min' : '') : dm + ' min')}</em></div>
      <section class="story" onclick="openAct('${nk}')"><div class="simg" style="${bg(a)}">${bildSrc(a) ? '' : a.i || '📍'}</div>
      <div class="scopy"><div class="stime">${eff(nk)}</div><h2>${esc(a.n)}</h2><p>${esc(miniTxt(nk))}</p></div></section>`;
    const rest = order.slice(ni + 1);
    if (rest.length) h += `<div class="more">${pre ? 'Senare under dagen' : 'Senare idag'}</div>` + rest.map(k => { const a2 = IDX[k];
      return `<section class="later" onclick="openAct('${k}')"><div class="limg" style="${bg(a2)}">${bildSrc(a2) ? '' : a2.i || '📍'}</div>
        <div><div class="ltime">${eff(k)}</div><h3>${esc(a2.n)}</h3><p>${esc(miniTxt(k))}</p></div></section>`; }).join('');
  } else h += `<div class="heading"><strong>Kvällen</strong><em>Dagens program är slut</em></div>`;
  h += '</div>';
  nb.innerHTML = h;
  wb.innerHTML = d.warn ? `<div class="warn"><div class="wi">⚠️</div><p><b>Tänk på</b>${esc(d.warn)}</p></div>` : '';

  ex.innerHTML = `<section class="hotel"><div><small>${pre ? 'Hotell första natten' : 'Hotell ikväll'}</small><h3>${esc(d.hotel)}</h3></div><span>${esc(d.addr)}</span></section>`;
}
function goPlan(n) {
  sel = n; drawChips(); drawActs();
  keepSel = true;
  document.querySelector('.tab[data-s="plan"]').click();
}

/* ---------- Banners: offline och installation ---------- */
function drawBanners() {
  let h = '';
  if (!navigator.onLine) h += '<div class="offline">Offline — allt innehåll finns sparat på enheten</div>';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone && !S.dismissed.install) {
    h += `<div class="banner"><div style="font-size:20px">📲</div>
      <p><b>Lägg till på hemskärmen</b>Tryck på Dela-knappen i Safari och välj ”Lägg till på hemskärmen”. Då fungerar appen offline.</p>
      <button onclick="dismiss('install')">Dölj</button></div>`;
  }
  document.getElementById('banners').innerHTML = h;
}
function dismiss(k) { S.dismissed[k] = 1; save(); drawBanners(); }

/* ---------- Säkerhetskopia ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'japan2026-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.lastBackup = new Date().toISOString(); save(); backupInfo();
}
/* Bilder från Wikimedia Commons sparas som adress i säkerhetskopian (p.psrc / S.pimg[..].src).
   Vid import, eller med knappen "Hämta bilder", hämtas de hem igen när det finns nät.
   Egna foton från telefonen har ingen adress och kan inte följa med. */
function saknadeBilder() {
  const out = [];
  S.places.forEach(p => { if (p.photo && p.psrc && !PHOTOS[p.photo]) out.push({ id: p.photo, src: p.psrc }); });
  Object.keys(S.pimg || {}).forEach(k => { const v = S.pimg[k]; if (v && v.id && v.src && !PHOTOS[v.id]) out.push({ id: v.id, src: v.src }); });
  return out;
}
let bildLaddar = false;
async function hamtaBilder() {
  if (bildLaddar) return;
  const lista = saknadeBilder();
  if (!lista.length) { backupInfo(); return; }
  if (!navigator.onLine) { alert('Du verkar vara offline. Försök igen när du har nät.'); return; }
  bildLaddar = true;
  const btn = document.getElementById('imgbtn');
  btn.disabled = true;
  let ok = 0, fel = 0;
  for (let n = 0; n < lista.length; n++) {
    btn.textContent = `Hämtar bilder… ${n + 1}/${lista.length}`;
    const x = lista[n];
    try {
      let blob;
      try {
        const r = await fetch(x.src.url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        blob = await r.blob();
      } catch (e) {
        if (!x.src.title) throw e;
        // Adressen kan ha ändrats — slå upp bilden på titeln igen
        const q = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
          '&prop=imageinfo&iiprop=url&iiurlwidth=900&titles=' + encodeURIComponent(x.src.title);
        const d = await (await fetch(q)).json();
        const ii = (Object.values(d.query.pages)[0].imageinfo || [{}])[0];
        blob = await (await fetch(ii.thumburl || ii.url)).blob();
      }
      await photoPut(x.id, await shrink(blob));
      ok++;
    } catch (e) { fel++; }
  }
  bildLaddar = false;
  btn.disabled = false;
  drawPlaces(); drawActs(); drawNow(); backupInfo();
  alert(fel ? `${ok} av ${ok + fel} bilder hämtade, ${fel} misslyckades. Försök igen med knappen "Hämta bilder".` : (ok === 1 ? '1 bild hämtad.' : `${ok} bilder hämtade.`));
}
function importData(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const o = JSON.parse(r.result);
      if (!confirm('Ersätt anteckningar, bockar och egna platser med innehållet i filen?')) return;
      ['done', 'notes', 'places', 'times', 'tags', 'contacts', 'packCats', 'pimg'].forEach(k => { if (o[k]) S[k] = o[k]; });
      migreraNoter(); save(); buildIndex(); drawActs(); drawPlaces(); drawNow(); drawLeaders(); backupInfo(); drawPack();
      const n = saknadeBilder().length, bt = n === 1 ? '1 bild' : n + ' bilder';
      if (!n) { alert('Importen är klar.'); return; }
      if (!navigator.onLine) {
        alert(`Importen är klar. Filen har ${bt} som kan hämtas från nätet — du är offline just nu. Tryck på "Hämta bilder" under Mina → Viktig info när du har nät.`);
      } else if (confirm(`Importen är klar. Filen har ${bt} som kan hämtas från nätet. Vill du hämta ${n === 1 ? 'den' : 'dem'} nu?\n\n(Du kan också göra det senare med knappen "Hämta bilder".)`)) {
        await hamtaBilder();
      }
    } catch (e) { alert('Kunde inte läsa filen: ' + e.message); }
  };
  r.readAsText(f);
  input.value = '';
}
/* Foton som valdes innan bildadresser sparades saknar adress. De kommer från Wikimedia Commons
   (se credit), så adressen kan återskapas: sök bilder nära platsen och matcha på credit-texten. */
async function reparaBildkallor() {
  if (!navigator.onLine) return 0;
  const kand = [];
  S.places.forEach(p => { if (p.photo && !p.psrc && p.credit && p.lat != null) kand.push({ lat: p.lat, lng: p.lng, credit: p.credit, set: s => { p.psrc = s; } }); });
  Object.keys(S.pimg || {}).forEach(k => {
    const v = S.pimg[k], a = IDX[k];
    if (v && v.id && !v.src && v.credit && a && a.lat != null) kand.push({ lat: a.lat, lng: a.lng, credit: v.credit, set: s => { v.src = s; } });
  });
  let fixat = 0;
  for (const c of kand.slice(0, 40)) {
    try {
      for (const radie of [400, 1000]) {
        const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
          `&generator=geosearch&ggsnamespace=6&ggslimit=${radie === 400 ? 10 : 30}&ggsradius=${radie}` +
          `&ggscoord=${c.lat}|${c.lng}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900`;
        const d = await (await fetch(u)).json();
        const strip = s => String(s || '').replace(/<[^>]+>/g, '').trim();
        const hit = Object.values((d.query || {}).pages || {}).find(p => {
          const ii = (p.imageinfo || [{}])[0], m = ii.extmetadata || {};
          return (strip(m.Artist && m.Artist.value) || 'Wikimedia Commons') + ' · ' +
                 (strip(m.LicenseShortName && m.LicenseShortName.value) || 'se Commons') === c.credit;
        });
        if (hit) { const ii = hit.imageinfo[0]; c.set({ url: ii.thumburl || ii.url, title: hit.title }); fixat++; break; }
      }
    } catch (e) { /* ingen nät eller blockerat — försök igen nästa gång */ }
  }
  if (fixat) { save(); backupInfo(); }
  return fixat;
}
function backupInfo() {
  const n = S.places.length, notes = Object.keys(S.notes).filter(k => S.notes[k]).length;
  const done = Object.keys(S.done).filter(k => S.done[k]).length;
  const num = Object.keys(S.contacts).length;
  const fotos = [...S.places.filter(p => p.photo), ...Object.values(S.pimg || {}).filter(v => v && v.id)];
  const lank = fotos.filter(v => v.psrc || v.src).length, egna = fotos.length - lank;
  const saknas = saknadeBilder().length;
  document.getElementById('bkinfo').textContent =
    `${notes} anteckningar · ${done} avbockade · ${n} egna platser · ${num} sparade nummer` +
    (lank ? ` · ${lank} bilder sparas som länkar i filen` : '') +
    (egna ? ` · ${egna} egna foton ingår ej i exporten` : '') +
    (S.lastBackup ? ` · senast exporterad ${S.lastBackup.slice(0, 10)}` : '');
  const b = document.getElementById('imgbtn');
  if (b && !bildLaddar) {
    b.style.display = saknas ? '' : 'none';
    b.textContent = `Hämta bilder (${saknas})`;
  }
}

/* Alla kort (aktivitet, stad, ny punkt) öppnas alltid högst upp, och hoppar upp igen
   när man går mellan visning och redigering. */
(() => {
  const forr = new WeakMap();
  const obs = new MutationObserver(list => list.forEach(m => {
    const el = m.target, st = el.classList.contains('on') + '|' + el.classList.contains('view');
    const gammal = forr.get(el);
    forr.set(el, st);
    if (gammal !== undefined && gammal !== st) el.scrollTop = 0;
  }));
  document.querySelectorAll('.sheet').forEach(el => {
    forr.set(el, el.classList.contains('on') + '|' + el.classList.contains('view'));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
})();

/* ---------- Testläge för tid ---------- */
document.getElementById('simt').onchange = e => {
  if (!e.target.value) return;
  sessionStorage.setItem('simtime', new Date(e.target.value).toISOString());
  drawNow(); goToday(); drawChips();
};
function clearSim() {
  sessionStorage.removeItem('simtime');
  document.getElementById('simt').value = '';
  drawNow(); goToday(); drawChips();
}

/* ---------- Service worker ---------- */
const swi = document.getElementById('swinfo');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    swi.textContent = navigator.serviceWorker.controller
      ? 'Offline-läge aktivt. Allt innehåll finns sparat på enheten.'
      : 'Laddar ner innehåll för offline-bruk…';
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      swi.textContent = 'Offline-läge aktivt. Allt innehåll finns sparat på enheten.';
    });
  }).catch(e => { swi.textContent = 'Offline-läge kunde inte startas: ' + e.message; });
} else {
  swi.textContent = location.protocol === 'file:'
    ? 'Offline-läget kräver att appen öppnas via en webbadress, inte som lokal fil.'
    : 'Den här webbläsaren stödjer inte offline-läge.';
}
addEventListener('online', drawBanners);
addEventListener('offline', drawBanners);

/* ---------- "Ingår" räknas som klart när tiden passerat ----------
   Härlett från klockan (även "Testa tid"), så inget sparas på köpet.
   Bockar användaren själv i/ur en punkt gäller det i stället. */
function autoPassed(k) {
  const a = IDX[k];
  if (!a || !a.dayN || !a.date || !a.t) return false;
  const g = a.g || [];
  const ingar = g.includes('ingar'), transport = g.includes('transport');
  if (!ingar && !transport) return false;
  const t = now();
  const iso = jp(t, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (a.date < iso) return true;
  if (a.date > iso) return false;
  const nu = mins(jp(t, { hour: '2-digit', minute: '2-digit' }));
  if (ingar && mins(a.t) <= nu) return true;          // Ingår: klar när starttiden passerat
  if (transport) {                                    // Transport: klar när nästa punkt på dagen startar
    let nasta = null;
    for (const k2 in IDX) {
      const b = IDX[k2];
      if (k2 === k || b.dayN !== a.dayN || !b.t || mins(b.t) <= mins(a.t)) continue;
      if (nasta === null || mins(b.t) < nasta) nasta = mins(b.t);
    }
    if (nasta !== null && nasta <= nu) return true;
  }
  return false;
}
const isDone = k => S.done[k] !== undefined ? !!S.done[k] : autoPassed(k);
const autoRefresh = () => { drawActs(); drawNow(); backupInfo(); };

/* ---------- Start ---------- */
migreraNoter();
buildIndex();
sel = todayDay() || DAYS[0].n;
drawChips(); drawFilters(); drawActs(); drawPlaces(); drawHotels(); drawLeaders();
drawRoute(); drawCities();
drawNow(); drawBanners(); backupInfo();
loadPhotos().then(() => { drawPlaces(); drawActs(); drawNow(); backupInfo(); reparaBildkallor(); });
// Vädret hämtas i bakgrunden. Tills det kommit visas normalvärdena.
let wxBusy = false;
function wxRita() {
  drawActs();
  if (curCity) drawCityWx(CITIES.find(c => c.n === curCity));
  if (document.getElementById('s-mina').classList.contains('on')) drawPackSum();
}
function wxUppdatera() {
  if (wxBusy || Date.now() - WX.at < 3 * 3600 * 1000) return;
  wxBusy = true;
  wxHamta().then(ok => { if (ok) wxRita(); }).finally(() => { wxBusy = false; });
}
wxUppdatera();
addEventListener('online', wxUppdatera);
setInterval(autoRefresh, 60000);
// När appen plockas fram igen kan dygnet ha vänt — hoppa till rätt dag om
// användaren inte själv har bläddrat någon annanstans.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  autoRefresh();
  wxUppdatera();
  const d = todayDay() || DAYS[0].n;
  if (!valdSjalv && d !== sel) { sel = d; drawChips(); drawActs(); }
});