// Vozes da ElevenLabs para o AION: as da conta e as da biblioteca em português. POST adiciona uma voz da biblioteca à conta.
const DEF = process.env.ELEVENLABS_VOICE_ID || '6PhbMr9YjdeOaTNz9y24';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, el = process.env.ELEVENLABS_API_KEY;
  if (!key || req.headers['x-aion-key'] !== key) return res.status(401).json({ error: 'locked' });
  if (!el) return res.status(503).json({ error: 'not-configured' });
  const api = (path, opt) => fetch('https://api.elevenlabs.io' + path, Object.assign({ headers: { 'xi-api-key': el, 'content-type': 'application/json' } }, opt));
  try {
    if (req.method === 'POST') {
      const b = req.body || {}, owner = String(b.dono || ''), id = String(b.voz || ''), nome = String(b.nome || 'Voz AION').slice(0, 60);
      if (!/^[A-Za-z0-9]{10,80}$/.test(owner) || !/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: 'invalid' });
      const r = await api('/v1/voices/add/' + owner + '/' + id, { method: 'POST', body: JSON.stringify({ new_name: nome }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: 'voice-service', detail: String((j.detail && (j.detail.message || j.detail)) || r.status).slice(0, 200) });
      return res.status(200).json({ voz: j.voice_id || id });
    }
    const lib = q => api('/v1/shared-voices?page_size=40&language=pt&' + q).then(r => r.ok ? r.json() : {}).then(j => j.voices || []).catch(() => []);
    const [mine, br] = await Promise.all([api('/v2/voices?page_size=100').then(r => r.ok ? r.json() : {}).then(j => j.voices || []).catch(() => []), lib('locale=pt-BR')]);
    const shared = br.length ? br : await lib('sort=trending');
    const tag = v => [v.gender === 'male' ? 'masculina' : v.gender === 'female' ? 'feminina' : '', v.descriptive || (v.labels && v.labels.description) || ''].filter(Boolean).join(', ');
    const have = new Set(mine.map(v => v.voice_id));
    return res.status(200).json({ padrao: DEF,
      minhas: mine.map(v => ({ id: v.voice_id, nome: v.name, info: tag(Object.assign({ gender: v.labels && v.labels.gender }, v)), previa: v.preview_url || '' })),
      biblioteca: shared.filter(v => !have.has(v.voice_id)).map(v => ({ id: v.voice_id, dono: v.public_owner_id, nome: v.name, info: tag(v), previa: v.preview_url || '' })) });
  } catch (e) { return res.status(502).json({ error: 'voice-service', detail: String(e.message || e).slice(0, 200) }); }
};
