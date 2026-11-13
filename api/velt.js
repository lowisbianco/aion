// Números dos anúncios: só responde com o código de acesso. Lê o snapshot do banco (atualizado pelo trabalhador) ou, na falta, da variável de ambiente.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY;
  if (!key || req.headers['x-aion-key'] !== key) return res.status(401).json({ locked: true });
  try {
    const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY;
    const r = await fetch(SB + '/rest/v1/rpc/aion_kv_get', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify({ p_key: process.env.AION_MEM_KEY, p_name: 'velt' }) });
    const j = r.ok ? await r.json() : null;
    if (j && j.yesterday) return res.status(200).json(j);
  } catch (e) {}
  try { return res.status(200).json(JSON.parse(process.env.VELT_SNAPSHOT || 'null') || { empty: true }); }
  catch (e) { return res.status(200).json({ empty: true }); }
};
