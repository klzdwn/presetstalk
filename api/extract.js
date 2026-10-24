const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS Header
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { tiktokUrl } = req.body || {};

  if (!tiktokUrl) {
    return res.status(400).json({ success: false, message: 'Link TikTok wajib diisi!' });
  }

  try {
    // Request ke API TikWM untuk parsing caption video TikTok
    const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`);
    const data = response.data;

    if (data.code !== 0 || !data.data) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gagal mengambil data video. Pastikan link video TikTok valid dan publik.' 
      });
    }

    const caption = data.data.title || '';
    
    // Regex untuk mendeteksi URL di caption
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const foundUrls = caption.match(urlRegex) || [];

    let preset5mb = null;
    let presetXml = null;

    // Filter link berdasarkan domain & tipe link
    foundUrls.forEach(url => {
      const lower = url.toLowerCase();
      if (lower.includes('alight.link') || lower.includes('alightmotion.com')) {
        preset5mb = url;
      } else if (
        lower.includes('drive.google.com') || 
        lower.includes('mediafire.com') || 
        lower.includes('xml') || 
        lower.includes('dropbox.com')
      ) {
        presetXml = url;
      }
    });

    // Fallback jika tidak teridentifikasi spesifik
    if (!preset5mb && foundUrls.length > 0) preset5mb = foundUrls[0];
    if (!presetXml && foundUrls.length > 1) presetXml = foundUrls[1];

    return res.status(200).json({
      success: true,
      title: caption,
      author: data.data.author.nickname || data.data.author.unique_id,
      avatar: data.data.author.avatar,
      cover: data.data.cover,
      preset5mb: preset5mb,
      presetXml: presetXml,
      rawUrls: foundUrls
    });

  } catch (error) {
    console.error('Error Extracting:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan pada server saat mengekstrak link.' 
    });
  }
};
