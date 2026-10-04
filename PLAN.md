# Japan-appen — plan för godkännande

Interaktiv reseapp byggd på reseguiden *Arkitektur och konst i Japan*, 12–27 okt 2026.

---

## 1. Teknikval — läs detta först

**Rekommendation: PWA (webbapp på hemskärmen), inte native iOS-app.**

| | PWA | Native (Swift/Xcode) |
|---|---|---|
| Installeras på iPhone/iPad | Safari → Dela → **Lägg till på hemskärmen** | Xcode + kabel, eller TestFlight |
| Kostnad | 0 kr | **1 099 kr/år** (Apple Developer Program) |
| Slutar fungera? | Nej | **Ja — efter 7 dagar** utan betalt konto |
| Fungerar offline | Ja (service worker) | Ja |
| Egen ikon, helskärm | Ja | Ja |
| iPhone + iPad | Samma app | Samma app |
| Byggtid | Kort | Betydligt längre |
| Kräver Xcode | Nej | Ja (**ej installerat på din dator**) |

Den avgörande punkten: med gratis Apple-ID måste en native app **signeras om var sjunde dag med datorn ansluten**. Mitt i Japan är det inte praktiskt. En PWA har ingen sådan begränsning.

Vill du ändå ha native senare går det att paketera samma kodbas med Capacitor — planen nedan gäller då fortfarande.

---

## 2. Skärmar

### Flik 1 — **Nu**
Svarar på frågan *"var borde vi vara just nu?"*

- Live-klocka i **japansk tid** (JST) + svensk tid parallellt
- **Pågår nu**: aktuell aktivitet, starttid, plats
- **Härnäst**: nästa punkt med nedräkning
- Dagens framsteg (t.ex. "3 av 6 klara")
- Före avresa: nedräkning till resan
- Varningskort för dagar med särskilda instruktioner (t.ex. bagaget dag 6)

### Flik 2 — **Resplan**
- Vågrät rad med **dagschips** (Dag 1–16 + datum), dagens dag markerad
- Filter: *Alla* / *Kvar att göra*
- Aktivitetslista med tid, titel, bock för avklarat
- Dagens hotell med adress och telefon
- Knapp: **+ Lägg till egen punkt**

### Flik 3 — **Mina platser**
Egna tillägg utanför programmet.
- Kategorier: Restaurang · Museum · Shopping · Övrigt
- Koppla till en dag, eller lämna som "idé"
- Anteckning, adress, länk

### Detaljvy (slide-up-panel)
Öppnas från valfri aktivitet:
- Tid, plats, beskrivning
- **Anteckningsfält** (sparas direkt)
- Växla **avklarad**
- Länkar: karta, officiell sida

---

## 3. Funktionskrav → lösning

| Önskemål | Lösning |
|---|---|
| Egna anteckningar på aktiviteter | Fritextfält per aktivitet, sparas lokalt |
| Lägga till egna punkter | Formulär: namn, kategori, dag, tid, anteckning |
| Filtrera dag | Dagschips + filter "kvar att göra" |
| Markera avklarat | Bock på varje rad, räknas i dagens framsteg |
| Schema efter datum/tid | "Nu"-fliken jämför japansk tid mot schemat |

---

## 4. Viktigt om tiderna

Reseplanen anger **"Förmiddag", "Eftermiddag", "Kväll"** — inga klockslag. Appen behöver klockslag för att kunna säga "var vi borde vara".

Jag har därför lagt in **uppskattade tider** enligt nyckeln nedan. De är mina antaganden, inte uppgifter från Världens Resor:

| Reseplanens ord | Antagen tid |
|---|---|
| Morgon | 07:30–08:30 |
| Förmiddag | 09:00 |
| Mitt på dagen | 11:30 |
| Lunch | 12:30 |
| Eftermiddag | 14:00 |
| Sen eftermiddag | 16:30 |
| Skymning | 17:30 |
| Kväll | 19:00 |

Flygtiderna är de enda exakta — de kommer från era biljetter.

**Alla tider går att redigera i appen.** När ni fått dagsprogrammet av Jörgen på plats justerar ni direkt i mobilen.

---

## 5. Lagring och säkerhet

- Allt sparas **lokalt på enheten** (IndexedDB). Inget konto, ingen server, inget delat.
- **Export/import**: knapp som sparar allt till en fil — backup och sätt att flytta mellan iPhone och iPad.
- Data försvinner om appen raderas från hemskärmen → därför exportknappen.

*Noterbart:* en PWA på hemskärmen omfattas inte av Safaris 7-dagarsgallring av webbdata. Men exportera ändå innan avresa.

---

## 6. Offline

Viktigt i Japan om ni inte har mobildata överallt.

| Innehåll | Offline? |
|---|---|
| Hela programmet, texter, era anteckningar | Ja |
| Bilder | Ja, cachas vid installation |
| Kartor (Leaflet/OpenStreetMap) | **Nej, inte utan vidare** |

Kartrutorna hämtas från internet. Tre alternativ:

1. **Statiska kartbilder** per dag — cachas som vanliga bilder, fungerar offline (rekommenderas)
2. Förcacha kartrutor för just era områden — tar plats, mer jobb
3. Djuplänka till Apple Kartor/Google Maps — kräver nät, men du har offline-kartor i de apparna ändå

Jag föreslår **1 + 3**: en statisk översiktsbild i appen, plus knapp som öppnar riktiga kartappen.

---

## 7. Etapper

| Etapp | Innehåll | Status |
|---|---|---|
| 0 | Plan + mock-up för godkännande | **← du är här** |
| 1 | Dataextrahering: 16 dagar, alla aktiviteter, hotell, flyg ur guiden | |
| 2 | Appen: tre flikar, anteckningar, bockar, egna punkter | |
| 3 | "Nu"-logiken med japansk tid | |
| 4 | Offline + ikon + installation på din iPhone | |
| 5 | Export/import av backup | |

---

## 8. Begränsningar att känna till

- **Inga push-notiser** med rimlig insats i PWA. Behöver ni påminnelser: lägg dem i Kalender/Påminnelser istället.
- **Ingen Apple Watch**.
- **Delning mellan er två** kräver server — inte med i planen. Export/import-filen fungerar som manuell delning.
- Tiderna är uppskattade (se punkt 4).

---

## 9. Att godkänna

Öppna `mockup.html` och titta på layouten. Säg till om:

1. **PWA istället för native** — okej?
2. **Tre flikar** (Nu · Resplan · Mina platser) — rätt uppdelning?
3. **Uppskattade klockslag** — acceptabelt att jag gissar, med redigering i appen?
4. **Statiska kartbilder offline** — okej, eller vill du ha riktiga kartor och klarar dig med nät?
5. Saknas något? (packlista, utläggsräknare, fraser på japanska, valutaomvandlare …)

Mock-upen går att öppna direkt i mobilen för att känna på storlekarna — lägg filen i iCloud Drive och öppna i Safari.
