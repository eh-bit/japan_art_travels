# Väder

## API:er

Alla tre är gratis, utan konto, och svarar direkt till webbläsaren (CORS `*`).

**Dygnsprognos**, sexton dagar framåt:
```
https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lng>
  &daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max
  &timezone=Asia%2FTokyo&forecast_days=16
```

**Timprognos**, för att dela upp ett enda dygn i perioder (se nedan):
```
https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lng>
  &hourly=temperature_2m,weather_code,precipitation_probability
  &timezone=Asia%2FTokyo&start_date=<YYYY-MM-DD>&end_date=<YYYY-MM-DD>
```

**Historiskt arkiv**, för normalvärden (körs i byggskriptet, inte i appen):
```
https://archive-api.open-meteo.com/v1/archive?latitude=<lat>&longitude=<lng>
  &start_date=2019-10-01&end_date=2025-10-31
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FTokyo
```

## Två lager: prognos och normalvärde

Prognosen räcker bara sexton dagar framåt och kräver nät. Normalvärden — ett
flerårsmedel för samma datum — bakas in i `data.js` vid bygget och fungerar därför
alltid, även offline och långt innan resan.

Visa alltid prognosen när den finns, annars normalvärdet. Märk tydligt vilket det
är (till exempel olika bakgrundsfärg) — användaren ska inte tro att ett normalvärde
är dagens faktiska väder.

```js
const prognos = (Date.now() - WX.at < 24 * 3600 * 1000) && WX.d[ort]?.[datum];
const normal = cityData.norm[datum.slice(5)];   // nyckel 'MM-DD'
```

Spara prognosen i `localStorage` med en tidsstämpel. Är den äldre än ett dygn, lita
inte på den — hämta om eller falla tillbaka på normalvärdet.

**Fälla: dygnsprognosens sista dag kan sakna värden.** Open-Meteo svarar ibland med
`null` för `temperature_2m_max`/`_min` på det sista begärda dygnet. Ett oskyddat
`Math.round(null)` blir `0`, vilket ser ut som en riktig (och mycket felaktig)
temperatur. Hoppa över dygn med `null`-värden istället för att runda dem:

```js
if (mx == null || mn == null) return;   // hoppa över, låt normalvärdet gälla
```

## Normalvärden i byggskriptet

Räkna fram ett medel per ort och datum ur arkivet, och spara bara bort för de
datum resan faktiskt besöker orten — annars blir `data.js` onödigt stor.

```python
per.setdefault(md, []).append((max_temp, min_temp, nederbord))
norm[md] = [round(medel_max, 1), round(medel_min, 1), round(andel_dagar_med_regn * 100)]
```

Cacha historik-anropen i en separat JSON-fil vid sidan av bygget (en nyckel per
koordinat) — arkivet ändras inte mellan körningar, och ett onödigt API-anrop per
ombyggnad är bara bortkastad tid.

## Delade dagar

En resdag kan tillbringas i två orter — till exempel en förmiddag i en stad och en
övernattning i nästa. Visa väder för båda, med den tidsperiod gruppen faktiskt är
där, i stället för ett enda missvisande dygnsvärde.

**1. Hitta brytpunkten ur programmets egna tider.** Jämför varje programpunkts
koordinat mot avståndet till ort A respektive ort B — närmast avgör. Transporten
mellan sista punkten i A och första punkten i B är brytpunkten.

```js
const avst = (akt, ort) => Math.hypot(akt.lat - ort.lat, (akt.lng - ort.lng) * .8);
const hor_till = akt => avst(akt, a) <= avst(akt, b) ? 'a' : 'b';
```

**Fälla: ett enda tröskelvärde (`< 1.2 grader`) för "nära en ort" dög inte** när
orterna själva ligger nära varandra (till exempel Matsumoto och Karuizawa, cirka
0,7 grader isär). Punkter i båda städerna hamnade då inom tröskeln för båda, och
brytpunkten blev fel. Jämför avstånden mot varandra istället för mot ett
absolut tal.

**2. Hämta timprognos för respektive period** och sammanfatta (max, min, vanligaste
väderkod, max nederbördssannolikhet) för varje sida av brytpunkten.

**3. Utan timprognos** (datumet ligger bortom sexton dagar) — visa en normalrad per
ort istället för att försöka dela upp ett normalvärde i perioder; de finns bara
som dygnsmedel.

## Stadskort och väderikoner

Varje stads platskort visar en vädersträng, en ruta per dag staden besöks, med
samma prognos/normalvärde-logik som ovan. WMO-väderkoder (`weather_code`) mappas
till emoji och text med en liten tabell — koderna är desamma för dygns- och
timprognos:

```js
const WXKOD = { 0: ['☀️', 'Klart'], 1: ['🌤', 'Mest klart'], 2: ['⛅', 'Växlande moln'],
  3: ['☁️', 'Mulet'], 61: ['🌧', 'Regn'], 95: ['⛈', 'Åska'], /* … */ };
```

## Packningsförslag ur väderdatan

En packlista kan föreslå punkter automatiskt ur samma normalvärden som räknats
fram för resan: varma lager om någon natt-temperatur understiger ett tröskelvärde,
regnjacka om många dagar har hög nederbördssannolikhet. Komplettera med punkter ur
programmets egna varningstexter (till exempel "bagaget skickas separat" dagar).

Håll förslagen korta — en etikett och en kort förklaring ("6° i Karuizawa"), inte
hela varningstexten rakt av. Låt användaren ta bort eller lägga till fritt; förslag
är bara en startpunkt.
