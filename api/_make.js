// Gera arquivos de áudio para baixar: narração (voz), efeito sonoro ou música, pela ElevenLabs. Só com o código de acesso.
const { allowed } = require('./_auth');
const VOICE = process.env.ELEVENLABS_VOICE_ID || '6PhbMr9YjdeOaTNz9y24';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, el = process.env.ELEVENLABS_API_KEY;
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  if (!el) return res.status(503).json({ error: 'not-configured', detail: 'A chave da ElevenLabs não está configurada.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = req.body || {}, tipo = String(b.tipo || 'voz'), texto = String(b.texto || '').trim().slice(0, 4000);
  if (!texto) return res.status(400).json({ error: 'empty', detail: 'Faltou o texto ou a descrição.' });
  const secs = Math.min(120, Math.max(0, Number(b.segundos) || 0));
  const voz = /^[A-Za-z0-9]{10,40}$/.test(String(b.voz || '')) ? b.voz : VOICE;
  const call = tipo === 'efeito' ? ['/v1/sound-generation?output_format=mp3_44100_128', Object.assign({ text: texto.slice(0, 450), prompt_influence: 0.4 }, secs ? { duration_seconds: Math.min(30, Math.max(0.5, secs)) } : {})]
    : tipo === 'musica' ? ['/v1/music?output_format=mp3_44100_128', { prompt: texto.slice(0, 2000), music_length_ms: Math.round((secs || 30) * 1000) }]
    : ['/v1/text-to-speech/' + voz + '?output_format=mp3_44100_128', { text: texto, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 } }];
  try {
    const r = await fetch('https://api.elevenlabs.io' + call[0], { method: 'POST', headers: { 'xi-api-key': el, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(call[1]) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return res.status(502).json({ error: 'voice-service', status: r.status, detail: String((j.detail && (j.detail.message || j.detail.status || j.detail)) || 'serviço respondeu ' + r.status).slice(0, 240) }); }
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { return res.status(502).json({ error: 'voice-service', detail: String(e.message || e).slice(0, 200) }); }
};
