const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS Header
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
    let title = '';
    let author = 'Creator TikTok';
    let avatar = '';
    let allText = '';

    // Engine 1: Ambil data dari Tikwm dengan parameter komplit
    try {
      const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&comment=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 6000
      });

      if (response.data && response.data.code === 0 && response.data.data) {
        const v = response.data.data;
        title = v.title || '';
        author = v.author?.nickname || v.author?.unique_id || author;
        avatar = v.author?.avatar || avatar;
        
        allText += ' ' + title;

        if (v.comments && Array.isArray(v.comments)) {
          v.comments.forEach(c => {
            if (c.text) allText += ' ' + c.text;
          });
        }
      }
    } catch (e) {
      console.log('Engine 1 Fail, Switching to Engine 2...');
    }

    // Engine 2: Scraping Langsung via Web Resolver (Fallback jika komentar tidak terbaca di Engine 1)
    if (!allText.includes('alight.link') && !allText.includes('drive.google') && !allText.includes('mediafire')) {
      try {
        const directRes = await axios.get(tiktokUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 6000
        });

        if (directRes.data && typeof directRes.data === 'string') {
          allText += ' ' + directRes.data;
        }
      } catch (e) {
        console.log('Engine 2 Fail');
      }
    }

    // --- LOGIKA PENJARINGAN URL AUTOMATIS ---
    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let foundUrls = allText.match(urlRegex) || [];

    // Clean-up karakter di ujung URL
    foundUrls = foundUrls.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    for (const url of foundUrls) {
      const lower = url.toLowerCase();

      // Abaikan link internal/video/CDN TikTok agar tidak mengunduh video
      if (
        lower.includes('tiktok.com') || 
        lower.includes('tikcdn') || 
        lower.includes('byteoversea') || 
        lower.includes('musical.ly') ||
        lower.includes('ttwstatic')
      ) {
        continue;
      }

      // Deteksi Preset 5MB / Alight Link
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('am.link')) {
        if (!preset5mb) preset5mb = url;
      } 
      // Deteksi XML / Drive / MediaFire / Penyingkat Link (s.id, bit.ly, dll)
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

    // Filter link valid yang bukan dari domain TikTok
    const validMatches = foundUrls.filter(u => {
      const l = u.toLowerCase();
      return !l.includes('tiktok.com') && !l.includes('tikcdn') && !l.includes('byteoversea');
    });

    // Fallback menetapkan link jika belum terklasifikasi
    if (!preset5mb && validMatches.length > 0) preset5mb = validMatches[0];
    if (!presetXml && validMatches.length > 1) presetXml = validMatches[1];

    return res.status(200).json({
      success: true,
      title: title || 'Preset Alight Motion',
      author: author,
      avatar: avatar,
      preset5mb: preset5mb,
      presetXml: presetXml,
      rawUrls: validMatches
    });

  } catch (error) {
    console.error('Extractor Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal mengekstrak link preset otomatis.' 
    });
  }
};
