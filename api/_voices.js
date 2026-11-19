// Vozes da ElevenLabs para o AION: as da conta e as da biblioteca em português. POST adiciona uma voz da biblioteca à conta.
const { allowed } = require('./_auth');
const DEF = process.env.ELEVENLABS_VOICE_ID || '6PhbMr9YjdeOaTNz9y24';
// as vozes escolhidas pelo Lowis, na ordem da lista (Voz 1 é a padrão do agente); o nome serve só para achá-las na biblioteca
const CURADAS = [{ id: DEF }, { id: 'ec54d9BmuMSN4IinPrjv', busca: 'Will' }, { id: '2CECaLAGTS5NRGxgbcxr', busca: 'Davi Andrei' }, { id: 'ycSgxMCYIe7MYLOqkZrH', busca: 'Bruno' }];
// liga, no agente, a permissão de trocar a voz (tts.voice_id) e mantém a da primeira fala; devolve 'ok', 'ligada' ou o motivo da falha
async function liberaTroca(api) {
  const ag = process.env.AION_AGENT_ID; if (!ag) return 'sem agente';
  try {
    const r = await api('/v1/convai/agents/' + ag); if (!r.ok) return 'agente ' + r.status;
    const a = await r.json(), ps = a.platform_settings || {}, ov = JSON.parse(JSON.stringify(ps.overrides || {}));
    const cc = ov.conversation_config_override = ov.conversation_config_override || {};
    cc.tts = cc.tts || {}; cc.agent = cc.agent || {};
    if (cc.tts.voice_id === true && cc.agent.first_message === true) return 'ok';
    cc.tts.voice_id = true; cc.agent.first_message = true;
    const p = await api('/v1/convai/agents/' + ag, { method: 'PATCH', body: JSON.stringify({ platform_settings: { overrides: ov } }) });
    return p.ok ? 'ligada' : 'patch ' + p.status;
  } catch (e) { return String(e.message || e).slice(0, 80); }
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, el = process.env.ELEVENLABS_API_KEY;
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  if (!el) return res.status(503).json({ error: 'not-configured' });
  const api = (path, opt) => fetch('https://api.elevenlabs.io' + path, Object.assign({ headers: { 'xi-api-key': el, 'content-type': 'application/json' } }, opt));
  try {
    if (req.method === 'POST' && req.body && req.body.curada) {
      // garante que a voz numerada esteja na conta: se já estiver, segue; se não, procura na biblioteca e adiciona
      const n = CURADAS.findIndex(c => c.id === String(req.body.curada)); if (n < 0) return res.status(400).json({ error: 'invalid' });
      const c = CURADAS[n];
      // sem a troca de voz liberada nas substituições (override) do agente, a ElevenLabs recusa a conversa com outra voz
      const troca = await liberaTroca(api);
      if (!c.busca) return res.status(200).json({ voz: c.id, troca });
      const mine = await api('/v2/voices?page_size=100').then(r => r.ok ? r.json() : {}).then(j => j.voices || []).catch(() => []);
      if (mine.some(v => v.voice_id === c.id)) return res.status(200).json({ voz: c.id, troca });
      // a busca pelo nome pode vir sem a voz; tenta em português e depois em qualquer idioma, e casa pelo id exato
      let hit = null;
      for (const q of ['language=pt&search=', 'search=']) {
        const lib = await api('/v1/shared-voices?page_size=100&' + q + encodeURIComponent(c.busca)).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        hit = (lib.voices || []).find(v => v.voice_id === c.id); if (hit) break;
      }
      if (!hit || !hit.public_owner_id) return res.status(404).json({ error: 'not-found', detail: 'Não achei a ' + c.busca + ' na biblioteca da ElevenLabs.' });
      const r = await api('/v1/voices/add/' + hit.public_owner_id + '/' + c.id, { method: 'POST', body: JSON.stringify({ new_name: 'AION Voz ' + (n + 1) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const d = j.detail && (j.detail.message || j.detail.status || j.detail);
        return res.status(502).json({ error: 'voice-service', status: r.status, detail: String(d || ('código ' + r.status)).slice(0, 220) });
      }
      return res.status(200).json({ voz: j.voice_id || c.id, troca });
    }
    if (req.method === 'POST') {
      const b = req.body || {}, owner = String(b.dono || ''), id = String(b.voz || ''), nome = String(b.nome || 'Voz AION').slice(0, 60);
      if (!/^[A-Za-z0-9]{10,80}$/.test(owner) || !/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: 'invalid' });
      const r = await api('/v1/voices/add/' + owner + '/' + id, { method: 'POST', body: JSON.stringify({ new_name: nome }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: 'voice-service', detail: String((j.detail && (j.detail.message || j.detail)) || r.status).slice(0, 200) });
      return res.status(200).json({ voz: j.voice_id || id });
    }
    const lib = q => api('/v1/shared-voices?page_size=40&language=pt&' + q).then(r => r.ok ? r.json() : {}).then(j => j.voices || []).catch(() => []);
    const [mine, br] = await Promise.all([api('/v2/voices?page_size=100').then(r => r.ok ? r.json() : {}).then(j => j.voices || []).catch(() => []), lib('locale=pt-BR')]);
    const shared = br.length ? br : await lib('sort=trending');
    const tag = v => [v.gender === 'male' ? 'masculina' : v.gender === 'female' ? 'feminina' : '', v.descriptive || (v.labels && v.labels.description) || ''].filter(Boolean).join(', ');
    const have = new Set(mine.map(v => v.voice_id));
    return res.status(200).json({ padrao: DEF, curadas: CURADAS.map(c => c.id),
      minhas: mine.map(v => ({ id: v.voice_id, nome: v.name, info: tag(Object.assign({ gender: v.labels && v.labels.gender }, v)), previa: v.preview_url || '' })),
      biblioteca: shared.filter(v => !have.has(v.voice_id)).map(v => ({ id: v.voice_id, dono: v.public_owner_id, nome: v.name, info: tag(v), previa: v.preview_url || '' })) });
  } catch (e) { return res.status(502).json({ error: 'voice-service', detail: String(e.message || e).slice(0, 200) }); }
};
