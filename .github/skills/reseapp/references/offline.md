# Offline

## Service worker

Allt appen behöver förhandscachas vid installationen. Listan genereras av
byggskriptet som `assets.json`.

Tre saker som är lätta att göra fel:

**Höj `VERSION` vid varje ändring.** Annars serveras den gamla filen. Detta kommer
att hända flera gånger under utvecklingen och ser ut som att ändringen inte togs.

**Cacha en fil i taget med `try`/`catch`.** `cache.addAll()` avbryter hela
installationen om en enda fil ger 404, utan att tala om vilken.

**`ignoreSearch: true` i `caches.match`** gör att `?v=123` inte går förbi cachen.
Det är rätt beteende i drift men gör felsökning förvirrande — rensa cachen istället.

Egna kartrutor för användarens platser läggs i en **separat** cache som inte rensas
vid uppdatering. Annars försvinner kartan för platser användaren lagt till.

Se [sw.js](../assets/sw.js).

## Kartor som fungerar offline

Leaflet och inbäddade kartor hämtar sina rutor dynamiskt och går inte att
förhandscacha. Lösningen är att rita kartan som ett rutnät av `<img>` med
OpenStreetMaps rutor — vanliga bildfiler som service workern kan spara.

Priset är att kartan inte går att zooma eller panorera. För en reseapp är det snarare
en fördel: kartan visar alltid rätt sak.

Projektionen (Web Mercator, 256 px per ruta):

```js
function worldPx(lat, lng, z) {
  const n = 2 ** z * 256, lr = lat * Math.PI / 180;
  return { x: (lng + 180) / 360 * n,
           y: (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n };
}
```

**Samma beräkning måste finnas i byggskriptet**, annars begär appen rutor som inte
laddats hem. Håll konstanterna (zoom, utsnittets storlek) identiska på båda ställena.

Två användningar:

| | Zoom | Storlek | Antal rutor |
|---|---|---|---|
| En plats i detaljvyn | 15 | 440×260 px | 4–6 per plats |
| Ett stadskort | 12 | 560×210 px | 3–8 per stad |
| Hela resrutten | 7 | utsnitt runt alla orter | ~12 totalt |

**Håll zoomnivå, bredd och höjd som namngivna konstanter delade mellan byggskript
och app** (till exempel `CYZ, CYW, CYH = 12, 560, 210`), inte som bokstavliga tal
på båda ställena. En konstant som glöms bort på det ena stället ger tysta 404:or
som bara syns offline — bygget laddade aldrig hem rutorna för den zoomnivån.

Ett program med 36 platser landar på knappt 200 rutor, cirka 5 MB. Var snäll mot
OpenStreetMaps servrar: sätt en egen `User-Agent` och pausa drygt en tiondels sekund
mellan hämtningarna.

Se [kartrutor.js](../assets/kartrutor.js).

## Bilder

**Wikimedia Commons** är bästa källan: stabila adresser, fria licenser.

```
https://commons.wikimedia.org/wiki/Special:FilePath/<filnamn>?width=1000
```

Den adressen fungerar i `<img>`, men **inte** i `fetch()` — omdirigeringen saknar
CORS-huvud och webbläsaren kräver det i varje steg. Ska bilden hämtas som data,
gå via API:et istället:

```
https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*
  &prop=imageinfo&iiprop=url&iiurlwidth=900&titles=File:<filnamn>
```

Låt API:et räkna fram storleken. Begär man en större bredd än originalet direkt i
url:en svarar servern 400.

**Undvik Google Places-bilder.** Adresserna är signerade och slutar fungera efter en
tid — alla bilder blir trasiga mitt under resan.

Skala ner till 900 px och spara som JPEG kvalitet 80. Det ger omkring 60 kB per bild.

## Platssökning

**Nominatim** (OpenStreetMap) är gratis och tillåter anrop från webbläsaren:

```
https://nominatim.openstreetmap.org/search?format=jsonv2&q=<sökning>
```

Skicka `Accept-Language: en` för latinska namn istället för lokala tecken.

**Google Maps långa adresser** kan läsas av lokalt utan nätanrop:

```js
const ll = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
const nm = u.match(/\/place\/([^/@?]+)/);
```

**Korta länkar (`maps.app.goo.gl`) går inte att följa** från webbläsaren — Google
skickar inga CORS-huvuden. Be användaren öppna länken och kopiera den långa adressen.

## Lagring

| Vad | Var | Varför |
|---|---|---|
| Anteckningar, bockar, egna platser, tider | `localStorage` | Litet, enkelt, synkront |
| Foton | `IndexedDB` som blobbar | `localStorage` rymmer bara ~5 MB totalt |

Skala ner foton innan de sparas — ett mobilfoto på 4 MB blir cirka 75 kB vid 900 px
och kvalitet 0,72.

```js
function shrink(src, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(src);
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
```

Foton följer inte med i en JSON-export. Säg det till användaren istället för att låta
dem upptäcka det vid byte av enhet.

## Bilder från platsen

Wikimedia kan leta foton tagna nära en koordinat:

```
https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*
  &generator=geosearch&ggsnamespace=6&ggslimit=10&ggsradius=400
  &ggscoord=<lat>|<lng>&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=300
```

Spara fotografens namn och licensen tillsammans med bilden och visa dem — det är ett
villkor i licenserna.
