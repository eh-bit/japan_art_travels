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
    t: p.t, n: p.name, m: p.note || '', d: p.note || '',
    g: ['egen', p.cat], dayN: p.day, i: '📍', own: 1
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
function pick(n) { sel = n; drawChips(); drawActs(); }
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
    const thumb = a.img ? `<img class="athumb" src="img/${a.img}.jpg" alt="">`
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
}
function drawMedia() {
  const a = IDX[cur], el = document.getElementById('shMedia');
  const hasImg = !!a.img, hasMap = a.lat != null;
  let inner = (mediaMode === 'karta' && hasMap)
    ? tileMap(a.lat, a.lng, 15, el.clientWidth || 390, 210)
    : (hasImg ? `<img src="img/${a.img}.jpg" alt="">` : `<div class="noimg">${a.i || '📍'}</div>`);
  if (hasMap && hasImg) inner += `<div class="mtoggle">
    <button class="${mediaMode === 'bild' ? 'on' : ''}" onclick="setMedia('bild')">Bild</button>
    <button class="${mediaMode === 'karta' ? 'on' : ''}" onclick="setMedia('karta')">Karta</button></div>`;
  else if (hasMap && !hasImg) { inner = tileMap(a.lat, a.lng, 15, el.clientWidth || 390, 210); }
  el.innerHTML = inner;
}
/* Kartrutor som vanliga bilder — ligger lokalt och fungerar utan nät. */
function tileMap(lat, lng, z, W, H) {
  const n = 2 ** z, xw = (lng + 180) / 360 * n, lr = lat * Math.PI / 180;
  const yw = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
  const left = xw * 256 - W / 2, top = yw * 256 - H / 2;
  let t = '';
  for (let tx = Math.floor(left / 256); tx <= Math.floor((left + W) / 256); tx++)
    for (let ty = Math.floor(top / 256); ty <= Math.floor((top + H) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      const xx = ((tx % n) + n) % n;
      t += `<img class="tl" src="tiles/${z}/${xx}/${ty}.png" style="left:${Math.round(tx * 256 - left)}px;top:${Math.round(ty * 256 - top)}px" alt="">`;
    }
  return `<div class="smap">${t}<div class="smk"></div><div class="satt">© OpenStreetMap</div></div>`;
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
  S.places = S.places.filter(p => p.id !== cur);
  delete S.notes[cur]; delete S.done[cur]; delete S.times[cur]; delete S.tags[cur];
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces();
}
function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  document.getElementById('scrim').classList.remove('on');
}

/* ---------- Egna platser ---------- */
function openAdd(fromPlaces) {
  document.getElementById('adT').textContent = fromPlaces ? 'Ny plats' : 'Ny punkt';
  document.getElementById('adD').innerHTML = '<option value="0">Ingen dag — bara en idé</option>' +
    DAYS.map(d => `<option value="${d.n}" ${d.n === sel && !fromPlaces ? 'selected' : ''}>Dag ${d.n} · ${d.dl} · ${esc(d.city)}</option>`).join('');
  document.getElementById('adN').value = '';
  document.getElementById('adNo').value = '';
  document.getElementById('addsheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
}
function savePlace() {
  const n = document.getElementById('adN').value.trim();
  if (!n) { document.getElementById('adN').focus(); return; }
  S.places.push({
    id: 'p' + Date.now(), name: n,
    cat: document.getElementById('adC').value,
    t: document.getElementById('adTi').value,
    day: +document.getElementById('adD').value,
    note: document.getElementById('adNo').value.trim()
  });
  save(); buildIndex(); closeSheets(); drawActs(); drawPlaces();
}
function drawPlaces() {
  const ic = { mat: '🍜', aktivitet: '🖼️', shopping: '🛍️', ovrigt: '📍' };
  const l = S.places.filter(p => cat === 'alla' || p.cat === cat);
  document.getElementById('places').innerHTML = l.length ? l.map(p => {
    const d = DAYS.find(x => x.n === p.day);
    return `<div class="card" onclick="openAct('${p.id}')" style="cursor:pointer">
      <div style="display:flex;gap:11px;align-items:center">
        <div class="ico">${ic[p.cat] || '📍'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:650">${esc(p.name)}</div>
          <div style="font-size:11.5px;color:var(--ink-faint);margin-top:2px">${p.t} · ${d ? 'Dag ' + d.n + ' (' + d.dl + ')' : 'Ingen dag'}</div>
        </div></div>
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
  document.getElementById('bkinfo').textContent =
    `${notes} anteckningar · ${done} avbockade · ${n} egna platser · ${num} sparade nummer` +
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
sel = todayDay() || 1;
drawChips(); drawFilters(); drawActs(); drawPlaces(); drawHotels(); drawLeaders();
drawNow(); drawBanners(); backupInfo();
setInterval(drawNow, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) drawNow(); });
