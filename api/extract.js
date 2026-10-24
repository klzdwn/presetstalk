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
    // 1. Ambil data utama & komentar dari TikWM dengan parameter komplit
    const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&comment=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const resData = response.data;

    if (resData.code !== 0 || !resData.data) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gagal mengambil data video TikTok.' 
      });
    }

    const videoData = resData.data;
    let textCorpus = [];

    // Kumpulkan Caption
    if (videoData.title) textCorpus.push(videoData.title);

    // Kumpulkan Komentar (Termasuk Pinned Comment)
    if (videoData.comments && Array.isArray(videoData.comments)) {
      videoData.comments.forEach(c => {
        if (c.text) textCorpus.push(c.text);
      });
    }

    // Gabungkan seluruh teks yang ditemukan
    const fullText = textCorpus.join(' ');

    // 2. Extractor Regex untuk mendeteksi semua bentuk URL (Termasuk shortener)
    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let matches = fullText.match(urlRegex) || [];

    // Bersihkan tanda baca di akhir URL
    matches = matches.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    // Filter link berdasarkan karakteristiknya
    for (const url of matches) {
      const lower = url.toLowerCase();
      
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

    // Fallback jika ada link yang ditemukan tapi belum terkategori
    if (!preset5mb && matches.length > 0) preset5mb = matches[0];
    if (!presetXml && matches.length > 1) presetXml = matches[1];

    return res.status(200).json({
      success: true,
      title: videoData.title,
      author: videoData.author.nickname || videoData.author.unique_id,
      avatar: videoData.author.avatar,
      preset5mb: preset5mb,
      presetXml: presetXml,
      rawUrls: matches
    });

  } catch (error) {
    console.error('Extractor Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan sistem saat mengekstrak link.' 
    });
  }
};
