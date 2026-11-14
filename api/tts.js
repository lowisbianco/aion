// Voz do AION pela ElevenLabs. Só funciona com o código de acesso, para ninguém gastar os créditos.
const VOICE = process.env.ELEVENLABS_VOICE_ID || '6PhbMr9YjdeOaTNz9y24';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, el = process.env.ELEVENLABS_API_KEY;
  const allowed = !!key && req.headers['x-aion-key'] === key;
  if (req.method !== 'POST') return res.status(200).json({ ready: !!el && allowed, configured: !!el });
  if (!allowed) return res.status(401).json({ error: 'locked' });
  if (!el) return res.status(503).json({ error: 'not-configured' });
  const text = String((req.body && req.body.text) || '').slice(0, 1400).trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  try {
    const voz = /^[A-Za-z0-9]{10,40}$/.test(String((req.body && req.body.voiceId) || '')) ? req.body.voiceId : VOICE;
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voz + '?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': el, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, speed: 1.12 } })
    });
    if (!r.ok) return res.status(502).json({ error: 'voice-service', status: r.status, detail: (await r.text()).slice(0, 300) });
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { return res.status(502).json({ error: 'voice-service', detail: String(e.message || e).slice(0, 200) }); }
};
