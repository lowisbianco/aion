// Cérebro do AION: guarda cada conversa (falas e resumo) no banco, devolve os resumos recentes e o ponto onde a última parou, e faz busca no histórico.
const { allowed } = require('./_auth');
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
const EL = process.env.ELEVENLABS_API_KEY, AG = process.env.AION_AGENT_ID;
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ p_key: MK }, args)) });
  const t = await r.text(); if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 160)); return t ? JSON.parse(t) : null;
}
async function el(path) {
  const r = await fetch('https://api.elevenlabs.io' + path, { headers: { 'xi-api-key': EL } });
  if (!r.ok) throw new Error('voz ' + r.status); return r.json();
}
const turnsOf = d => (d.transcript || []).filter(t => t && t.message && (t.role === 'user' || t.role === 'agent'))
  .map(t => ({ r: t.role === 'user' ? 'Lowis' : 'AION', t: String(t.message).replace(/\[[^\]]*\]/g, '').trim().slice(0, 2500) })).filter(t => t.t);

// copia para o banco as conversas encerradas que ainda não estão lá; devolve a conversa em aberto, se houver
async function sync() {
  if (!EL || !AG) return null;
  const list = ((await el('/v1/convai/conversations?agent_id=' + encodeURIComponent(AG) + '&page_size=60')).conversations) || [];
  const done = list.filter(c => c.status === 'done');
  const known = (await rpc('aion_conv_known', { p_ids: done.map(c => c.conversation_id) })) || [];
  const todo = done.filter(c => !known.includes(c.conversation_id)).slice(0, 12);
  await Promise.all(todo.map(async c => {
    try {
      const d = await el('/v1/convai/conversations/' + c.conversation_id), turns = turnsOf(d), a = d.analysis || {}, m = d.metadata || {};
      await rpc('aion_conv_put', { p_id: c.conversation_id, p_started: new Date((m.start_time_unix_secs || c.start_time_unix_secs || 0) * 1000).toISOString(),
        p_secs: m.call_duration_secs || c.call_duration_secs || 0, p_title: a.call_summary_title || c.call_summary_title || '', p_summary: turns.length > 1 ? (a.transcript_summary || '') : '',
        p_body: turns.map(t => t.r + ': ' + t.t).join('\n'), p_turns: turns });
    } catch (e) {}
  }));
  const open = list[0] && list[0].status !== 'done' && list[0].status !== 'failed' ? list[0] : null;
  if (!open) return null;
  try { const d = await el('/v1/convai/conversations/' + open.conversation_id), turns = turnsOf(d);
    return turns.length > 1 ? { id: open.conversation_id, started_at: new Date((open.start_time_unix_secs || 0) * 1000).toISOString(), secs: open.call_duration_secs || 0, tail: turns.slice(-14) } : null; } catch (e) { return null; }
}

// resumo curto da conversa (Claude via chave da Anthropic ou AI Gateway da Vercel); sem ele, guarda só as falas
async function summarize(req, turns) {
  const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers['x-vercel-oidc-token'];
  if (!process.env.ANTHROPIC_API_KEY && !gw) return { title: '', summary: '' };
  try {
    const A = require('@anthropic-ai/sdk'), Anthropic = A.default || A;
    const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : new Anthropic({ apiKey: gw, baseURL: 'https://ai-gateway.vercel.sh' });
    const model = process.env.ANTHROPIC_API_KEY ? 'claude-haiku-5-5' : 'anthropic/claude-sonnet-4.5';
    const text = turns.map(t => t.r + ': ' + t.t).join('\n').slice(-60000);
    const r = await client.messages.create({ model, max_tokens: 1200, messages: [{ role: 'user', content: 'Conversa entre o Lowis e o AION, assistente pessoal dele:\n\n' + text + '\n\nResponda em português do Brasil, exatamente neste formato:\nTITULO: até 6 palavras\nRESUMO: um parágrafo com os assuntos, decisões, pedidos, preferências reveladas e o que ficou pendente ou combinado para depois.' }] });
    const out = r.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    return { title: ((/TITULO:\s*(.+)/i.exec(out) || [])[1] || '').trim().slice(0, 120), summary: ((/RESUMO:\s*([\s\S]+)/i.exec(out) || [])[1] || '').trim().slice(0, 3000) };
  } catch (e) { return { title: '', summary: '' }; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x'), tool = process.env.AION_TOOL_KEY, key = process.env.AION_KEY;
  const ok = (tool && req.headers['x-aion-tool'] === tool) || (await allowed(req));
  if (!ok) return res.status(401).json({ error: 'locked' });
  if (!SB || !SK || !MK) return res.status(503).json({ error: 'not-configured' });
  try {
    if (req.method === 'POST') {
      // a nave manda as falas quando a conversa termina
      const b = req.body || {}, turns = (Array.isArray(b.turns) ? b.turns : []).filter(t => t && t.t).slice(-400).map(t => ({ r: t.r === 'Lowis' ? 'Lowis' : 'AION', t: String(t.t).slice(0, 2500) }));
      const id = String(b.id || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 80);
      if (!id || turns.length < 2) return res.status(200).json({ ok: false, motivo: 'conversa curta' });
      const sm = await summarize(req, turns);
      await rpc('aion_conv_put', { p_id: id, p_started: new Date(Date.parse(b.started) || Date.now()).toISOString(), p_secs: Math.max(0, Number(b.secs) || 0), p_title: sm.title, p_summary: sm.summary || (turns.length > 3 ? 'Conversa sem resumo automático. Primeiras falas: ' + turns.slice(0, 4).map(t => t.r + ': ' + t.t.slice(0, 160)).join(' | ') : ''), p_body: turns.map(t => t.r + ': ' + t.t).join('\n'), p_turns: turns });
      return res.status(200).json({ ok: true, resumo: !!sm.summary });
    }
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 200);
    if (q) {
      const r = await rpc('aion_brain_search', { p_q: q, p_limit: 6 });
      const fmt = d => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
      return res.status(200).json({ conversas: (r.conversas || []).map(c => Object.assign(c, { quando: fmt(c.quando) })), memorias: (r.memorias || []).map(m => Object.assign(m, { quando: fmt(m.quando) })),
        aviso: (r.conversas || []).length || (r.memorias || []).length ? undefined : 'Nada encontrado com esses termos. Tente outras palavras.' });
    }
    let open = null; try { open = await sync(); } catch (e) {}
    const b = (await rpc('aion_brain', { p_limit: 12 })) || {};
    if (open) b.last = open;
    return res.status(200).json(b);
  } catch (e) { return res.status(502).json({ error: 'brain', detail: String(e.message || e).slice(0, 200) }); }
};
