const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Cache konkurranser i minnet
let cache = { data: null, tid: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 min

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

async function hentAlleKonkurranser() {
  // Bruk cache hvis fersk
  if (cache.data && Date.now() - cache.tid < CACHE_TTL) {
    return cache.data;
  }

  const html = await fetchHtml('https://discgolfmetrix.com/?u=competitions_list&country_code=NO&type=A&default_period=6');
  
  const konkurranser = [];
  
  // Parser <tr onclick="window.location='/ID'"> rader
  const trRegex = /<tr onclick="window\.location='\/(\d+)'[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;
  
  while ((trMatch = trRegex.exec(html)) !== null) {
    const id = trMatch[1];
    const rad = trMatch[2];
    
    // Hent alle <td> celler
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const celler = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rad)) !== null) {
      celler.push(stripHtml(tdMatch[1]));
    }
    
    if (celler.length >= 4) {
      const navn = celler[0];
      const dato = celler[1];
      const type = celler[2];
      const bane = celler[3]; // F.eks "Kopervik Diskgolfbane → Gull Layout"
      const paameldte = celler[4] || '';
      
      // Finn by/fylke fra banenavn – søk i HTML etter kontekst
      // Banen er registrert med by i Metrix
      konkurranser.push({ id, navn, dato, bane, type, paameldte });
    }
  }

  // Nå henter vi by-info ved å søke etter kjente stedsnavn i banenavnet
  const STED_FYLKE = {
    'Kopervik': 'Rogaland', 'Liarlund': 'Rogaland', 'Karmøy': 'Rogaland',
    'Sandnes': 'Rogaland', 'Stavanger': 'Rogaland', 'Ålgård': 'Rogaland',
    'Jørpeland': 'Rogaland', 'Haugesund': 'Rogaland', 'Sola': 'Rogaland',
    'Preikestolen': 'Rogaland', 'Egersund': 'Rogaland', 'Bryne': 'Rogaland',
    'Bergen': 'Vestland', 'Flaktveit': 'Vestland', 'Frekhaug': 'Vestland',
    'Voss': 'Vestland', 'Stord': 'Vestland', 'Lindås': 'Vestland',
    'Kaupanger': 'Vestland', 'Sogndal': 'Vestland', 'Volda': 'Vestland',
    'Oslo': 'Oslo', 'Ekeberg': 'Oslo', 'Stovner': 'Oslo', 'Røa': 'Oslo',
    'Holmenkollen': 'Oslo', 'Krokhol': 'Oslo', 'Klemetsrud': 'Oslo',
    'Trondheim': 'Trøndelag', 'Dragvoll': 'Trøndelag', 'Stjørdal': 'Trøndelag',
    'Steinkjer': 'Trøndelag', 'Levanger': 'Trøndelag', 'Årsøya': 'Trøndelag',
    'Kristiansand': 'Agder', 'Sukkevann': 'Agder', 'Bølgane': 'Agder',
    'Mandal': 'Agder', 'Arendal': 'Agder', 'Grimstad': 'Agder',
    'Lillesand': 'Agder', 'Holta': 'Agder',
    'Hamar': 'Innlandet', 'Ankerskogen': 'Innlandet', 'Lillehammer': 'Innlandet',
    'Gjøvik': 'Innlandet', 'Elverum': 'Innlandet', 'Løvbergsmoen': 'Innlandet',
    'Kongsvinger': 'Innlandet',
    'Tønsberg': 'Vestfold', 'Hestehagen': 'Vestfold', 'Sandefjord': 'Vestfold',
    'Larvik': 'Vestfold', 'Porsgrunn': 'Vestfold', 'Skien': 'Vestfold',
    'Kodal': 'Vestfold', 'Stavern': 'Vestfold',
    'Ålesund': 'Møre og Romsdal', 'Molde': 'Møre og Romsdal',
    'Kristiansund': 'Møre og Romsdal', 'Vestnes': 'Møre og Romsdal',
    'Valldal': 'Møre og Romsdal', 'Jemtegård': 'Møre og Romsdal',
    'Drammen': 'Viken', 'Fredrikstad': 'Viken', 'Sarpsborg': 'Viken',
    'Drøbak': 'Viken', 'Moss': 'Viken', 'Halden': 'Viken',
    'Skotselv': 'Viken', 'Mjøndalen': 'Viken', 'Kongsberg': 'Viken',
    'Jessheim': 'Viken', 'Lørenskog': 'Viken', 'Nesodden': 'Viken',
    'Bodø': 'Nordland', 'Narvik': 'Nordland', 'Mo i Rana': 'Nordland',
    'Tromsø': 'Troms', 'Harstad': 'Troms',
    'Alta': 'Finnmark', 'Hammerfest': 'Finnmark',
  };

  konkurranser.forEach(k => {
    let fylke = 'Ukjent';
    for (const [sted, f] of Object.entries(STED_FYLKE)) {
      if (k.bane.includes(sted) || k.navn.includes(sted)) {
        fylke = f;
        break;
      }
    }
    k.fylke = fylke;
  });

  console.log(`Hentet ${konkurranser.length} konkurranser`);
  cache = { data: konkurranser, tid: Date.now() };
  return konkurranser;
}

// Hent resultater
app.get('/api/metrix/:id', async (req, res) => {
  try {
    const data = await fetchJson(`https://discgolfmetrix.com/api.php?content=result&id=${req.params.id}`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alle konkurranser
app.get('/api/konkurranser', async (req, res) => {
  try {
    const alle = await hentAlleKonkurranser();
    res.json(alle);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Konkurranser per fylke
app.get('/api/konkurranser/:fylke', async (req, res) => {
  try {
    const fylke = decodeURIComponent(req.params.fylke);
    const alle = await hentAlleKonkurranser();
    const filtrert = alle.filter(k => k.fylke === fylke);
    res.json({ fylke, konkurranser: filtrert });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Debug
app.get('/api/debug', async (req, res) => {
  try {
    const alle = await hentAlleKonkurranser();
    res.json({ antall: alle.length, forste5: alle.slice(0, 5) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`JP Disk HQ kjorer pa port ${PORT}`));
