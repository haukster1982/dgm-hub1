const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

app.get('/api/metrix/:id', async (req, res) => {
  try {
    const data = await fetchJson(`https://discgolfmetrix.com/api.php?content=result&id=${req.params.id}`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Hent og vis rådata fra Metrix competitions
app.get('/api/debug', async (req, res) => {
  try {
    const html = await fetchHtml('https://discgolfmetrix.com/?u=competitions_list&country_code=NO&type=A&default_period=6');
    // Finn første 500 tegn rundt hver "Rogaland" og competition-relatert innhold
    const utdrag = [];
    let pos = 0;
    // Søk etter competition-lenker
    const patterns = ['competition', 'Rogaland', 'Kopervik', 'Sandnes', 'href="/', 'td class'];
    patterns.forEach(p => {
      const idx = html.indexOf(p);
      if (idx > 0) {
        utdrag.push({ pattern: p, pos: idx, tekst: html.slice(Math.max(0, idx-100), idx+400) });
      }
    });
    res.json({ lengde: html.length, utdrag });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`JP Disk HQ kjorer pa port ${PORT}`));
