const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { tiktokUrl } = req.body || {};

  if (!tiktokUrl) {
    return res.status(400).json({ success: false, message: 'Link TikTok wajib diisi!' });
  }

  try {
    let rawHtml = '';
    let videoTitle = '';
    let authorName = 'Creator TikTok';
    let authorAvatar = '';

    // 1. Dapatkan URL Asli jika input berupa shortlink (vt.tiktok.com)
    let targetUrl = tiktokUrl;
    try {
      const redirectRes = await axios.get(tiktokUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        maxRedirects: 5,
        timeout: 6000
      });
      targetUrl = redirectRes.request.res.responseUrl || tiktokUrl;
      rawHtml += typeof redirectRes.data === 'string' ? redirectRes.data : '';
    } catch (e) {
      console.log('Redirect resolution bypass...');
    }

    // 2. Fetch HTML Langsung dari Web TikTok (Mode Scraping Direct)
    try {
      const htmlRes = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache'
        },
        timeout: 7000
      });
      if (typeof htmlRes.data === 'string') {
        rawHtml += ' ' + htmlRes.data;
      }
    } catch (e) {
      console.log('Direct Web HTML Scrape Error');
    }

    // 3. Fallback: Request ke API internal TikWM untuk metadata
    try {
      const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&comment=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      });

      if (tikwmRes.data && tikwmRes.data.code === 0 && tikwmRes.data.data) {
        const d = tikwmRes.data.data;
        videoTitle = d.title || '';
        authorName = d.author?.nickname || d.author?.unique_id || authorName;
        authorAvatar = d.author?.avatar || authorAvatar;

        rawHtml += ' ' + videoTitle;
        if (d.comments && Array.isArray(d.comments)) {
          d.comments.forEach(c => {
            if (c.text) rawHtml += ' ' + c.text;
          });
        }
      }
    } catch (e) {
      console.log('TikWM API Fallback Error');
    }

    // 4. LOGIKA EXTRACOR REGEX (Menaring semua URL & mengabaikan file video CDN)
    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let foundUrls = rawHtml.match(urlRegex) || [];

    // Clean-up tanda baca di ujung URL
    foundUrls = foundUrls.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    for (const url of foundUrls) {
      const lower = url.toLowerCase();

      // STRICT FILTER: Abaikan link internal/video/CDN TikTok
      if (
        lower.includes('tiktok.com') || 
        lower.includes('tikcdn') || 
        lower.includes('byteoversea') || 
        lower.includes('musical.ly') ||
        lower.includes('ttwstatic') ||
        lower.includes('fbcdn') ||
        lower.includes('schema.org') ||
        lower.includes('w3.org')
      ) {
        continue;
      }

      // Deteksi Preset 5MB / Alight Motion
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('am.link')) {
        if (!preset5mb) preset5mb = url;
      } 
      // Deteksi XML / Drive / Storage / Shortener (s.id, bit.ly, mediafire, dll)
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

    // Filter link valid yang bukan dari domain TikTok/internal
    const validMatches = foundUrls.filter(u => {
      const l = u.toLowerCase();
      return !l.includes('tiktok.com') && 
             !l.includes('tikcdn') && 
             !l.includes('byteoversea') &&
             !l.includes('schema.org') &&
             !l.includes('w3.org');
    });

    // Fallback jika ada link eksternal yang belum terkategori
    if (!preset5mb && validMatches.length > 0) preset5mb = validMatches[0];
    if (!presetXml && validMatches.length > 1) presetXml = validMatches[1];

    return res.status(200).json({
      success: true,
      title: videoTitle || 'Preset Alight Motion',
      author: authorName,
      avatar: authorAvatar,
      preset5mb: preset5mb,
      presetXml: presetXml,
      rawUrls: validMatches
    });

  } catch (error) {
    console.error('Mode Scraping Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal mengekstrak link preset.' 
    });
  }
};
