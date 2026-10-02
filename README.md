# Japan 2026 — appen

PWA som installeras på hemskärmen. Allt innehåll ligger lokalt och fungerar utan nät.

```
app/
  index.html  app.js  sw.js  data.js  manifest.webmanifest
  assets.json           lista som service workern förcachar
  img/     33 bilder
  tiles/  169 kartrutor
  icons/   3 ikoner
build/
  extract.js        mock-up → itinerary.json
  build_assets.py   laddar ner bilder/kartrutor, gör ikoner, skriver data.js
```

**Offline: 210 filer, 8,9 MB.** Verifierat med webbservern helt avstängd — hela appen, alla bilder och alla kartrutor renderade.

---

## Testa på datorn

```bash
cd ~/Documents/Hemma/Japan/app
python3 -m http.server 8123
```

Öppna <http://localhost:8123/index.html>.

Service workern kräver HTTPS **eller** localhost. Öppnar du `index.html` som en fil direkt fungerar appen, men utan offline-läge.

---

## Få den på iPhone/iPad

Här finns ett hinder: din telefon kan inte nå datorns `localhost`, och en adress som `http://192.168.1.x` räknas inte som säker — då startar inte service workern och offline-läget uteblir. **Appen behöver därför ligga på en HTTPS-adress.**

### Alternativ 1 — Netlify Drop (snabbast, inget konto)

1. Gå till <https://app.netlify.com/drop>
2. Dra in hela mappen `app`
3. Du får en adress som `https://nagot-slumpmassigt.netlify.app`
4. Öppna den i Safari på telefonen → **Dela** → **Lägg till på hemskärmen**
5. Öppna appen från hemskärmen en gång med nät, så laddas alla 8,9 MB ner

### Alternativ 2 — GitHub Pages

Lägg `app`-mappen i ett repo, aktivera Pages under Settings → Pages. Kräver konto men ger en adress du styr över.

### Integritet: inga privata nummer ligger i koden

Färdledarnas telefonnummer är **borttagna ur appens filer**. Under **Mina → Viktig info → Färdledare** står namn och roll, med en knapp där du skriver in numren från avreseinformationen. De sparas bara i `localStorage` på din enhet och följer med i säkerhetskopian — de lämnar aldrig telefonen och hamnar aldrig på den publicerade adressen.

Kvar i koden finns bara publika uppgifter: Världens Resors växel och hotellens receptionsnummer.

Det gör att du kan publicera appen på Netlify eller GitHub Pages utan att sprida privata nummer.

---

## Bra att veta

**Tiderna är gissade.** Reseplanen säger bara "förmiddag/eftermiddag". Nyckeln står i `PLAN.md`. Alla tider går att ändra i appen — öppna en punkt, ändra, spara.

**Säkerhetskopia.** Anteckningar, bockar och egna platser ligger i `localStorage` på just den enheten. Under **Mina → Viktig info → Säkerhetskopia** exporterar du en JSON-fil. Gör det före avresa, och använd den för att flytta mellan iPhone och iPad. Raderas appen från hemskärmen försvinner datan.

**Inga notiser.** PWA:er på iOS kan inte väcka dig inför en programpunkt. Lägg sådant i Påminnelser.

**Testa en annan tidpunkt.** Under **Mina → Viktig info → Appen** finns ett fält där du kan sätta valfri tidpunkt och se hur Nu-sidan ser ut den dagen. Nollställs när appen stängs.

---

## Uppdatera innehållet

Ändringar i resplanen görs i `mockup.html` (källan), sedan:

```bash
cd ~/Documents/Hemma/Japan/build
node extract.js && python3 build_assets.py
```

Höj `VERSION` i `app/sw.js` så att telefonerna hämtar det nya. Redan nedladdade bilder och kartrutor hoppas över.

Kartrutorna kommer från OpenStreetMap och hämtades en gång, med fördröjning mellan anropen. Attributionen visas i kartvyn.
# japan_art_travels
