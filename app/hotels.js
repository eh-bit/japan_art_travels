/* Särskilda hotell. Nyckeln måste vara EXAKT samma text som `hotel` i data.js.
   Hotell som finns här får bild, beskrivning och länkar (och en ★ i listan).
   Övriga hotell går också att trycka på och visar adress, telefon och kartlänk.
   img  = filnamn utan .jpg i mappen img/   (valfritt — du kan även lägga till eget foto i appen)
   d    = beskrivning/tips          lat/lng = koordinater (ger kartvyn)
   L    = länkar [[text, url], ...] */
window.HOTEL_INFO = {
  'Shishi-iwa House, Karuizawa': {
    // img: 'shishi-iwa',   // lägg bilden som img/shishi-iwa.jpg och ta bort // på raden
    d: 'Designhotell i skogen i Karuizawa, ritat av Pritzker-pristagarna Shigeru Ban och Ryue Nishizawa. ' +
       'Trä, stora glaspartier och rum som öppnar sig mot skogen, med samtida konst på väggarna (bl.a. Hiroshi Sugimoto). ' +
       'Hotellet består av tre hus; Bans två är i trä och glas, Nishizawas består av tio sammanlänkade träpaviljonger i teahus-anda.\n\n' +
       'På hotellet: bibliotek, bar, restaurang, bastu/badhus och cigarrum.\n\n' +
       'Incheckning 15:00–20:00. Ca 1 h 10 min med shinkansen från Tokyo till Karuizawa station, sedan ca 10–15 min med taxi (norra utgången). ' +
       'Hotellet ligger utanför centrum, ca 40 min promenad, så boka taxi i förväg. ' +
       'Karuizawa tar ut boendeskatt på 250 JPY per person och natt, betalas på plats.',
    L: [
      ['Mer om Shishi-Iwa House (Japan Travel)', 'https://www.japan.travel/en/luxury/detail/shishi-iwa-house/'],
      ['Hotellets sida på Mr & Mrs Smith', 'https://www.hyatt.com/mr-and-mrs-smith/en-US/m1563-shishi-iwa-house']
    ]
  }
};