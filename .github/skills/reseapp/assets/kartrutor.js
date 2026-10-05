/* Kartor som rutnät av <img> istället för Leaflet eller inbäddad karta.
   Vanliga bildfiler går att förhandscacha — det gör inte en dynamisk karta.
   Konstanterna måste vara identiska med byggskriptets, annars begär appen
   rutor som inte laddats hem. */

/* ---------- Gemensam projektion (Web Mercator) ---------- */
function worldPx(lat, lng, z) {
  const n = 2 ** z * 256, lr = lat * Math.PI / 180;
  return { x: (lng + 180) / 360 * n,
           y: (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n };
}

const tileUrl = (z, x, y, remote) => remote
  ? `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  : `tiles/${z}/${x}/${y}.png`;

/* ---------- En plats: karta centrerad på en koordinat ---------- */
function tileCoords(lat, lng, z, W, H) {
  const n = 2 ** z, p = worldPx(lat, lng, z);
  const left = p.x - W / 2, top = p.y - H / 2, out = [];
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

// Hämtar hem rutorna direkt så en nyss tillagd plats fungerar utan nät senare
function warmTiles(lat, lng) {
  const urls = tileCoords(lat, lng, 15, 440, 260).map(c => tileUrl(c.z, c.x, c.y, true));
  return Promise.allSettled(urls.map(u => fetch(u, { mode: 'no-cors' })));
}

/* ---------- Hela rutten: fast utsnitt runt alla orter ---------- */
const RZ = 7, RPAD = 64, RASPECT = .88;

function routeView(punkter, w, h) {
  const pts = punkter.map(c => Object.assign({ n: c.n }, worldPx(c.lat, c.lng, RZ)));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const vw = Math.max(...xs) - Math.min(...xs) + RPAD * 2, vh = vw * RASPECT;
  const ox = Math.min(...xs) - RPAD, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - vh / 2;
  const s = Math.max(w / vw, h / vh);
  // Remsan får vara precis så hög att alla punkter ryms med sina cirklar
  const short = Math.min(h, Math.round((Math.max(...ys) - Math.min(...ys)) * s) + 34);
  return { pts, vw, vh, ox, oy, s, short, dx: (w - vw * s) / 2, dy: (h - vh * s) / 2 };
}

function routeMapHtml(punkter, w, h, opts = {}) {
  const v = routeView(punkter, w, h);
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
  return `<div class="rmap" style="height:${h}px;--dx:${v.dx}px;--dy:${v.dy}px;--s:${v.s}">
    <div class="layer" style="width:${Math.round(v.vw)}px;height:${Math.round(v.vh)}px">${t}</div>
    <div class="ovl"><svg>
      <polyline points="${line}" fill="none" stroke="#fff" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
      <polyline points="${line}" fill="none" stroke="#e07a5f" stroke-width="2.6"
        stroke-dasharray="3,5.5" stroke-linecap="round"/></svg>${dots}</div>
    ${opts.att === false ? '' : '<div class="satt">© OpenStreetMap</div>'}</div>`;
}

/* CSS som hör till:

.smap{position:relative;width:100%;height:100%;overflow:hidden;background:#e8e4dc;}
.smap img.tl{position:absolute;width:256px;height:256px;max-width:none;}
.smk{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;
  border-radius:50%;background:#e07a5f;border:3px solid #fff;z-index:2;}
.satt{position:absolute;right:4px;bottom:3px;font-size:8px;color:#4a4a44;
  background:rgba(255,255,255,.75);padding:1px 5px;border-radius:3px;z-index:2;}

.rmap{position:relative;overflow:hidden;background:#dfe6e0;}
.rmap img.tl{position:absolute;width:256px;height:256px;max-width:none;}
.rmap .layer{position:absolute;top:0;left:0;transform-origin:0 0;
  transform:translate(var(--dx),calc(var(--dy) + var(--off,0px))) scale(var(--s));}
.rmap .ovl{position:absolute;inset:0;pointer-events:none;transform:translateY(var(--off,0px));}
.rmap .ovl svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
.rdot{position:absolute;width:25px;height:25px;border-radius:50%;background:#123c3a;
  border:2px solid #fbe4da;color:#fff;font-size:11.5px;font-weight:800;
  display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);
  cursor:pointer;pointer-events:auto;}

--off används när kartan krymper till en remsa vid rullning: sätt
--off till -(full höjd - remshöjd)/2 så att punkterna hålls centrerade.
*/
