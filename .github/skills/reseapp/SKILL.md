---
name: reseapp
description: 'Bygg en offline-först reseapp (PWA) för iPhone/iPad från ett befintligt reseprogram eller en reseguide. Skapar dagsschema, kartor som fungerar utan nät, egna anteckningar, egna platser med foton och en ruttöversikt. Use when the user wants a travel app, trip app, reseguide som app, reseplanerare, itinerary app, or asks to turn a travel itinerary/guide into an installable offline app for a phone. Täcker även service worker-cachning, offline-kartrutor från OpenStreetMap, Wikimedia-bilder och iOS-specifika fällor.'
argument-hint: 'Resans namn och var reseprogrammet/guiden finns'
---

# Reseapp

Bygger en installerbar, offline-först reseapp av ett reseprogram. Resultatet är en
PWA som läggs till på hemskärmen och fungerar helt utan nät under resan — vilket är
hela poängen, eftersom mobildata utomlands är dyrt och opålitligt.

## När skillen används

- "Gör en app av min reseplan / reseguide"
- "Jag vill ha resschemat i mobilen offline"
- Reseprogram finns som PDF, HTML, mejl eller en färdig tryckguide

## Varför PWA och inte en riktig iOS-app

En native-app kräver Xcode, ett utvecklarkonto på 99 USD/år och omsignering var sjunde
dag för sidoladdning. En PWA installeras via Dela → Lägg till på hemskärmen, är gratis
och uppdateras genom att byta ut filer. För en reseapp som ska leva i tre veckor är det
rätt avvägning.

**Enda hårda kravet:** service workers kräver HTTPS eller localhost. `file://` och
`http://192.168.x.x` fungerar inte. Appen måste alltså ligga på en webbadress —
Netlify Drop eller GitHub Pages räcker och är gratis.

## Arbetsgång

### 1. Läs in reseprogrammet och validera

Utgå från det officiella programmet, inte från minnet. Kontrollera att tider,
transporter och övernattningar stämmer, och leta särskilt efter uppdateringar som
kommit i efterhand (ändrade besök, inställda stopp).

Fråga vad användaren vill ha med. Vanliga svar: kontaktuppgifter till färdledare,
packningsinformation, hur och när man tar sig mellan ställen.

### 2. Mock-up först, bygg sedan

Gör en enkel mock-up i en fristående HTML-fil och låt användaren godkänna layouten
innan appen byggs. Det är billigare att flytta saker i en mock-up än i en färdig app.

Mock-upen blir sedan **källan till resedatan** — byggskriptet läser `DAYS` direkt ur
den, så det bara finns en sanning. Se [datamodellen](./references/datamodell.md).

### 3. Bygg offline-resurserna

Allt appen behöver under resan laddas hem i förväg: bilder, kartrutor, ikoner.

```
mockup.html  →  extract.js  →  itinerary.json  →  build_assets.py  →  app/
```

Använd [build_assets.py](./assets/build_assets.py) som utgångspunkt. Den hämtar
bilder, räknar ut vilka kartrutor som behövs, genererar appikoner och skriver
`data.js` samt `assets.json` (listan som service workern förhandscachar).

### 4. Bygg appen

Ren HTML, CSS och JavaScript. Inget ramverk, inget byggsteg — det gör appen liten,
snabb och möjlig att felsöka direkt i Safari om något krånglar på resan.

Grundstomme: tre flikar i botten — **Nu** (var ni borde vara just nu), **Resplan**
(dag för dag) och **Mina** (egna platser och viktig info).

Kopiera [sw.js](./assets/sw.js) och [kartrutor.js](./assets/kartrutor.js) rakt av.

### 5. Testa

Offline-läget är hela poängen, så det måste verifieras på riktigt: **stäng av
webbservern** och kontrollera att appen fortfarande fungerar. Se
[testning](./references/testning.md) — den innehåller flera fällor som annars
kostar mycket tid.

### 6. Publicera

Netlify Drop (dra mappen till netlify.com/drop) eller GitHub Pages. Därefter öppnas
adressen i Safari på telefonen → Dela → Lägg till på hemskärmen.

Kontrollera att inga privata telefonnummer ligger kvar i koden innan uppladdning.
Sök igenom **hela** projektet, inte bara kontaktkortet — nummer gömmer sig i
beskrivningstexter.

## Funktioner som visat sig värdefulla

| Funktion | Varför |
|---|---|
| Nu-vy med nuvarande och nästa punkt | Den fråga man faktiskt har under resan |
| Egna anteckningar per punkt | Bokningsnummer, minnen |
| Egna platser med platssökning | Restauranger man hittar på vägen |
| Egna foton på platser | Minnesanteckning som bild |
| Redigerbara tider | Programtider är ofta ungefärliga |
| Ruttöversikt med städerna | Ger känsla för helheten |
| Export av data som JSON | Allt ligger lokalt och kan försvinna |
| Tidssimulator | Gör Nu-vyn testbar före avresa |

Notiser går **inte** att få i en PWA på iOS. Hänvisa till Påminnelser.

## Fällor som kostar tid

Dessa är alla konstaterade i praktiken, inte teoretiska:

1. **Service workern serverar gammal kod.** Höj `VERSION` i `sw.js` vid *varje*
   ändring, annars syns inget. Fetch-hanteraren matchar med `ignoreSearch: true`,
   så `?v=123` i adressen hjälper inte — den gamla filen returneras ändå.

2. **Pythons inbyggda webbserver blockerar.** `python3 -m http.server` tar en
   anslutning i taget och hänger sig när service workern hämtar hundratals filer.
   Använd en trådad server, se [testning](./references/testning.md).

3. **Wikimedias `Special:FilePath` fungerar i `<img>` men inte i `fetch()`.** CORS
   krävs på varje steg i omdirigeringen. Curl följer omdirigeringar och visar bara
   sista svaret — ett test med curl ljuger alltså här.

4. **Google Places bild-URL:er slutar fungera.** De är signerade och går ut. Använd
   Wikimedia Commons istället.

5. **iOS säkerhetsmarginaler.** Fastklistrade element fastnar *under* marginalen
   upptill, vilket gör att `scroll-margin-top` måste räkna med den. Se
   [ios.md](./references/ios.md).

6. **Pointer-händelser räcker inte för svepgester.** Safari avbryter dem så fort den
   tolkar gesten som rullning. Använd touch-händelser med `preventDefault`.

7. **`scrollIntoView` rullar alla föräldrar**, inte bara den behållare man tänkt sig.

## Referenser

- [Datamodell och byggkedja](./references/datamodell.md)
- [Offline: service worker, kartor, bilder, lagring](./references/offline.md)
- [iOS- och PWA-specifikt](./references/ios.md)
- [Testning och verifiering](./references/testning.md)
