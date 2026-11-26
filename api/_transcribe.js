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
const PROMPT = 'Transcreva exatamente o que é falado neste áudio, em português do Brasil. Responda só com a transcrição, sem aspas nem comentários. Se não houver fala clara, responda com nada.';
const quiet = t => /^(nada|\[?sil[eê]ncio\]?|\(sil[eê]ncio\))\.?$/i.test(t) ? '' : t;
const gerr = async (r, tag) => { const j = await r.json().catch(() => ({})); const e = j.error && (j.error.message || j.error); return new Error(tag + ' ' + r.status + ': ' + String(e || j.message || '').slice(0, 160)); };
// a) endpoint próprio de transcrição do AI Gateway (modelo de fala para texto)
async function gwStt(buf, gw) {
  const r = await fetch('https://ai-gateway.vercel.sh/v4/ai/transcription-model', { method: 'POST',
    headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json', 'ai-gateway-protocol-version': '0.0.1', 'ai-transcription-model-specification-version': '4', 'ai-model-id': process.env.AION_STT_MODEL || 'openai/gpt-transcribe' },
    body: JSON.stringify({ audio: buf.toString('base64'), mediaType: 'audio/wav', providerOptions: { openai: { language: 'pt' } } }) });
  if (!r.ok) throw await gerr(r, 'stt');
  const j = await r.json(); return quiet(String(j.text || '').trim());
}
// b) reserva: Gemini pelo chat, com o áudio como arquivo (formato aceito pelo Gateway)
async function gwChat(buf, gw) {
  const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST',
    headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AION_STT_CHAT || 'google/gemini-2.5-flash', temperature: 0, messages: [{ role: 'user', content: [
      { type: 'text', text: PROMPT },
      { type: 'file', file: { filename: 'trecho.wav', file_data: 'data:audio/wav;base64,' + buf.toString('base64') } }] }] }) });
  if (!r.ok) throw await gerr(r, 'chat');
  const j = await r.json();
  return quiet(String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim());
}
async function gateway(buf, gw) {
  try { return await gwStt(buf, gw); } catch (e1) { console.error('AION stt a', e1.message); try { return await gwChat(buf, gw); } catch (e2) { throw new Error(e1.message + ' / ' + e2.message); } }
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
