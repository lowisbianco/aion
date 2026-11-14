// Caixa de avisos e fila de tarefas do AION (Supabase).
const { allowed } = require('./_auth');
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ p_key: MK }, args)) });
  const t = await r.text(); if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 160)); return t ? JSON.parse(t) : null;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x'), tool = process.env.AION_TOOL_KEY, key = process.env.AION_KEY;
  const ok = (tool && (req.headers['x-aion-tool'] === tool || url.searchParams.get('t') === tool)) || (await allowed(req));
  if (!ok) return res.status(401).json({ error: 'locked' });
  try {
    if (req.method === 'POST') {
      const pedido = String((req.body && (req.body.pedido || req.body.request)) || '').trim().slice(0, 2500);
      if (!pedido) return res.status(400).json({ error: 'empty' });
      const id = await rpc('aion_task_add', { p_request: pedido });
      return res.status(200).json({ ok: true, id, aviso: 'Tarefa registrada. O trabalhador roda de hora em hora, das 7h às 23h; o resultado aparece na caixa de avisos da nave.' });
    }
    return res.status(200).json(await rpc('aion_inbox_list', { p_limit: 20 }));
  } catch (e) { return res.status(502).json({ error: 'inbox', detail: String(e.message || e).slice(0, 200) }); }
};
