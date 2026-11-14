// Transcreve um trecho de áudio (WAV enviado pela nave) com o speech-to-text da ElevenLabs. Nada é guardado no servidor.
const { allowed } = require('./_auth');
function raw(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((ok, no) => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); req.on('error', no); });
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, el = process.env.ELEVENLABS_API_KEY;
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  if (!el) return res.status(503).json({ error: 'not-configured', detail: 'A chave da ElevenLabs não está configurada.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const buf = await raw(req);
    if (!buf || buf.length < 100) return res.status(400).json({ error: 'empty', detail: 'O áudio chegou vazio.' });
    const fd = new FormData();
    fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'por'); fd.append('tag_audio_events', 'false');
    fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'trecho.wav');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': el }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'stt', detail: String((j.detail && (j.detail.message || j.detail.status || j.detail)) || 'serviço respondeu ' + r.status).slice(0, 240) });
    return res.status(200).json({ text: String(j.text || '').trim() });
  } catch (e) { return res.status(502).json({ error: 'stt', detail: String(e.message || e).slice(0, 200) }); }
};
