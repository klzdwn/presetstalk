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
    let title = '';
    let author = 'Creator TikTok';
    let avatar = '';
    let textCorpus = [];

    // --- SUMBER 1: TikWM API ---
    try {
      const res1 = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&comment=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
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
    } catch (e) {
      console.log('TikWM Error, mencoba fallback...');
    }

    // --- SUMBER 2: LoFi Alternative API (Jika TikWM tidak dapat komentar) ---
    if (textCorpus.length <= 1) {
      try {
        const res2 = await axios.post('https://ssstik.io/abc?url=dl', 
          `id=${encodeURIComponent(tiktokUrl)}&locale=id&tt=0`, 
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            },
            timeout: 5000
          }
        );
        if (res2.data && typeof res2.data === 'string') {
          // Ambil teks apapun yang mengandung link dari HTML response SSSTik
          textCorpus.push(res2.data);
        }
      } catch (e) {
        console.log('SSSTik Error');
      }
    }

    const fullText = textCorpus.join(' ');

    // --- REGEX MATCHING DENGAN DETEKSI KHUSUS PRESET AM ---
    // Mampu mendeteksi alight.link, drive, mediafire, s.id, bit.ly, dll.
    const urlRegex = /(https?:\/\/[^\s<>"{}|\^~\[\]`]+)/gi;
    let matches = fullText.match(urlRegex) || [];

    // Bersihkan karakter penutup yang ikut terseret
    matches = matches.map(u => u.replace(/[.,;)]$/, ''));

    let preset5mb = null;
    let presetXml = null;

    for (const url of matches) {
      const lower = url.toLowerCase();

      // Deteksi Link 5MB / Alight Motion
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('am.link')) {
        if (!preset5mb) preset5mb = url;
      } 
      // Deteksi XML / Drive / Shortener Link
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

    // Jika ada link tetapi tidak terindikasi domain spesifik di atas
    if (!preset5mb && matches.length > 0) preset5mb = matches[0];
    if (!presetXml && matches.length > 1) presetXml = matches[1];

    return res.status(200).json({
      success: true,
      title: title || 'Preset Alight Motion',
      author: author,
      avatar: avatar,
      preset5mb: preset5mb,
      presetXml: presetXml,
      rawUrls: matches
    });

  } catch (error) {
    console.error('Extractor Error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal mengekstrak link dari TikTok.' 
    });
  }
};
