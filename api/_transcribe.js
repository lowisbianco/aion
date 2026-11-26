// Transcreve um trecho de áudio (WAV enviado pela nave). Nada é guardado no servidor.
// 1) ElevenLabs (scribe), se houver chave e créditos; 2) senão, Gemini pelo AI Gateway da Vercel (mesmo acesso do cérebro reserva).
const { allowed } = require('./_auth');
let elDown = 0; // quando a ElevenLabs recusa (créditos), pula ela por 10 minutos
function raw(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((ok, no) => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); req.on('error', no); });
}
async function eleven(buf, el) {
  const fd = new FormData();
  fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'por'); fd.append('tag_audio_events', 'false');
  fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'trecho.wav');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': el }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((j.detail && (j.detail.message || j.detail.status || j.detail)) || 'elevenlabs ' + r.status).slice(0, 200));
  return String(j.text || '').trim();
}
async function gateway(buf, gw) {
  const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST',
    headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AION_STT_MODEL || 'google/gemini-2.5-flash', temperature: 0, messages: [{ role: 'user', content: [
      { type: 'text', text: 'Transcreva exatamente o que é falado neste áudio, em português do Brasil. Responda só com a transcrição, sem aspas nem comentários. Se não houver fala clara, responda com nada.' },
      { type: 'input_audio', input_audio: { data: buf.toString('base64'), format: 'wav' } }] }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String((j.error && (j.error.message || j.error)) || 'gateway ' + r.status).slice(0, 200));
  const t = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
  return /^(nada|\[?sil[eê]ncio\]?|\(sil[eê]ncio\))\.?$/i.test(t) ? '' : t;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const el = process.env.ELEVENLABS_API_KEY, gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers['x-vercel-oidc-token'];
  let buf; try { buf = await raw(req); } catch (e) { return res.status(400).json({ error: 'empty' }); }
  if (!buf || buf.length < 100) return res.status(400).json({ error: 'empty', detail: 'O áudio chegou vazio.' });
  const errs = [];
  if (el && Date.now() > elDown) { try { return res.status(200).json({ text: await eleven(buf, el), via: 'elevenlabs' }); } catch (e) { elDown = Date.now() + 10 * 60 * 1000; errs.push('ElevenLabs: ' + e.message); } }
  if (gw) { try { return res.status(200).json({ text: await gateway(buf, gw), via: 'gateway' }); } catch (e) { errs.push('Gateway: ' + e.message); console.error('AION stt', errs); } }
  return res.status(502).json({ error: 'stt', detail: errs.join(' | ') || 'Nenhum serviço de transcrição configurado.' });
};
