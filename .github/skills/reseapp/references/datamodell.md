# Datamodell och byggkedja

## En enda källa

Resedatan ligger i mock-upen som en vanlig JavaScript-array. Byggskriptet läser den
därifrån, så det aldrig uppstår två versioner av programmet.

```
mockup.html          källan — DAYS och CITIES
   ↓ extract.js      plockar ut arrayerna, mappar bildnamn till korta slugs
itinerary.json
cities.json
   ↓ build_assets.py hämtar bilder och kartrutor, skriver data.js + assets.json
app/
```

## DAYS

En post per dag. Fälten är korta för att hålla `data.js` liten.

```js
{
  n: 1,                        // dagnummer
  date: '2026-10-12',          // ISO, används för att hitta "idag"
  wd: 'måndag',
  dl: '12 okt',                // kort etikett
  city: 'Avresa',
  title: 'Flyg till Japan',
  hotel: 'Ombord',
  addr: 'SK983 mot Tokyo',
  warn: 'Stora bagaget skickas separat.',   // valfri varning överst på dagen
  acts: [ /* punkter */ ]
}
```

En punkt i `acts`:

```js
{
  t: '09:00',                  // tid, sorteringsnyckel
  n: 'Incheckning Arlanda',    // namn
  m: 'Bagaget checkas till Osaka',   // kort undertext
  g: ['transport', 'bokad'],   // taggar, styr färg och filter
  i: '✈️',                      // emoji när bild saknas
  img: 'kyocera',              // slug → app/img/kyocera.jpg
  lat: 35.0133, lng: 135.7828, // ger kartbild i detaljvyn
  d: 'Längre beskrivning…',
  L: [['Officiell sida', 'https://…']]   // länkar
}
```

## CITIES

Används av ruttöversikten.

```js
{
  n: 1, name: 'Kyoto', lat: 35.0116, lng: 135.7681,
  d1: 1, d2: 3,                      // första och sista dagen i staden
  dl: 'Dag 1–3 · 12–14 okt',
  img: 'stad-1', url: 'https://…', lk: 'Kyoto City Tourism',
  txt: 'Kort stadsbeskrivning.'
}
```

## Taggar

Tio räcker. Varje tagg har etikett, textfärg och bakgrund:

```js
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
```

## Index över alla punkter

Programmets punkter och användarens egna platser ska bete sig likadant i gränssnittet.
Bygg därför ett gemensamt index med en nyckel per punkt:

```js
const IDX = {};
function buildIndex() {
  for (const k in IDX) delete IDX[k];
  DAYS.forEach(d => d.acts.forEach((a, i) =>
    IDX['d' + d.n + '-' + i] = Object.assign({}, a, { dayN: d.n })));
  S.places.forEach(p => IDX[p.id] = {
    t: p.t, n: p.name, m: p.addr || '', d: p.note || '',
    g: ['egen', p.cat], dayN: p.day, i: '📍', own: 1,
    lat: p.lat, lng: p.lng, photo: p.photo, credit: p.credit
  });
  // Användarens ändringar läggs ovanpå
  Object.keys(IDX).forEach(k => {
    if (S.times[k]) IDX[k].t = S.times[k];
    if (S.tags[k]) IDX[k].g = S.tags[k].slice();
  });
}
```

Poängen med det sista steget: programdatan skrivs aldrig över. Ändrar användaren en
tid sparas den separat och läggs på vid varje ombyggnad av indexet, så ett nytt
`data.js` kan rullas ut utan att användarens ändringar går förlorade.

## Extrahering ur mock-upen

```js
function pluck(name) {
  const from = html.indexOf('[', html.indexOf('const ' + name + '=['));
  let depth = 0;
  for (let i = from; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']' && --depth === 0) return eval(html.slice(from, i + 1));
  }
  throw new Error('hittade inte ' + name);
}
```

Klammermatchning istället för reguljärt uttryck, eftersom arrayerna innehåller
nästlade strukturer och apostrofer i texten.
