// Visão do AION: descreve imagens (ou quadros de um vídeo) com o Claude, para o agente de voz poder falar sobre elas.
// Usa a chave da Anthropic, se existir; senão passa pelo AI Gateway da própria Vercel (sem chave extra: a função se identifica com o token do projeto).
const { allowed } = require('./_auth');
const A = require('@anthropic-ai/sdk'), Anthropic = A.default || A;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers['x-vercel-oidc-token'];
  const direct = !!process.env.ANTHROPIC_API_KEY;
  if (!direct && !gw) return res.status(503).json({ error: 'not-configured', detail: 'A visão ainda não está ligada neste ambiente.' });
  const b = req.body || {}, imgs = (Array.isArray(b.imagens) ? b.imagens : []).filter(x => x && /^image\/(jpeg|png|webp|gif)$/.test(x.tipo) && typeof x.dados === 'string').slice(0, 8);
  if (!imgs.length) return res.status(400).json({ error: 'empty', detail: 'Nenhuma imagem chegou.' });
  const video = !!b.video, pergunta = String(b.pergunta || '').trim().slice(0, 600), fala = String(b.fala || '').trim().slice(0, 6000);
  const text = (video ? 'Estes são ' + imgs.length + ' quadros, em ordem, de um vídeo chamado "' + String(b.nome || '').slice(0, 80) + '".' + (fala ? ' Transcrição do que é falado nele: ' + fala : '') : 'Imagem enviada: "' + String(b.nome || '').slice(0, 80) + '".')
    + '\nDescreva em português do Brasil o que aparece, com os detalhes que importam: pessoas, objetos, cenário, textos legíveis, números, cores, clima e qualquer coisa fora do comum.' + (video ? ' Conte o que acontece ao longo do vídeo.' : '')
    + (pergunta ? '\nO Lowis quer saber: ' + pergunta : '') + '\nTexto corrido, sem listas nem markdown, em até dez frases. Se algo não der para ver com certeza, diga.';
  const content = imgs.map(x => ({ type: 'image', source: { type: 'base64', media_type: x.tipo, data: x.dados } })).concat([{ type: 'text', text }]);
  try {
    let r;
    if (direct) {
      r = await new Anthropic().beta.messages.create({ model: process.env.AION_VISION_MODEL || 'claude-opus-5-5', max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' }, messages: [{ role: 'user', content }] });
    } else {
      r = await new Anthropic({ apiKey: gw, baseURL: 'https://ai-gateway.vercel.sh' }).messages.create({ model: process.env.AION_VISION_MODEL || 'anthropic/claude-opus-5', max_tokens: 6000, messages: [{ role: 'user', content }] });
    }
    if (r.stop_reason === 'refusal') return res.status(200).json({ texto: '', aviso: 'O modelo de visão se recusou a descrever este conteúdo.' });
    return res.status(200).json({ texto: r.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim() });
  } catch (e) { return res.status(502).json({ error: 'vision', status: e && e.status, detail: String((e && e.message) || e).slice(0, 240) }); }
};
