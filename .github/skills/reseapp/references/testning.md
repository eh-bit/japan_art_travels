# Testning

## Lokal server

Pythons inbyggda webbserver **duger inte**. `python3 -m http.server` hanterar en
anslutning i taget och hänger sig när service workern hämtar hundratals filer —
installationen stannar efter ett tjugotal och ser ut som ett kodfel.

```python
# serve.py
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ThreadingHTTPServer(('127.0.0.1', 8123), SimpleHTTPRequestHandler).serve_forever()
```

```bash
cd app && nohup python3 serve.py > /dev/null 2>&1 &
```

## Nollställ före varje kontroll

Annars verifieras gammal kod. Detta är den vanligaste tidstjuven under utveckling:

```js
const rs = await navigator.serviceWorker.getRegistrations();
await Promise.all(rs.map(r => r.unregister()));
const ks = await caches.keys();
await Promise.all(ks.map(k => caches.delete(k)));
```

Gå sedan till `about:blank` och ladda sidan på nytt. Att bara lägga på `?v=` i
adressen räcker inte — fetch-hanteraren matchar med `ignoreSearch: true`.

Rensa **inte** cachen medan service workern är igång och kontrollerande; då börjar
bilder och kartrutor misslyckas tills sidan laddats om.

## Offline på riktigt

`navigator.onLine` är inte tillförlitlig. Stäng av servern istället:

```bash
pkill -f serve.py
```

Ladda sedan om och kontrollera att alla dagar finns kvar, att kartrutor och bilder
visas och att egna foton syns.

## Kontrollera att allt cachats

```js
const n = (await (await caches.open('VERSION')).keys()).length;
const forvantat = (await (await fetch('assets.json')).json()).length;
```

Siffrorna ska stämma. Gör de inte det har installationen hängt eller hoppat över
filer — titta i service workerns konsol efter överhoppade adresser.

## Simulerad telefon

Sätt fönstret till 393×852 och tvinga fram säkerhetsmarginalerna, annars syns inte
iOS-buggarna:

```js
const s = document.createElement('style');
s.textContent = ':root{--top:59px;--bot:34px;}';
document.head.appendChild(s);
```

Kontrollera särskilt att inget hamnar bakom fastklistrade element eller flikraden.

## Svepgester i test

Automatiserade musrörelser ger **falska negativa resultat** — de utlöser inte samma
händelser som ett finger. Skicka riktiga touch-händelser i sidan:

```js
const b = y => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
const skicka = (typ, y) => el.dispatchEvent(new TouchEvent(typ, {
  touches: typ === 'touchend' ? [] : [b(y)],
  changedTouches: [b(y)], bubbles: true, cancelable: true }));
```

Kom ihåg att röra flera steg — tröskeln läses från senaste `touchmove`, inte från
`touchend`.

## Testa Nu-vyn före avresa

Lägg in en tidssimulator som skriver till `sessionStorage`:

```js
function now() {
  const sim = sessionStorage.getItem('simtime');
  return sim ? new Date(sim) : new Date();
}
```

Då går hela resan att spela upp i förväg, inklusive dagval och "pågår nu".

## Städa efter dig

Testdata hamnar i användarens riktiga lagring. Rensa både `localStorage` och
`IndexedDB` när verifieringen är klar.

## Kontrollista före uppladdning

- [ ] Appen fungerar med servern avstängd
- [ ] Antal cachade filer stämmer med `assets.json`
- [ ] Inga trasiga bilder eller kartrutor
- [ ] Inga privata telefonnummer någonstans i projektet (sök igenom allt)
- [ ] Alla externa länkar svarar
- [ ] `VERSION` i `sw.js` är höjd
- [ ] Testdata borttagen
