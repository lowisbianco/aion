// Memória de longo prazo do AION (Supabase). Lê e grava só com o código de acesso ou a chave das ferramentas.
const { allowed } = require('./_auth');
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;

async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST',
    headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({ p_key: MK }, args)) });
  const t = await r.text();
  if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 160));
  return t ? JSON.parse(t) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  const tool = process.env.AION_TOOL_KEY, key = process.env.AION_KEY;
  const ok = (tool && (req.headers['x-aion-tool'] === tool || url.searchParams.get('t') === tool)) || (await allowed(req));
  if (!ok) return res.status(401).json({ error: 'locked' });
  if (!SB || !SK || !MK) return res.status(503).json({ error: 'not-configured' });
  try {
    if (req.method === 'POST') {
      const b = req.body || {}, content = String(b.conteudo || b.content || '').trim().slice(0, 1500);
      if (!content) return res.status(400).json({ error: 'empty' });
      const id = await rpc('aion_remember', { p_kind: String(b.tipo || b.kind || 'fato').slice(0, 30), p_content: content });
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'DELETE') return res.status(200).json({ ok: await rpc('aion_forget', { p_id: Number(url.searchParams.get('id')) }) });
    const items = await rpc('aion_recall', { p_limit: 120 });
    return res.status(200).json({ items: items || [] });
  } catch (e) { return res.status(502).json({ error: 'memory', detail: String(e.message || e).slice(0, 200) }); }
};
