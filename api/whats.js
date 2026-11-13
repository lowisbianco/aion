// WhatsApp: recebe as mensagens da ponte (vira aviso na nave) e repassa pedidos de envio do agente para a ponte.
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const wa = process.env.WA_KEY, tool = process.env.AION_TOOL_KEY, b = req.body || {};
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  // 1) mensagem recebida, vinda da ponte
  if (wa && req.headers['x-aion-wa'] === wa) {
    const de = String(b.de || 'Contato').slice(0, 80), texto = String(b.texto || '').slice(0, 1200);
    if (!texto) return res.status(400).json({ error: 'empty' });
    const r = await fetch(SB + '/rest/v1/rpc/aion_inbox_add', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' },
      body: JSON.stringify({ p_key: MK, p_kind: 'whatsapp', p_title: (b.grupo ? 'Grupo · ' : '') + de, p_body: texto }) });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  }
  // 2) pedido de envio, vindo do agente
  if (tool && req.headers['x-aion-tool'] === tool) {
    const bridge = (process.env.WA_BRIDGE_URL || '').replace(/\/$/, '');
    if (!bridge || !wa) return res.status(200).json({ error: 'A ponte do WhatsApp ainda não está configurada.' });
    try {
      const r = await fetch(bridge + '/send', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aion-wa': wa }, body: JSON.stringify({ contato: b.contato, mensagem: b.mensagem }) });
      return res.status(200).json(await r.json());
    } catch (e) { return res.status(200).json({ error: 'A ponte do WhatsApp não respondeu.' }); }
  }
  return res.status(401).json({ error: 'locked' });
};
