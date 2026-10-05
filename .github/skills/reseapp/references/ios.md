# iOS och PWA

## Installation

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Resans namn">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
```

Safari → Dela → Lägg till på hemskärmen. Kräver HTTPS eller localhost.

Ikoner: 180 (iOS), 192 och 512 (manifest). Går att generera med PIL i byggskriptet.

## Säkerhetsmarginaler

```css
:root{
  --top: env(safe-area-inset-top, 0px);
  --bot: env(safe-area-inset-bottom, 0px);
}
```

På en iPhone är `--top` omkring 59 px (kameraområdet) och `--bot` 34 px
(hemindikatorn). Tre konsekvenser som alla gav buggar:

**Flikraden får ett tomt band under ikonerna** om man lägger på hela `--bot` som
utfyllnad. Låt knapparna använda en del av ytan:

```css
.tabs{ height: calc(60px + max(4px, var(--bot) - 16px));
       padding-bottom: max(4px, calc(var(--bot) - 16px)); }
```

**Fastklistrade element fastnar under marginalen upptill.** Ett element med
`position:sticky; top:0` i en behållare med `padding-top: calc(var(--top) + 8px)`
fastnar alltså 67 px ner — men `scrollIntoView` siktar på skärmens överkant. Målet
hamnar då dolt bakom det klistrade elementet. Räkna med marginalen:

```css
.kort{ scroll-margin-top: calc(var(--top) + var(--strip, 140px) + 24px); }
```

Felet syns inte på en datorskärm, där marginalen är noll.

**Innehåll syns i springan ovanför ett fastklistrat element.** Täck den med ett
pseudoelement — men bara när elementet faktiskt fastnat, annars lägger det sig över
rubriken ovanför. Sätt en klass från rullningslyssnaren:

```css
.remsa.fast:before{ content:""; position:absolute; left:0; right:0; bottom:100%;
  height: calc(var(--top) + 12px); background: var(--paper); }
```

## Svepgester

**Pointer-händelser fungerar inte** för att dra ner ett kort som också går att rulla.
Safari avbryter dem så snart den tolkar gesten som rullning, och gesten dör tyst.

Använd touch-händelser och blockera webbläsarens tolkning så fort riktningen är klar:

```js
sh.addEventListener('touchstart', e => {
  y0 = null;
  if (e.touches.length !== 1 || sh.scrollTop > 0 ||
      e.target.closest('button,a,input,select,textarea')) return;
  y0 = e.touches[0].clientY; dy = 0; aktiv = false;
}, { passive: true });

sh.addEventListener('touchmove', e => {
  if (y0 === null) return;
  const d = e.touches[0].clientY - y0;
  if (!aktiv) { if (d < 8) return; aktiv = true; sh.style.transition = 'none'; }
  dy = Math.max(0, d);
  e.preventDefault();            // annars tar Safari över gesten
  sh.style.transform = `translateY(${dy}px)`;
}, { passive: false });
```

Villkoret `sh.scrollTop > 0` gör att gesten bara startar från kortets topp, så vanlig
rullning inuti kortet fungerar som förut. `{ passive: false }` krävs för att
`preventDefault` ska ha någon verkan.

Stäng bara om inget ändrats. Jämför ett tillstånd taget när kortet öppnades:

```js
const snapshot = () => JSON.stringify([fältA.value, fältB.value, taggar.slice().sort()]);
```

## Rullning

`overscroll-behavior: contain` på kort som går att rulla hindrar att hela sidan
studsar med.

`overflow-anchor: none` på innehållsytan. Webbläsaren försöker annars behålla
läspositionen när innehåll byts ut, vilket kan kasta användaren till fel ställe vid
vybyte.

**`scrollIntoView` rullar alla föräldrar.** Ska bara ett vågrätt fält rullas, sätt
`scrollLeft` direkt:

```js
c.scrollLeft = el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2;
```

Nollställ rullningen *efter* att nytt innehåll ritats, och en gång till i nästa
bildruta.

## Det som inte går

- **Notiser.** PWA:er på iOS kan inte väcka användaren. Hänvisa till Påminnelser.
- **Bakgrundsarbete.** Inget körs när appen är stängd.
- **Data överlever inte avinstallation.** Erbjud export till JSON.

## Formulärfält

`input[type=time]` och `select` får olika höjd av sig själva. Lås båda:

```css
input[type=time], select{ height:46px; padding:0 12px; }
```

Håll `font-size` på minst 16 px i fält, annars zoomar Safari in vid fokus.
