// WhatsApp: fala com a ponte (mensagens recebidas, login guardado, sinal de vida) e repassa pedidos de envio do agente.
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ p_key: MK }, args)) });
  const t = await r.text(); if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 160)); return t ? JSON.parse(t) : null;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x'), wa = process.env.WA_KEY, tool = process.env.AION_TOOL_KEY, key = process.env.AION_KEY, b = req.body || {};
  try {
    // situação da ponte, para o site (com o QR) ou para diagnóstico
    if (req.method === 'GET') {
      const client = key && req.headers['x-aion-key'] === key, diag = tool && (url.searchParams.get('t') === tool || req.headers['x-aion-tool'] === tool);
      if (!client && !diag) return res.status(401).json({ error: 'locked' });
      if (url.searchParams.has('conversas') || url.searchParams.has('contato')) {
        const v = await rpc('aion_kv_get', { p_name: 'wa_chats' }), list = (v && v.chats) || [];
        const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const q = norm(url.searchParams.get('contato'));
        if (q) {
          const hit = list.filter(c => norm(c.name) === q).concat(list.filter(c => norm(c.name).startsWith(q)), list.filter(c => norm(c.name).includes(q)))[0];
          if (!hit) return res.status(200).json({ error: 'Não encontrei uma conversa com "' + url.searchParams.get('contato') + '".', conversas: list.slice(0, 25).map(c => c.name) });
          return res.status(200).json({ conversa: hit.name, grupo: hit.group, mensagens: hit.msgs.map(m => ({ de: m.me ? 'Lowis' : (m.from || hit.name), texto: m.text, quando: new Date(m.t * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) })) });
        }
        if (client) return res.status(200).json({ at: v && v.at, chats: list });
        return res.status(200).json({ conversas: list.slice(0, 30).map(c => { const l = c.msgs[c.msgs.length - 1]; return { nome: c.name, grupo: c.group, nao_lidas: c.unread, ultima: l ? (l.me ? 'Lowis: ' : (l.from ? l.from + ': ' : '')) + l.text : '', quando: new Date(c.t * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }; }) });
      }
      const st = await rpc('aion_kv_get', { p_name: 'wa_status' });
      if (!st) return res.status(200).json({ ponte: 'nunca-ligou' });
      const viva = Date.now() - Date.parse(st.at) < 100000;
      return res.status(200).json({ ponte: viva ? 'ligada' : 'desligada', visto: st.at, conectado: viva && !!st.connected, temEndereco: !!st.dominio, qr: client && viva && !st.connected ? st.qr || null : undefined, temQr: !!st.qr });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    // chamadas da ponte
    if (wa && req.headers['x-aion-wa'] === wa) {
      const acao = b.acao || 'msg';
      if (acao === 'pulso') { await rpc('aion_kv_set', { p_name: 'wa_status', p_value: { at: new Date().toISOString(), connected: !!b.connected, qr: b.qr || null, dominio: String(b.dominio || '').slice(0, 200) } }); return res.status(200).json({ ok: true }); }
      if (acao === 'conversas_gravar') { await rpc('aion_kv_set', { p_name: 'wa_chats', p_value: { at: new Date().toISOString(), chats: Array.isArray(b.chats) ? b.chats.slice(0, 40) : [] } }); return res.status(200).json({ ok: true }); }
      if (acao === 'conversas_ler') { const v = await rpc('aion_kv_get', { p_name: 'wa_chats' }); return res.status(200).json({ chats: (v && v.chats) || [] }); }
      if (acao === 'estado_ler') { const v = await rpc('aion_kv_get', { p_name: 'wa_auth' }); return res.status(200).json({ z: (v && v.z) || '' }); }
      if (acao === 'estado_gravar') { await rpc('aion_kv_set', { p_name: 'wa_auth', p_value: { z: String(b.z || ''), at: new Date().toISOString() } }); return res.status(200).json({ ok: true }); }
      const de = String(b.de || 'Contato').slice(0, 80), texto = String(b.texto || '').slice(0, 1200);
      if (!texto) return res.status(400).json({ error: 'empty' });
      await rpc('aion_inbox_add', { p_kind: 'whatsapp', p_title: (b.grupo ? 'Grupo · ' : '') + de, p_body: texto });
      return res.status(200).json({ ok: true });
    }
    // pedido de envio, vindo do agente
    if (tool && req.headers['x-aion-tool'] === tool) {
      const st = await rpc('aion_kv_get', { p_name: 'wa_status' });
      const dom = (process.env.WA_BRIDGE_URL || (st && st.dominio) || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!st || Date.now() - Date.parse(st.at) > 100000) return res.status(200).json({ error: 'A ponte do WhatsApp está desligada agora.' });
      if (!st.connected) return res.status(200).json({ error: 'A ponte está ligada, mas o WhatsApp ainda não foi conectado pelo QR code.' });
      if (!dom) return res.status(200).json({ error: 'A ponte ainda não tem endereço público no Railway, então consigo receber mensagens, mas não enviar.' });
      try {
        const r = await fetch('https://' + dom + '/send', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aion-wa': wa }, body: JSON.stringify({ contato: b.contato, mensagem: b.mensagem }) });
        return res.status(200).json(await r.json());
      } catch (e) { return res.status(200).json({ error: 'A ponte do WhatsApp não respondeu.' }); }
    }
    return res.status(401).json({ error: 'locked' });
  } catch (e) { return res.status(502).json({ error: 'whats', detail: String(e.message || e).slice(0, 200) }); }
};
