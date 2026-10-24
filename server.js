const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/extract', async (req, res) => {
  const { tiktokUrl } = req.body;

  if (!tiktokUrl) {
    return res.status(400).json({ success: false, message: 'Link TikTok wajib diisi!' });
  }

  let browser = null;

  try {
    // 1. Jalankan Browser Virtual (Puppeteer)
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set User-Agent seluler agar TikTok menampilkan antarmuka mobile
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');

    // 2. Buka Halaman TikTok
    await page.goto(tiktokUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Tunggu komponen konten termuat
    await page.waitForTimeout(2000);

    // 3. Extract Seluruh Teks (Deskripsi + Komentar Tersemat)
    const pageData = await page.evaluate(() => {
      // Ambil judul/caption video
      const title = document.querySelector('h1') ? document.querySelector('h1').innerText : '';
      
      // Ambil username pembuat
      const author = document.querySelector('h3') ? document.querySelector('h3').innerText : 'Creator TikTok';

      // Kumpulkan seluruh teks yang ada di dalam body halaman (termasuk komentar)
      const fullText = document.body.innerText || '';

      return { title, author, fullText };
    });

    // 4. Pattern Regex untuk Menyaring URL
    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let matches = pageData.fullText.match(urlRegex) || [];

    // Clean-up tanda baca di ujung URL
    matches = matches.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    for (const url of matches) {
      const lower = url.toLowerCase();

      // Abaikan domain TikTok/video CDN agar tidak mengunduh video
      if (
        lower.includes('tiktok.com') || 
        lower.includes('tikcdn') || 
        lower.includes('byteoversea') || 
        lower.includes('schema.org') ||
        lower.includes('w3.org')
      ) {
        continue;
      }

      // Deteksi Preset 5MB / Alight Motion
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('am.link')) {
        if (!preset5mb) preset5mb = url;
      } 
      // Deteksi XML / Drive / Shortener (s.id, bit.ly, mediafire, dll)
      else if (
        lower.includes('drive.google') || 
        lower.includes('mediafire') || 
        lower.includes('dropbox') || 
        lower.includes('s.id') || 
        lower.includes('bit.ly') ||
        lower.includes('xml')
      ) {
        if (!presetXml) presetXml = url;
      }
    }

    // Filter link eksternal yang tersisa
    const validMatches = matches.filter(u => {
      const l = u.toLowerCase();
      return !l.includes('tiktok.com') && !l.includes('tikcdn') && !l.includes('byteoversea');
    });

    if (!preset5mb && validMatches.length > 0) preset5mb = validMatches[0];
    if (!presetXml && validMatches.length > 1) presetXml = validMatches[1];

    await browser.close();

    return res.json({
      success: true,
      title: pageData.title || 'Preset Alight Motion',
      author: pageData.author,
      preset5mb: preset5mb,
      presetXml: presetXml
    });

  } catch (error) {
    if (browser) await browser.close();
    console.error('Puppeteer Scraping Error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal melakukan scraping pada video TikTok.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server Scraping Puppeteer berjalan di http://localhost:${PORT}`);
});
