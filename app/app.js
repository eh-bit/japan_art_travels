/* Japan 2026 — reseapp. All data sparas lokalt på enheten. */

const TAG = {
  ingar:     { l: 'Ingår',      c: '#2f5e46', b: '#e3f1e9' },
  transport: { l: 'Transport',  c: '#1f5068', b: '#e2eef5' },
  aktivitet: { l: 'Aktivitet',  c: '#205e5b', b: '#dcebea' },
  mat:       { l: 'Restaurang', c: '#9a3b12', b: '#fbe4da' },
  shopping:  { l: 'Shopping',   c: '#6b3a86', b: '#f0e5f8' },
  bokad:     { l: 'Bokad',      c: '#8a6100', b: '#fff3d6' },
  fri:       { l: 'Fri tid',    c: '#6b6b64', b: '#f1f0ea' },
  hotell:    { l: 'Hotell',     c: '#123c3a', b: '#e8e3d9' },
  egen:      { l: 'Egen',       c: '#5a5a52', b: '#f2f1ed' },
  ovrigt:    { l: 'Övrigt',     c: '#5a5a52', b: '#eeedea' }
};
const DAYS = window.DAYS;
const KEY = 'japan2026';
const TZ = 'Asia/Tokyo';

const S = Object.assign({ done: {}, notes: {}, places: [], times: {}, tags: {}, dismissed: {}, contacts: {} },
  JSON.parse(localStorage.getItem(KEY) || '{}'));
S.contacts = S.contacts || {};
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

let sel = 1, filt = 'all', cat = 'alla', cur = null, mediaMode = 'bild', editTags = [];
let valdSjalv = false;   // true så fort användaren själv valt en dag
const mins = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Tid ---------- */
function now() {
  const sim = sessionStorage.getItem('simtime');
  return sim ? new Date(sim) : new Date();
}
const jp = (d, o) => new Intl.DateTimeFormat('sv-SE', Object.assign({ timeZone: TZ }, o)).format(d);

/* ---------- Index över alla punkter ---------- */
const IDX = {};
function buildIndex() {
  for (const k in IDX) delete IDX[k];
  DAYS.forEach(d => d.acts.forEach((a, i) => IDX['d' + d.n + '-' + i] = Object.assign({}, a, { dayN: d.n })));
  S.places.forEach(p => IDX[p.id] = {
    t: p.t, n: p.name, m: p.addr || '', d: p.note || p.addr || '',
    g: ['egen', p.cat], dayN: p.day, i: '📍', own: 1,
    lat: p.lat, lng: p.lng, photo: p.photo, credit: p.credit,
    L: p.url ? [['Öppna länken', p.url]] : []
  });
  Object.keys(IDX).forEach(k => {
    if (S.times[k]) IDX[k].t = S.times[k];
    if (S.tags[k]) IDX[k].g = S.tags[k].slice();
  });
}
const tagHtml = g => (g || []).map(k => {
  const t = TAG[k];
  return t ? `<span class="tg" style="color:${t.c};background:${t.b}">${t.l}</span>` : '';
}).join('');

/* ---------- Navigering ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-' + b.dataset.s).classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
});
document.querySelectorAll('#catseg button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#catseg button').forEach(x => x.classList.toggle('on', x === b));
  cat = b.dataset.c; drawPlaces();
});
document.querySelectorAll('#minaseg button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#minaseg button').forEach(x => x.classList.toggle('on', x === b));
  const v = b.dataset.v;
  document.getElementById('mina-platser').style.display = v === 'platser' ? '' : 'none';
  document.getElementById('mina-info').style.display = v === 'info' ? '' : 'none';
  document.getElementById('minaSub').textContent = v === 'platser' ? 'Egna tips utanför programmet' : 'Kontakter, flyg och hotell';
  document.getElementById('scroll').scrollTop = 0;
});

/* ---------- Resplan ---------- */
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
  if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function pick(n) { sel = n; valdSjalv = true; drawChips(); drawActs(); }
function drawFilters() {
  let h = [['all', 'Alla'], ['todo', 'Kvar']].map(([k, l]) =>
    `<button class="fch ${filt === k ? 'on' : ''}" onclick="setFilt('${k}')">${l}</button>`).join('');
  h += Object.keys(TAG).map(k => {
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
  document.getElementById('dayhead').innerHTML =
    `<h2>${esc(d.title)}</h2><p>Dag ${d.n} · ${d.wd} ${d.dl} · ${esc(d.city)}</p>`;
  let keys = d.acts.map((a, i) => 'd' + d.n + '-' + i)
    .concat(S.places.filter(p => p.day === d.n).map(p => p.id));
  let list = keys.map(k => Object.assign({ k }, IDX[k])).sort((a, b) => mins(a.t) - mins(b.t));
  if (filt === 'todo') list = list.filter(a => !S.done[a.k]);
  else if (filt !== 'all') list = list.filter(a => (a.g || []).includes(filt));
  document.getElementById('acts').innerHTML = list.length ? list.map(a => {
    const dn = S.done[a.k], nt = S.notes[a.k];
    const own = a.photo && PHOTOS[a.photo];
    const thumb = own ? `<img class="athumb" src="${own}" alt="">`
      : a.img ? `<img class="athumb" src="img/${a.img}.jpg" alt="">`
      : `<div class="athumb ph">${a.i || '📍'}</div>`;
    return `<div class="act ${dn ? 'done' : ''}" onclick="openAct('${a.k}')">
      <div class="tick"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M4 12.5l5.5 5.5L20 7"/></svg></div>
      ${thumb}
      <div class="abody"><div class="at">${a.t}</div><div class="an">${esc(a.n)}</div>
      ${a.m ? `<div class="ameta">${esc(a.m)}${nt ? ' · <span class="hasnote">✎</span>' : ''}</div>`
            : (nt ? '<div class="ameta"><span class="hasnote">✎ anteckning</span></div>' : '')}
      <div class="tags">${tagHtml(a.g)}</div></div></div>`;
  }).join('') : '<div class="empty"><div class="e">✓</div><p>Inget matchar filtret.</p></div>';
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
    return `<div class="rdot" style="left:${Math.round(x)}px;top:${Math.round(y)}px"
      onclick="focusCity(${p.n})">${p.n}</div>`;
  }).join('');
  if (opts.keep) routeV = v;
  return `<div class="rmap" style="height:${h}px;--dx:${v.dx}px;--dy:${v.dy}px;--s:${v.s}">
    <div class="layer" style="width:${Math.round(v.vw)}px;height:${Math.round(v.vh)}px">${t}</div>
    <div class="ovl"><svg>
      <polyline points="${line}" fill="none" stroke="#fff" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
      <polyline points="${line}" fill="none" stroke="#e07a5f" stroke-width="2.6"
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
function drawCities() {
  document.getElementById('ruttSub').textContent =
    `${CITIES.length} städer · ${CITIES[0].name} till ${CITIES[CITIES.length - 1].name}`;
  document.getElementById('citylist').innerHTML = CITIES.map(c => `
    <div class="city" id="city-${c.n}">
      <div class="num">${c.n}</div>
      <img src="img/${c.img}.jpg" alt="">
      <div class="cb">
        <h3>${esc(c.name)}</h3>
        <div class="pill">${esc(c.dl)}</div>
        <p>${esc(c.txt)}</p>
        <div class="lk">
          <button class="go" onclick="goDay(${c.d1})">Dagarna i appen</button>
          <a class="ext" href="${c.url}" target="_blank" rel="noopener">${esc(c.lk)} ↗</a>
        </div></div></div>`).join('');
}
function openRoute() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const sr = document.getElementById('s-rutt');
  sr.classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
  const el = document.getElementById('ruttmap');
  el.classList.remove('fast');
  el.innerHTML = routeMapHtml(el.clientWidth, RTALL, { keep: true });
  sr.style.setProperty('--strip', routeV.short + 'px');
}
function closeRoute() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-plan').classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
}
function goDay(n) { closeRoute(); pick(n); }
function setStrip(h) {
  const el = document.querySelector('#ruttmap .rmap');
  if (!el || !routeV) return;
  el.style.height = h + 'px';
  el.style.setProperty('--off', (-(RTALL - h) / 2) + 'px');
}
function focusCity(n) {
  document.querySelectorAll('.city').forEach(e => e.classList.toggle('on', e.id === 'city-' + n));
  document.querySelectorAll('.rdot').forEach(e => e.classList.toggle('on', +e.textContent === n));
  const el = document.getElementById('city-' + n);
  if (!el) return;
  // Kartan måste ha sin slutliga höjd innan vi rullar, annars siktar webbläsaren
  // på en position som försvinner när remsan krymper.
  document.getElementById('ruttmap').classList.add('fast');
  setStrip(routeV.short);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Kartan krymper till en remsa när man rullar, så den syns kvar bland stadskorten.
document.getElementById('scroll').addEventListener('scroll', () => {
  if (!document.getElementById('s-rutt').classList.contains('on') || !routeV) return;
  const t = document.getElementById('scroll').scrollTop;
  document.getElementById('ruttmap').classList.toggle('fast', t > 2);
  setStrip(Math.max(routeV.short, RTALL - t));
}, { passive: true });

/* ---------- Detaljpanel ---------- */
function openAct(k) {
  cur = k; mediaMode = 'bild';
  const a = IDX[k], d = DAYS.find(x => x.n === a.dayN);
  document.getElementById('shT').textContent = a.n;
  document.getElementById('shM').textContent = a.dayN ? `Dag ${a.dayN}${d ? ' · ' + d.wd + ' ' + d.dl : ''}` : 'Ingen dag';
  document.getElementById('shTime').value = a.t;
  editTags = (a.g || []).slice();
  renderTagEdit();
  document.getElementById('shD').textContent = a.d || a.m || 'Ingen beskrivning — lägg till en egen anteckning nedan.';
  document.getElementById('shMapBtn').innerHTML = a.lat != null
    ? `<div class="maprow">
        <a class="maplink" href="https://maps.apple.com/?ll=${a.lat},${a.lng}&q=${encodeURIComponent(a.n)}" target="_blank" rel="noopener">Apple Kartor</a>
        <a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}" target="_blank" rel="noopener">Google Maps</a>
       </div>` : '';
  document.getElementById('shL').innerHTML = (a.L || []).map(([t, u]) =>
    `<a class="${/youtube/.test(u) ? 'yt' : ''}" href="${u}" target="_blank" rel="noopener">${/youtube/.test(u) ? '▶' : '↗'} ${esc(t)}</a>`).join('');
  document.getElementById('shN').value = S.notes[k] || '';
  document.getElementById('shSw').classList.toggle('on', !!S.done[k]);
  document.getElementById('delBtn').style.display = a.own ? '' : 'none';
  drawMedia();
  document.getElementById('sheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
  shBase = shSnapshot();
}
function drawMedia() {
  const a = IDX[cur], el = document.getElementById('shMedia');
  const own = a.photo && PHOTOS[a.photo] ? PHOTOS[a.photo] : null;
  const hasImg = !!a.img || !!own, hasMap = a.lat != null;
  const pic = own ? `<img src="${own}" alt="">${a.credit ? `<div class="satt" style="left:4px;right:auto;max-width:70%">${esc(a.credit)}</div>` : ''}`
    : (a.img ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="noimg">${a.i || '📍'}</div>`);
  let inner = (mediaMode === 'karta' && hasMap)
    ? tileMap(a.lat, a.lng, 15, el.clientWidth || 390, 210, !!a.own)
    : pic;
  if (hasMap && hasImg) inner += `<div class="mtoggle">
    <button class="${mediaMode === 'bild' ? 'on' : ''}" onclick="setMedia('bild')">Bild</button>
    <button class="${mediaMode === 'karta' ? 'on' : ''}" onclick="setMedia('karta')">Karta</button></div>`;
  else if (hasMap && !hasImg) { inner = tileMap(a.lat, a.lng, 15, el.clientWidth || 390, 210, !!a.own); }
  el.innerHTML = inner;
}
/* Kartrutor: programmets platser ligger lokalt, egna hämtas och cachas vid behov. */
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
  S.done[cur] = !S.done[cur]; save();
  document.getElementById('shSw').classList.toggle('on', !!S.done[cur]);
  drawActs(); drawNow();
}
function saveDetail() {
  S.notes[cur] = document.getElementById('shN').value;
  const tv = document.getElementById('shTime').value;
  if (tv) {
    S.times[cur] = tv;
    const p = S.places.find(x => x.id === cur);
    if (p) p.t = tv;
  }
  S.tags[cur] = editTags.slice();
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces(); drawNow();
}
function delPlace() {
  if (!confirm('Ta bort den här platsen?')) return;
  const p = S.places.find(x => x.id === cur);
  if (p && p.photo) photoDel(p.photo);
  S.places = S.places.filter(p => p.id !== cur);
  delete S.notes[cur]; delete S.done[cur]; delete S.times[cur]; delete S.tags[cur];
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces();
}
function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => { s.classList.remove('on'); s.style.transform = ''; });
  document.getElementById('scrim').classList.remove('on');
  shBase = null;
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
  editTags.slice().sort()]);
const shDirty = () => shBase !== null && shSnapshot() !== shBase;

(function dragToClose() {
  const sh = document.getElementById('sheet');
  let y0 = null, dy = 0;
  sh.addEventListener('pointerdown', e => {
    // Bara från toppen av kortet, och inte när man träffar något man kan trycka på.
    if (sh.scrollTop > 0 || e.target.closest('button,a,input,select,textarea,.tg')) return;
    y0 = e.clientY; dy = 0;
    sh.style.transition = 'none';
  });
  sh.addEventListener('pointermove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    sh.style.transform = `translateY(${dy}px)`;
  });
  const slapp = () => {
    if (y0 === null) return;
    sh.style.transition = '';
    sh.style.transform = '';
    if (dy > 90) {
      if (shDirty()) toast('Du har ändringar — spara eller stäng.');
      else closeSheets();
    }
    y0 = null;
  };
  sh.addEventListener('pointerup', slapp);
  sh.addEventListener('pointercancel', slapp);
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
    setPicked({ name: p.name, lat: p.lat, lng: p.lng, addr: '', url: p.url });
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

async function pickPhoto(input) {
  const f = input.files[0];
  input.value = '';
  if (!f) return;
  const hint = document.getElementById('adPhotoHint');
  hint.textContent = 'Bearbetar fotot…';
  try {
    newPhoto = { blob: await shrink(f), credit: '' };
    drawPhotoPrev();
    hint.textContent = `Fotot sparas på enheten (${Math.round(newPhoto.blob.size / 1024)} kB).`;
  } catch (e) {
    hint.textContent = 'Kunde inte läsa fotot: ' + e.message;
  }
}
function drawPhotoPrev() {
  const el = document.getElementById('adPhotoPrev');
  if (!newPhoto) { el.innerHTML = ''; return; }
  const u = URL.createObjectURL(newPhoto.blob);
  el.innerHTML = `<div class="pprev"><img src="${u}" alt="">
    <button onclick="clearPhoto()">Ta bort</button>
    ${newPhoto.credit ? `<div class="cr">${esc(newPhoto.credit)}</div>` : ''}</div>`;
}
function clearPhoto() {
  newPhoto = null;
  document.getElementById('adPhotoPrev').innerHTML = '';
  document.getElementById('adPhotoHint').textContent =
    'Fotot sparas på enheten och visas på platsen. ”Från platsen” kräver att du valt en plats ovan.';
}

/* Bilder nära koordinaten, från Wikimedia Commons. Träffar beror på vad som finns
   fotograferat — bra för sevärdheter, ofta tomt för små restauranger. */
async function suggestPhotos() {
  if (!picked) return;
  const box = document.getElementById('adSug');
  box.innerHTML = '<p class="searching">Söker bilder nära platsen…</p>';
  try {
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=geosearch&ggsnamespace=6&ggslimit=10&ggsradius=400' +
      `&ggscoord=${picked.lat}|${picked.lng}` +
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
      `<img src="${x.thumb}" alt="" onclick="useSuggestion(${i},this)">`).join('') + '</div>';
  } catch (e) {
    box.innerHTML = '<p class="searching">Bilsökningen misslyckades — kräver nät.</p>';
  }
}
async function useSuggestion(i, el) {
  const s = sugg[i];
  el.classList.add('busy');
  const hint = document.getElementById('adPhotoHint');
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
    newPhoto = { blob: await shrink(blob), credit: s.credit };
    drawPhotoPrev();
    document.getElementById('adSug').innerHTML = '';
    hint.textContent = `Bilden sparas på enheten (${Math.round(newPhoto.blob.size / 1024)} kB).`;
  } catch (e) {
    el.classList.remove('busy');
    hint.textContent = 'Kunde inte hämta bilden: ' + e.message;
  }
}

function openAdd(fromPlaces) {
  document.getElementById('adT').textContent = fromPlaces ? 'Ny plats' : 'Ny punkt';
  document.getElementById('adD').innerHTML = '<option value="0">Ingen dag — bara en idé</option>' +
    DAYS.map(d => `<option value="${d.n}" ${d.n === sel && !fromPlaces ? 'selected' : ''}>Dag ${d.n} · ${d.dl} · ${esc(d.city)}</option>`).join('');
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
  const p = {
    id: 'p' + Date.now(), name: n,
    cat: document.getElementById('adC').value,
    t: document.getElementById('adTi').value,
    day: +document.getElementById('adD').value,
    note: document.getElementById('adNo').value.trim()
  };
  if (picked) {
    p.lat = picked.lat; p.lng = picked.lng;
    p.addr = picked.addr; p.url = picked.url;
    warmTiles(picked.lat, picked.lng);
  }
  if (newPhoto) {
    p.photo = 'ph' + Date.now();
    p.credit = newPhoto.credit;
    try { await photoPut(p.photo, newPhoto.blob); }
    catch (e) { delete p.photo; alert('Fotot kunde inte sparas: ' + e.message); }
  }
  S.places.push(p);
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces(); backupInfo();
}
function drawPlaces() {
  const ic = { mat: '🍜', aktivitet: '🖼️', shopping: '🛍️', ovrigt: '📍' };
  const l = S.places.filter(p => cat === 'alla' || p.cat === cat);
  document.getElementById('places').innerHTML = l.length ? l.map(p => {
    const d = DAYS.find(x => x.n === p.day);
    return `<div class="card" onclick="openAct('${p.id}')" style="cursor:pointer">
      <div style="display:flex;gap:11px;align-items:center">
        ${p.photo && PHOTOS[p.photo] ? `<img class="pthumb" src="${PHOTOS[p.photo]}" alt="">`
          : `<div class="ico">${ic[p.cat] || '📍'}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:650">${esc(p.name)}</div>
          <div style="font-size:11.5px;color:var(--ink-faint);margin-top:2px">${p.t} · ${d ? 'Dag ' + d.n + ' (' + d.dl + ')' : 'Ingen dag'}</div>
        </div></div>
      ${p.addr ? `<p style="font-size:11.5px;color:var(--ink-faint);margin:7px 0 0;line-height:1.4">📍 ${esc(p.addr)}</p>` : ''}
      ${p.note ? `<p style="font-size:12.5px;color:var(--ink-soft);margin:9px 0 0;line-height:1.45">${esc(p.note)}</p>` : ''}
      <div class="tags" style="margin-top:8px">${tagHtml(['egen', p.cat])}</div></div>`;
  }).join('') : '<div class="empty"><div class="e">🍜</div><p>Inga egna platser än.<br>Lägg till restauranger och museer<br>ni hittar på vägen.</p></div>';
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
function drawNow() {
  const t = now();
  const iso = jp(t, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const hm = jp(t, { hour: '2-digit', minute: '2-digit' });
  document.getElementById('jst').textContent = hm;

  const nb = document.getElementById('nowbox'), wb = document.getElementById('warnbox');
  const ex = document.getElementById('nowextra');
  const d = DAYS.find(x => x.date === iso);

  if (!d) {
    const first = new Date(DAYS[0].date + 'T00:00:00+09:00');
    const diff = Math.ceil((first - t) / 864e5);
    document.getElementById('nusub').textContent = diff > 0 ? 'Före avresa' : 'Resan är slut';
    nb.innerHTML = `<div class="hero" onclick="goPlan(1)">
      <img src="img/nijo.jpg" alt="">
      <div class="ov"><div class="badge">${diff > 0 ? 'Nedräkning' : 'Tack för resan'}</div>
      <h2>${diff > 0 ? (diff === 1 ? 'Imorgon bär det av' : diff + ' dagar kvar') : 'Resan är genomförd'}</h2>
      <div class="mt">${diff > 0 ? 'Avresa 12 oktober · Arlanda 09:00' : '12–27 oktober 2026'}</div></div></div>`;
    wb.innerHTML = '';
    ex.innerHTML = `<div class="mini"><div class="mi">🗾</div><div class="mt">
      <b>Hela resplanen finns i appen</b>16 dagar, Kyoto till Tokyo</div></div>`;
    return;
  }

  document.getElementById('nusub').textContent = `Dag ${d.n} · ${d.wd} ${d.dl}`;
  const m = mins(hm);
  const eff = i => S.times['d' + d.n + '-' + i] || d.acts[i].t;
  const order = d.acts.map((a, i) => i).sort((x, y) => mins(eff(x)) - mins(eff(y)));
  let ci = -1, ni = -1;
  order.forEach(i => { if (mins(eff(i)) <= m) ci = i; else if (ni < 0) ni = i; });

  let h = '';
  if (ci >= 0) {
    const a = d.acts[ci];
    h += `<div class="hero" onclick="openAct('d${d.n}-${ci}')">
      ${a.img ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="noimg">${a.i || '📍'}</div>`}
      <div class="tapicon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></div>
      <div class="ov"><div class="badge">Pågår nu</div><h2>${esc(a.n)}</h2>
      <div class="mt">Startade ${eff(ci)}${a.m ? ' · ' + esc(a.m) : ''}</div></div></div>`;
  } else {
    const i0 = order[0], a = d.acts[i0];
    h += `<div class="hero" onclick="openAct('d${d.n}-${i0}')">
      ${a.img ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="noimg">${a.i || '🌅'}</div>`}
      <div class="ov"><div class="badge">Dagen börjar</div><h2>${esc(d.title)}</h2>
      <div class="mt">Första punkten ${eff(i0)} · ${esc(a.n)}</div></div></div>`;
  }
  if (ni >= 0) {
    const a = d.acts[ni], dm = mins(eff(ni)) - m;
    h += `<div class="nxt" onclick="openAct('d${d.n}-${ni}')">
      ${a.img ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="ph">${a.i || '📍'}</div>`}
      <div class="b"><div class="lb">Härnäst · om ${dm >= 60 ? Math.floor(dm / 60) + ' tim' + (dm % 60 ? ' ' + pad(dm % 60) + ' min' : '') : dm + ' min'}</div>
      <div class="t">${esc(a.n)}</div><div class="m">${eff(ni)}${a.m ? ' · ' + esc(a.m) : ''}</div></div></div>`;
  } else {
    h += `<div class="nxt" onclick="goPlan(${d.n})"><div class="ph">🛏️</div><div class="b">
      <div class="lb">Kvällen</div><div class="t">Dagens program är slut</div><div class="m">${esc(d.hotel)}</div></div></div>`;
  }
  nb.innerHTML = h;
  wb.innerHTML = d.warn ? `<div class="warn"><div class="wi">⚠️</div><p><b>Tänk på</b>${esc(d.warn)}</p></div>` : '';

  const tot = d.acts.length, dn = d.acts.filter((a, i) => S.done['d' + d.n + '-' + i]).length;
  ex.innerHTML = `
    <div class="mini"><div class="mi">📍</div><div class="mt">
      <b>${esc(d.hotel)}</b>${esc(d.addr)}</div></div>
    <div class="mini"><div class="mi">✓</div>
      <div class="prog"><i style="width:${tot ? dn / tot * 100 : 0}%"></i></div>
      <div class="pnum">${dn} / ${tot}</div></div>
    <p class="hint">Tiderna är uppskattade utifrån reseplanens ”förmiddag/eftermiddag”. Öppna en punkt för att ändra.</p>`;
}
function goPlan(n) {
  sel = n; drawChips(); drawActs();
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
function importData(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      if (!confirm('Ersätt anteckningar, bockar och egna platser med innehållet i filen?')) return;
      ['done', 'notes', 'places', 'times', 'tags', 'contacts'].forEach(k => { if (o[k]) S[k] = o[k]; });
      save(); buildIndex(); drawActs(); drawPlaces(); drawNow(); drawLeaders(); backupInfo();
      alert('Importen är klar.');
    } catch (e) { alert('Kunde inte läsa filen: ' + e.message); }
  };
  r.readAsText(f);
  input.value = '';
}
function backupInfo() {
  const n = S.places.length, notes = Object.keys(S.notes).filter(k => S.notes[k]).length;
  const done = Object.keys(S.done).filter(k => S.done[k]).length;
  const num = Object.keys(S.contacts).length;
  const ph = S.places.filter(p => p.photo).length;
  document.getElementById('bkinfo').textContent =
    `${notes} anteckningar · ${done} avbockade · ${n} egna platser · ${num} sparade nummer` +
    (ph ? ` · ${ph} foton (ingår ej i exporten)` : '') +
    (S.lastBackup ? ` · senast exporterad ${S.lastBackup.slice(0, 10)}` : '');
}

/* ---------- Testläge för tid ---------- */
document.getElementById('simt').onchange = e => {
  if (!e.target.value) return;
  sessionStorage.setItem('simtime', new Date(e.target.value).toISOString());
  drawNow(); drawChips();
};
function clearSim() {
  sessionStorage.removeItem('simtime');
  document.getElementById('simt').value = '';
  drawNow(); drawChips();
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

/* ---------- Start ---------- */
buildIndex();
sel = todayDay() || DAYS[0].n;
drawChips(); drawFilters(); drawActs(); drawPlaces(); drawHotels(); drawLeaders();
drawRoute(); drawCities();
drawNow(); drawBanners(); backupInfo();
loadPhotos().then(() => { drawPlaces(); drawActs(); drawNow(); backupInfo(); });
setInterval(drawNow, 60000);
// När appen plockas fram igen kan dygnet ha vänt — hoppa till rätt dag om
// användaren inte själv har bläddrat någon annanstans.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  drawNow();
  const d = todayDay() || DAYS[0].n;
  if (!valdSjalv && d !== sel) { sel = d; drawChips(); drawActs(); }
});
