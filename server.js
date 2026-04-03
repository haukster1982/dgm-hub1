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

// Hent resultater for en konkurranse
app.get('/api/metrix/:id', async (req, res) => {
  try {
    const data = await fetchJson(`https://discgolfmetrix.com/api.php?content=result&id=${req.params.id}`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Hent konkurranser per fylke fra Metrix
app.get('/api/konkurranser/:fylke', async (req, res) => {
  try {
    const fylke = decodeURIComponent(req.params.fylke);
    const url = `https://discgolfmetrix.com/?u=competitions_list&country_code=NO&type=A&default_period=6`;
    const html = await fetchHtml(url);

    // Parse konkurranser fra HTML
    const konkurranser = [];
    
    // Match competition rows - Metrix viser NORWAY, Fylke, By i resultatene
    const rowRegex = /href="[^"]*\/(\d+)[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?NORWAY,\s*([^,|<]+),\s*([^|<,]+)/gi;
    let match;
    
    while ((match = rowRegex.exec(html)) !== null) {
      const id = match[1];
      const navn = match[2].trim();
      const matchFylke = match[3].trim();
      const by = match[4].trim();
      
      // Filtrer på fylke
      if (matchFylke.toLowerCase().includes(fylke.toLowerCase()) ||
          fylke.toLowerCase().includes(matchFylke.toLowerCase())) {
        konkurranser.push({ id, navn, fylke: matchFylke, by });
      }
    }

    // Fallback: søk på dato-lenker
    if (konkurranser.length === 0) {
      const linkRegex = /discgolfmetrix\.com\/(\d+)[^"]*"[^>]*>\s*([^<]+)/g;
      const datoRegex = /(\d{2}\/\d{2}\/\d{2,4})/;
      
      const blocks = html.split('NORWAY,');
      blocks.slice(1).forEach(block => {
        const fylkeMatch = block.match(/^([^,<]+),([^|<]+)/);
        if (!fylkeMatch) return;
        const bFylke = fylkeMatch[1].trim();
        const bBy = fylkeMatch[2].trim();
        
        if (bFylke.toLowerCase().includes(fylke.toLowerCase()) ||
            fylke.toLowerCase().includes(bFylke.toLowerCase())) {
          const idMatch = block.match(/\/(\d{5,8})/);
          const navnMatch = block.match(/>([^<]{5,60})</);
          if (idMatch && navnMatch) {
            konkurranser.push({
              id: idMatch[1],
              navn: navnMatch[1].trim(),
              fylke: bFylke,
              by: bBy
            });
          }
        }
      });
    }

    console.log(`Fant ${konkurranser.length} konkurranser i ${fylke}`);
    res.json({ fylke, konkurranser: konkurranser.slice(0, 50) });
  } catch (e) {
    console.error('Feil:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Debug - se rådata
app.get('/api/debug', async (req, res) => {
  try {
    const html = await fetchHtml('https://discgolfmetrix.com/?u=competitions_list&country_code=NO&type=A&default_period=6');
    // Vis første 2000 tegn av HTML
    res.json({ 
      lengde: html.length,
      utdrag: html.slice(0, 2000)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`JP Disk HQ kjorer pa port ${PORT}`));
