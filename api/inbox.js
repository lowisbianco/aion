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
    // busca de sons no Splice (o Orbit tem o conector): pede e depois lê o resultado em aion.kv 'splice_<tag>'
    if (url.searchParams.has('splice')) {
      const tag = String(url.searchParams.get('splice') || (req.body && req.body.tag) || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
      if (!tag) return res.status(400).json({ error: 'sem tag' });
      if (req.method === 'POST') {
        const b = req.body || {}, q = String(b.query || '').replace(/["\\]/g, ' ').slice(0, 200), tipo = b.tipo === 'oneshot' ? 'oneshot' : 'loop';
        const bmin = +b.bpm_min || 0, bmax = +b.bpm_max || 0;
        if (!q) return res.status(400).json({ error: 'sem busca' });
        const pedido = 'BUSCA DE SONS NO SPLICE (tag ' + tag + '). Use SOMENTE a ferramenta describe_a_sound do conector Splice, uma vez, com query "' + q + '", type "' + tipo + '"' + (bmin ? ', bpm_min ' + bmin : '') + (bmax ? ', bpm_max ' + bmax : '') + '. NÃO baixe nada (download gasta crédito do Lowis). '
          + 'Grave todos os resultados, na ordem, com execute_sql: insert into aion.kv(name, value, updated_at) values (\'splice_' + tag + '\', jsonb_build_object(\'status\',\'pronto\',\'query\',\'' + q.replace(/'/g, ' ') + '\',\'itens\', <array json com objetos {nome, bpm, tom, duracao, pack, tags, link, uuid}>), now()) on conflict (name) do update set value = excluded.value, updated_at = now(). '
          + 'Se o conector Splice não estiver disponível ou falhar, grave o mesmo registro com status \'falhou\' e o campo erro. Não crie aviso na caixa de avisos para esta tarefa.';
        const id = await rpc('aion_task_add', { p_request: pedido });
        return res.status(200).json({ ok: true, id, tag });
      }
      const v = await rpc('aion_kv_get', { p_name: 'splice_' + tag });
      return res.status(200).json(v || { status: 'pendente' });
    }
    if (req.method === 'POST') {
      const pedido = String((req.body && (req.body.pedido || req.body.request)) || '').trim().slice(0, 2500);
      if (!pedido) return res.status(400).json({ error: 'empty' });
      const id = await rpc('aion_task_add', { p_request: pedido });
      return res.status(200).json({ ok: true, id, aviso: 'Tarefa registrada. O trabalhador roda de hora em hora, das 7h às 23h; o resultado aparece na caixa de avisos da nave.' });
    }
    return res.status(200).json(await rpc('aion_inbox_list', { p_limit: 20 }));
  } catch (e) { return res.status(502).json({ error: 'inbox', detail: String(e.message || e).slice(0, 200) }); }
};
