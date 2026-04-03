const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

let cache = { data: null, tid: 0 };
const CACHE_TTL = 30 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'JPDiskHQ/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON-feil')); }
      });
    }).on('error', reject);
  });
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&rarr;/g, '→').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

const STED_FYLKE = {
  'Kopervik': 'Rogaland', 'Liarlund': 'Rogaland', 'Karmøy': 'Rogaland',
  'Sandnes': 'Rogaland', 'Stavanger': 'Rogaland', 'Ålgård': 'Rogaland',
  'Jørpeland': 'Rogaland', 'Haugesund': 'Rogaland', 'Sola': 'Rogaland',
  'Preikestolen': 'Rogaland', 'Egersund': 'Rogaland', 'Bryne': 'Rogaland',
  'Klepp': 'Rogaland', 'Sauda': 'Rogaland', 'Randaberg': 'Rogaland',
  'Bergen': 'Vestland', 'Flaktveit': 'Vestland', 'Frekhaug': 'Vestland',
  'Badevika': 'Vestland', 'Voss': 'Vestland', 'Stord': 'Vestland',
  'Lindås': 'Vestland', 'Kaupanger': 'Vestland', 'Sogndal': 'Vestland',
  'Volda': 'Vestland', 'Florø': 'Vestland', 'Årdal': 'Vestland',
  'Nyhagen': 'Vestland', 'Kismul': 'Vestland', 'Lynghau': 'Vestland',
  'Oslo': 'Oslo', 'Ekeberg': 'Oslo', 'Stovner': 'Oslo', 'Røa': 'Oslo',
  'Holmenkollen': 'Oslo', 'Krokhol': 'Oslo', 'Klemetsrud': 'Oslo',
  'Frogner': 'Oslo', 'Muselunden': 'Oslo', 'Forsheimer': 'Oslo',
  'Trondheim': 'Trøndelag', 'Dragvoll': 'Trøndelag', 'Stjørdal': 'Trøndelag',
  'Steinkjer': 'Trøndelag', 'Levanger': 'Trøndelag', 'Årsøya': 'Trøndelag',
  'Tillerskogen': 'Trøndelag', 'Othilienborg': 'Trøndelag', 'Trolla': 'Trøndelag',
  'Rotvoll': 'Trøndelag', 'Lømyra': 'Trøndelag', 'Oppdal': 'Trøndelag',
  'Kristiansand': 'Agder', 'Sukkevann': 'Agder', 'Bølgane': 'Agder',
  'Mandal': 'Agder', 'Arendal': 'Agder', 'Grimstad': 'Agder',
  'Lillesand': 'Agder', 'Holta': 'Agder', 'Tinntjønn': 'Agder',
  'Hamar': 'Innlandet', 'Ankerskogen': 'Innlandet', 'Lillehammer': 'Innlandet',
  'Gjøvik': 'Innlandet', 'Elverum': 'Innlandet', 'Løvbergsmoen': 'Innlandet',
  'Kongsvinger': 'Innlandet', 'Skogen': 'Innlandet', 'Glåmos': 'Innlandet',
  'Tønsberg': 'Vestfold', 'Hestehagen': 'Vestfold', 'Sandefjord': 'Vestfold',
  'Larvik': 'Vestfold', 'Porsgrunn': 'Vestfold', 'Skien': 'Vestfold',
  'Kodal': 'Vestfold', 'Stavern': 'Vestfold', 'Horten': 'Vestfold',
  'Ålesund': 'Møre og Romsdal', 'Molde': 'Møre og Romsdal',
  'Kristiansund': 'Møre og Romsdal', 'Vestnes': 'Møre og Romsdal',
  'Valldal': 'Møre og Romsdal', 'Jemtegård': 'Møre og Romsdal',
  'Drammen': 'Viken', 'Fredrikstad': 'Viken', 'Sarpsborg': 'Viken',
  'Drøbak': 'Viken', 'Moss': 'Viken', 'Halden': 'Viken',
  'Skotselv': 'Viken', 'Mjøndalen': 'Viken', 'Kongsberg': 'Viken',
  'Jessheim': 'Viken', 'Lørenskog': 'Viken', 'Nesodden': 'Viken',
  'Langhus': 'Viken', 'Mysen': 'Viken', 'Rud': 'Viken',
  'Bodø': 'Nordland', 'Narvik': 'Nordland', 'Mo i Rana': 'Nordland',
  'Mosjøen': 'Nordland', 'Bjerkvik': 'Nordland',
  'Tromsø': 'Troms', 'Harstad': 'Troms', 'Finnsnes': 'Troms',
  'Alta': 'Finnmark', 'Hammerfest': 'Finnmark',
};

function finnFylke(tekst) {
  for (const [sted, fylke] of Object.entries(STED_FYLKE)) {
    if (tekst.includes(sted)) return fylke;
  }
  return 'Annet';
}

async function hentAlleKonkurranser() {
  if (cache.data && Date.now() - cache.tid < CACHE_TTL) return cache.data;

  const html = await fetchHtml('https://discgolfmetrix.com/?u=competitions_list&country_code=NO&type=A&default_period=6');
  const konkurranser = [];

  // Parser rader: <tr onclick="window.location='/ID'">..celler..</tr>
  const trRegex = /<tr onclick="window\.location='\/(\d+)'[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const id = trMatch[1];
    const rad = trMatch[2];

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const celler = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rad)) !== null) {
      celler.push(stripHtml(tdMatch[1]));
    }

    // Celle 0: navn, 1: dato, 2: type, 3: bane
    const navn = celler[0] || '';
    const dato = celler[1] || '';
    const bane = celler[3] || '';
    const klasser = celler[5] || '';

    const sokTekst = navn + ' ' + bane;
    const fylke = finnFylke(sokTekst);

    if (navn) {
      konkurranser.push({ id, navn, dato, bane, klasser, fylke });
    }
  }

  console.log(`Parsett ${konkurranser.length} konkurranser`);
  cache = { data: konkurranser, tid: Date.now() };
  return konkurranser;
}

app.get('/api/metrix/:id', async (req, res) => {
  try {
    const data = await fetchJson(`https://discgolfmetrix.com/api.php?content=result&id=${req.params.id}`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/konkurranser', async (req, res) => {
  try {
    const alle = await hentAlleKonkurranser();
    res.json(alle);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/konkurranser/:fylke', async (req, res) => {
  try {
    const fylke = decodeURIComponent(req.params.fylke);
    const alle = await hentAlleKonkurranser();
    const filtrert = alle.filter(k => k.fylke === fylke);
    res.json({ fylke, konkurranser: filtrert });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/debug', async (req, res) => {
  try {
    const alle = await hentAlleKonkurranser();
    const rogaland = alle.filter(k => k.fylke === 'Rogaland');
    res.json({ versjon: '4.0', totalt: alle.length, rogaland: rogaland.length, forste_rogaland: rogaland.slice(0,3), alle_forste5: alle.slice(0,5) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log('JP Disk HQ v4.0 kjorer pa port ' + PORT));
