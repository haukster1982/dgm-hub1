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
  return (s||'').replace(/<[^>]+>/g,'').replace(/&rarr;/g,'→').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
}

const STED_FYLKE = {
  // ROGALAND - komplett liste
  'Kopervik': 'Rogaland', 'Liarlund': 'Rogaland', 'Karmøy': 'Rogaland',
  'Blikshavn': 'Rogaland', 'Skudeneshavn': 'Rogaland', 'Åkra': 'Rogaland',
  'Sandnes': 'Rogaland', 'Vagle': 'Rogaland', 'Ganddal': 'Rogaland',
  'Stavanger': 'Rogaland', 'Madla': 'Rogaland', 'Tasta': 'Rogaland',
  'Ålgård': 'Rogaland', 'Figgjo': 'Rogaland', 'Bryne': 'Rogaland',
  'Klepp': 'Rogaland', 'Orstad': 'Rogaland', 'Varhaug': 'Rogaland',
  'Jørpeland': 'Rogaland', 'Preikestolen': 'Rogaland', 'Forsand': 'Rogaland',
  'Lysebotn': 'Rogaland', 'Hjelmeland': 'Rogaland', 'Sauda': 'Rogaland',
  'Haugesund': 'Rogaland', 'Haugaland': 'Rogaland', 'Djupadalen': 'Rogaland',
  'Tysvær': 'Rogaland', 'Bokn': 'Rogaland', 'Vindafjord': 'Rogaland',
  'Sola': 'Rogaland', 'Tananger': 'Rogaland', 'Randaberg': 'Rogaland',
  'Vistvik': 'Rogaland', 'Ræge': 'Rogaland', 'Ølberg': 'Rogaland',
  'Hå': 'Rogaland', 'Nærbø': 'Rogaland', 'Vigrestad': 'Rogaland',
  'Egersund': 'Rogaland', 'Hellvik': 'Rogaland', 'Lunhulen': 'Rogaland',
  'Sokndal': 'Rogaland', 'Hauge': 'Rogaland', 'Lund': 'Rogaland',
  'Øksnevad': 'Rogaland', 'Undheim': 'Rogaland', 'Vikedal': 'Rogaland',
  'Skjoldastraumen': 'Rogaland', 'Sæbøvik': 'Rogaland', 'Vassøy': 'Rogaland',
  'Talgje': 'Rogaland', 'Hyllestad': 'Rogaland', 'Hyllehaugen': 'Rogaland',
  'Skadberg': 'Rogaland', 'Obrestad': 'Rogaland', 'Horve': 'Rogaland',
  'Ombo': 'Rogaland', 'Finnøy': 'Rogaland', 'Rennesøy': 'Rogaland',
  'Mosterøy': 'Rogaland', 'Judaberg': 'Rogaland', 'Åmøy': 'Rogaland',
  'Sjernarøy': 'Rogaland', 'Jelsa': 'Rogaland', 'Erfjord': 'Rogaland',
  'Vannbassengan': 'Rogaland', 'Vågen': 'Rogaland', 'Skeiane': 'Rogaland',
  // VESTLAND
  'Bergen': 'Vestland', 'Flaktveit': 'Vestland', 'Frekhaug': 'Vestland',
  'Badevika': 'Vestland', 'Voss': 'Vestland', 'Stord': 'Vestland',
  'Lindås': 'Vestland', 'Kaupanger': 'Vestland', 'Sogndal': 'Vestland',
  'Volda': 'Vestland', 'Florø': 'Vestland', 'Årdal': 'Vestland',
  'Nyhagen': 'Vestland', 'Lynghau': 'Vestland', 'Askøy': 'Vestland',
  'Os': 'Vestland', 'Odda': 'Vestland', 'Norheimsund': 'Vestland',
  'Osterøy': 'Vestland', 'Herdla': 'Vestland', 'Meland': 'Vestland',
  'Bømlo': 'Vestland', 'Fitjar': 'Vestland', 'Sunnhordland': 'Vestland',
  'Kulleseid': 'Vestland', 'Kismul': 'Vestland', 'Kvam': 'Vestland',
  'Skare': 'Vestland', 'Ålesund': 'Møre og Romsdal',
  // OSLO
  'Oslo': 'Oslo', 'Ekeberg': 'Oslo', 'Stovner': 'Oslo', 'Røa': 'Oslo',
  'Holmenkollen': 'Oslo', 'Krokhol': 'Oslo', 'Klemetsrud': 'Oslo',
  'Frogner': 'Oslo', 'Muselunden': 'Oslo', 'Forsheimer': 'Oslo',
  'Yggdrasil': 'Oslo',
  // TRØNDELAG
  'Trondheim': 'Trøndelag', 'Dragvoll': 'Trøndelag', 'Stjørdal': 'Trøndelag',
  'Steinkjer': 'Trøndelag', 'Levanger': 'Trøndelag', 'Årsøya': 'Trøndelag',
  'Tillerskogen': 'Trøndelag', 'Othilienborg': 'Trøndelag', 'Trolla': 'Trøndelag',
  'Rotvoll': 'Trøndelag', 'Lømyra': 'Trøndelag', 'Oppdal': 'Trøndelag',
  'Klæbu': 'Trøndelag', 'Malvik': 'Trøndelag', 'Selbu': 'Trøndelag',
  'Hommelvik': 'Trøndelag', 'Verdal': 'Trøndelag', 'Namsos': 'Trøndelag',
  'Orkanger': 'Trøndelag', 'Melhus': 'Trøndelag', 'Lysøysund': 'Trøndelag',
  'Jervskogen': 'Trøndelag', 'Ørland': 'Trøndelag', 'Brekstad': 'Trøndelag',
  'Ånesøyan': 'Trøndelag', 'Kyrksæterøra': 'Trøndelag',
  // AGDER
  'Kristiansand': 'Agder', 'Sukkevann': 'Agder', 'Bølgane': 'Agder',
  'Mandal': 'Agder', 'Arendal': 'Agder', 'Grimstad': 'Agder',
  'Lillesand': 'Agder', 'Holta': 'Agder', 'Tinntjønn': 'Agder',
  'Søgne': 'Agder', 'Vennesla': 'Agder', 'Valle': 'Agder',
  'Farsund': 'Agder', 'Flekkefjord': 'Agder', 'Lyngdal': 'Agder',
  // INNLANDET
  'Hamar': 'Innlandet', 'Ankerskogen': 'Innlandet', 'Lillehammer': 'Innlandet',
  'Gjøvik': 'Innlandet', 'Elverum': 'Innlandet', 'Løvbergsmoen': 'Innlandet',
  'Kongsvinger': 'Innlandet', 'Skogen': 'Innlandet', 'Glåmos': 'Innlandet',
  'Røros': 'Innlandet', 'Fagernes': 'Innlandet', 'Lom': 'Innlandet',
  'Moelv': 'Innlandet', 'Brumunddal': 'Innlandet', 'Raufoss': 'Innlandet',
  'Karidalen': 'Innlandet', 'Lena': 'Innlandet', 'Sillongen': 'Innlandet',
  'Valdres': 'Innlandet', 'Leira': 'Innlandet', 'Linflåa': 'Innlandet',
  'Tolga': 'Innlandet', 'Tynset': 'Innlandet',
  // VESTFOLD OG TELEMARK
  'Tønsberg': 'Vestfold', 'Hestehagen': 'Vestfold', 'Sandefjord': 'Vestfold',
  'Larvik': 'Vestfold', 'Porsgrunn': 'Vestfold', 'Skien': 'Vestfold',
  'Kodal': 'Vestfold', 'Stavern': 'Vestfold', 'Horten': 'Vestfold',
  'Stokke': 'Vestfold', 'Andebu': 'Vestfold', 'Håsken': 'Vestfold',
  'Kragerø': 'Vestfold', 'Notodden': 'Vestfold', 'Bø i Telemark': 'Vestfold',
  'Nordbøåsen': 'Vestfold',
  // MØRE OG ROMSDAL
  'Molde': 'Møre og Romsdal', 'Kristiansund': 'Møre og Romsdal',
  'Vestnes': 'Møre og Romsdal', 'Valldal': 'Møre og Romsdal',
  'Jemtegård': 'Møre og Romsdal', 'Ørsta': 'Møre og Romsdal',
  'Ulsteinvik': 'Møre og Romsdal', 'Sunndalsøra': 'Møre og Romsdal',
  'Torvikbukt': 'Møre og Romsdal', 'Tingvoll': 'Møre og Romsdal',
  'Sjøholt': 'Møre og Romsdal', 'Langevåg': 'Møre og Romsdal',
  'Voldsfjorden': 'Møre og Romsdal', 'Lømyra': 'Møre og Romsdal',
  // VIKEN
  'Drammen': 'Viken', 'Fredrikstad': 'Viken', 'Sarpsborg': 'Viken',
  'Drøbak': 'Viken', 'Moss': 'Viken', 'Halden': 'Viken',
  'Skotselv': 'Viken', 'Mjøndalen': 'Viken', 'Kongsberg': 'Viken',
  'Jessheim': 'Viken', 'Lørenskog': 'Viken', 'Nesodden': 'Viken',
  'Langhus': 'Viken', 'Mysen': 'Viken', 'Rud': 'Viken',
  'Vikersund': 'Viken', 'Lierbyen': 'Viken', 'Hvam': 'Viken',
  'Nannestad': 'Viken', 'Ås': 'Viken', 'Ski': 'Viken',
  'Siggerud': 'Viken', 'Nesoddtangen': 'Viken', 'Rådhusparken': 'Viken',
  'Høytorp': 'Viken', 'Vollen': 'Viken', 'Arnestad': 'Viken',
  'Eidsfoss': 'Viken', 'Vestfossen': 'Viken', 'Skavanger': 'Viken',
  'Eiker': 'Viken', 'Bikkjestykket': 'Viken',
  // NORDLAND
  'Bodø': 'Nordland', 'Narvik': 'Nordland', 'Mo i Rana': 'Nordland',
  'Mosjøen': 'Nordland', 'Bjerkvik': 'Nordland', 'Beisfjord': 'Nordland',
  'Sandnessjøen': 'Nordland', 'Brønnøysund': 'Nordland',
  'Rensåsen': 'Nordland', 'Enga': 'Nordland', 'Ankenes': 'Nordland',
  // TROMS
  'Tromsø': 'Troms', 'Harstad': 'Troms', 'Finnsnes': 'Troms',
  'Charlottenlund': 'Troms',
  // FINNMARK
  'Alta': 'Finnmark', 'Hammerfest': 'Finnmark', 'Salen': 'Finnmark',
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
    const navn = celler[0] || '';
    const dato = celler[1] || '';
    const bane = celler[3] || '';
    const klasser = celler[5] || '';
    const fylke = finnFylke(navn + ' ' + bane);
    if (navn) konkurranser.push({ id, navn, dato, bane, klasser, fylke });
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
  try { res.json(await hentAlleKonkurranser()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/konkurranser/:fylke', async (req, res) => {
  try {
    const fylke = decodeURIComponent(req.params.fylke);
    const alle = await hentAlleKonkurranser();
    res.json({ fylke, konkurranser: alle.filter(k => k.fylke === fylke) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/debug', async (req, res) => {
  try {
    const alle = await hentAlleKonkurranser();
    const rogaland = alle.filter(k => k.fylke === 'Rogaland');
    res.json({ versjon: '5.0', totalt: alle.length, rogaland: rogaland.length, rogaland_liste: rogaland });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log('JP Disk HQ v5.0 kjorer pa port ' + PORT));
