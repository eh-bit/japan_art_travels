// Plockar ut resedatan ur mock-upen och skriver den som JSON, så att appen och
// byggskriptet utgår från exakt samma källa.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../mockup.html', 'utf8');

function pluck(name) {
  const from = html.indexOf('[', html.indexOf('const ' + name + '=['));
  let depth = 0;
  for (let i = from; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']' && --depth === 0) return eval(html.slice(from, i + 1));
  }
  throw new Error('hittade inte ' + name);
}

const DAYS = pluck('DAYS');
const CITIES = pluck('CITIES');

const SLUG = {
  'NinomaruPalace.jpg': 'nijo',
  "Sanzen'in_01.JPG": 'sanzenin',
  'Ginkakuji_Kyoto03-r.jpg': 'ginkakuji',
  'Kyoto_Municipal_Museum_of_Art_1933_%E2%85%B1.jpg': 'kyocera',
  'Sagawa_art_museum01s3200.jpg': 'sagawa',
  'Flickr_-_yeowatzup_-_Mount_Hachiman%2C_Omihachiman%2C_Shiga%2C_Japan.jpg': 'omihachiman',
  'Miho_museum02n3872.jpg': 'miho',
  'Osaka_Dotonbori_Ebisu_Bridge.jpg': 'dotonbori',
  'The_National_Museum_of_Art,_Osaka_2026.jpg': 'nmao',
  'Forest_of_metasequoia_glyptostroboides_at_Nagai_Botanical_Garden,_February_2024_-_8010.jpg': 'teamlab',
  'Yamamura_house07n4272.jpg': 'yodoko',
  'Mt_rokko01s2816.jpg': 'rokko',
  'Shimose_art_museum_1.jpg': 'simose',
  'Itsukushima_Shrine_Torii_Gate_(13890465459).jpg': 'itsukushima',
  'Hiroshima_MAZDA_Otemachi_BLD_20160717-1.JPG': 'orizuru',
  'Enoura_Observatory_03.jpg': 'enoura',
  'Lake_Motosu03.jpg': 'motosu',
  'Nakamura_Keith_Haring_Collection.gif': 'haring',
  'Takasugi-an.JPG': 'fujimori',
  'Matsumoto_Castle_Keep_Tower.jpg': 'matsumotoslott',
  '220728_Matsumoto_City_Museum_of_Art_Japan03s3.jpg': 'matsumotomuseum',
  'Karuizawa_-_Karuizawa6413.jpg': 'shishiiwa',
  'Karuizawa_shishiiwa-dinner03s3200.jpg': 'shishiiwa-dinner',
  'Karuizawa_shiraito-no-taki03s3200.jpg': 'shiraito',
  '221001_Hiroshi_Senju_Museum_Karuizawa_Nagano_pref_Japan07s3.jpg': 'senju',
  '240308_Karuizawa_New_Art_Museum_Karuizawa_Japan01s3.jpg': 'knam',
  'Shiroiya_Hotel.jpg': 'shiroiya',
  'shiroiya-dinner.jpg': 'shiroiya-dinner',
  'Maebashi_Cityscape_Montage.jpg': 'maebashi',
  'Shibuya_Crossing,_Aerial.jpg': 'shibuya',
  'Omotesando_Tokyo_spring_2012.JPG': 'omotesando',
  'Tokyo_Toilet_Project_01.jpg': 'toalett',
  'National_museum_of_western_art05s3200.jpg': 'ueno',
  'Roppongi_Hills_2013-12-01.jpg': 'roppongi',
  'Sensoji_2023.jpg': 'asakusa'
};

const unknown = [];
DAYS.forEach(d => d.acts.forEach(a => {
  if (!a.img) return;
  const s = SLUG[a.img];
  if (!s) { unknown.push(a.img); return; }
  a.src = a.img;      // originalfilen hos Wikimedia, används av nedladdningen
  a.img = s;          // appen laddar img/<slug>.jpg lokalt
}));

CITIES.forEach(c => {
  c.src = c.img;
  c.img = 'stad-' + c.n;
});

fs.writeFileSync(__dirname + '/itinerary.json', JSON.stringify(DAYS, null, 1));
fs.writeFileSync(__dirname + '/cities.json', JSON.stringify(CITIES, null, 1));
console.log('dagar:', DAYS.length);
console.log('städer:', CITIES.length);
console.log('aktiviteter:', DAYS.reduce((n, d) => n + d.acts.length, 0));
console.log('bilder:', new Set(DAYS.flatMap(d => d.acts.filter(a => a.img).map(a => a.img))).size);
console.log('platser med koordinat:', DAYS.reduce((n, d) => n + d.acts.filter(a => a.lat != null).length, 0));
if (unknown.length) console.log('OKÄND BILD:', unknown);
