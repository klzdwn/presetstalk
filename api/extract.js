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
    let textCorpus = [];
    let author = 'Creator TikTok';
    let avatar = '';
    let title = '';

    const res1 = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&comment=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });

    if (res1.data && res1.data.code === 0 && res1.data.data) {
      const v = res1.data.data;
      title = v.title || '';
      author = v.author?.nickname || v.author?.unique_id || author;
      avatar = v.author?.avatar || avatar;

      if (title) textCorpus.push(title);

      if (v.comments && Array.isArray(v.comments)) {
        v.comments.forEach(c => {
          if (c.text) textCorpus.push(c.text);
        });
      }
    }

    const fullText = textCorpus.join(' ');

    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let matches = fullText.match(urlRegex) || [];
    matches = matches.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    for (const url of matches) {
      const lower = url.toLowerCase();

      // PENTING: Abaikan link domain TikTok atau CDN video agar tidak terambil!
      if (
        lower.includes('tiktok.com') || 
        lower.includes('tikcdn') || 
        lower.includes('byteoversea') || 
        lower.includes('musical.ly')
      ) {
        continue; 
      }

      // Deteksi Preset 5MB / Alight Link
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('am.link')) {
        if (!preset5mb) preset5mb = url;
      } 
      // Deteksi XML / Drive / Storage / Shortener
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

    // Fallback jika ada link lain yang bukan video TikTok
    const validMatches = matches.filter(u => {
      const l = u.toLowerCase();
      return !l.includes('tiktok.com') && !l.includes('tikcdn');
    });

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
      message: 'Gagal mengekstrak link.' 
    });
  }
};
