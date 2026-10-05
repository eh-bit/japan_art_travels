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

Används av ruttöversikten och stadskorten.

```js
{
  n: 1, name: 'Kyoto', lat: 35.0116, lng: 135.7681,
  d1: 1, d2: 3,                      // första och sista dagen i staden
  dl: 'Dag 1–3 · 12–14 okt',
  img: 'stad-1', url: 'https://…', lk: 'Kyoto City Tourism',
  txt: 'Kort stadsbeskrivning.',
  norm: { '10-12': [23.7, 15.8, 29], '10-13': [23.8, 14.8, 29] }   // se vader.md
}
```

`norm` fylls i av byggskriptet — ett `[dagstemp, nattemp, andel år med regn]` per
datum (nyckel `MM-DD`) staden faktiskt besöks. Se [väder](./vader.md).

## Taggar

Elva räcker. Varje tagg har etikett, textfärg och bakgrund:

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
  oplanerad: { l: 'Oplanerad',  c: '#4a5b6b', b: '#e8edf2' },
  ovrigt:    { l: 'Övrigt',     c: '#5a5a52', b: '#eeedea' }
};
```

`oplanerad` sätts aldrig för hand — den härleds (se nedan) för punkter som är
knutna till en ort men inte till ett datum, och ska uteslutas ur den vanliga
tagg-redigeraren eftersom den inte är en riktig användarval.

## När hör en punkt hemma? Dag+tid eller bara en ort

Egna punkter (och omflyttade programpunkter) behöver kunna existera i två lägen:

- **Schemalagd** — har `day` (dagnummer) och `t` (tid), ligger i Resplan på det
  datumet.
- **Oplanerad** — har bara `city` (ortnummer), ingen tid. Dyker upp på ortens
  platskort och i ett eget filter, för idéer man vill ha kvar "när det blir tid
  över" utan att tvinga fram ett klockslag.

```js
{ id: 'p123', name: 'Kissa Tengu', cat: 'mat',
  day: 0, city: 3, t: '12:00', note: '…' }   // day:0 betyder oplanerad
```

Visa detta som **två knappar** ("Dag och tid" / "Bara en plats"), inte som en enda
blandad lista med både dagar och orter — annars blir det oklart vad som händer
med tiden när användaren väljer en ort. Byt till en helt annan uppsättning fält
beroende på vilken knapp som är vald; tidsfältet ska inte ens visas i platsläget,
eftersom det ändå inte har något värde.

Datumfältet (inte bara tid) ska finnas på **alla** punkter, inklusive programmets
egna — annars går det inte att flytta en aktivitet till en annan dag, bara ändra
klockslaget inom samma dag.


## Index över alla punkter

Programmets punkter och användarens egna platser ska bete sig likadant i gränssnittet.
Bygg därför ett gemensamt index med en nyckel per punkt:

```js
const IDX = {};
function buildIndex() {
  for (const k in IDX) delete IDX[k];
  DAYS.forEach(d => d.acts.forEach((a, i) =>
    IDX['d' + d.n + '-' + i] = Object.assign({}, a, { dayN: d.n, date: d.date })));
  S.places.forEach(p => IDX[p.id] = {
    t: p.t, n: p.name, m: p.addr || '', d: p.note || '',
    g: ['egen', p.cat], dayN: p.day, cityN: p.city, i: '📍', own: 1,
    lat: p.lat, lng: p.lng, photo: p.photo, credit: p.credit
  });
  // Användarens ändringar läggs ovanpå — flyttat datum, lossat från schemat
  Object.keys(IDX).forEach(k => {
    const a = IDX[k];
    if (S.times[k]) a.t = S.times[k];
    if (S.tags[k]) a.g = S.tags[k].slice();
    if (S.days[k] !== undefined) a.dayN = S.days[k];
    if (S.citys[k] !== undefined) a.cityN = S.citys[k];
    // Härledd tagg: schemalagd kontra bara knuten till en ort
    if (!a.dayN && a.cityN && !a.g.includes('oplanerad')) a.g = a.g.concat('oplanerad');
  });
}
```

Poängen med det sista steget: programdatan skrivs aldrig över. Ändrar användaren en
tid eller datum sparas det separat (`S.times`, `S.days`, `S.citys`) och läggs på vid
varje ombyggnad av indexet, så ett nytt `data.js` kan rullas ut utan att
användarens ändringar går förlorade — även en programpunkt som flyttats till ett
annat datum eller lossats till en ort.

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
