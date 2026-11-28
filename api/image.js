// Imagens para ilustrar a fala do AION: busca fotos reais (Tavily) para um assunto.
const { allowed } = require('./_auth');
// armazenamento dos fundos (Supabase Storage, bucket público aion-fundos): só grava dentro da pasta secreta do servidor
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
let DIR = '';
async function store(buf, mime) {
  if (!DIR) { const r = await fetch(SB + '/rest/v1/rpc/aion_kv_get', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify({ p_key: MK, p_name: 'fundos_dir' }) }); const j = await r.json(); DIR = j && j.dir; }
  if (!DIR) throw new Error('sem pasta');
  const ext = /mp4/.test(mime) ? 'mp4' : /png/.test(mime) ? 'png' : /webp/.test(mime) ? 'webp' : 'jpg', name = DIR + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
  const r = await fetch(SB + '/storage/v1/object/aion-fundos/' + name, { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': mime, 'cache-control': '31536000' }, body: buf });
  if (!r.ok) throw new Error('storage ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return SB + '/storage/v1/object/public/aion-fundos/' + name;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, url = new URL(req.url, 'http://x');
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers['x-vercel-oidc-token'];
  // gerar imagem nova (fundo de tela da janela, ilustrações): AI Gateway (Flux) quando houver créditos; senão o Pollinations gratuito.
  // A imagem é guardada no armazenamento do AION (Supabase) para ter endereço fixo (o vídeo do fundo parte dela).
  if (url.searchParams.has('gerar')) {
    const b = req.body || {}, prompt = String(b.prompt || url.searchParams.get('prompt') || '').trim().slice(0, 900), w = Math.min(2048, +b.w || 1344), h = Math.min(2048, +b.h || 768);
    if (!prompt) return res.status(400).json({ error: 'empty' });
    let buf = null, mime = 'image/jpeg', via = '';
    if (gw) {
      for (const model of [process.env.AION_IMAGE_MODEL || 'bfl/flux-2-pro', 'openai/gpt-image-2']) {
        try {
          const r = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', { method: 'POST', headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json' },
            body: JSON.stringify({ model, prompt, n: 1, size: w + 'x' + h, response_format: 'b64_json' }) });
          const j = await r.json().catch(() => ({})), d = j.data && j.data[0];
          if (r.ok && d && d.b64_json){ buf = Buffer.from(d.b64_json, 'base64'); mime = 'image/png'; via = model; break; }
          if (r.ok && d && d.url){ const g = await fetch(d.url); if (g.ok){ buf = Buffer.from(await g.arrayBuffer()); mime = g.headers.get('content-type') || mime; via = model; break; } }
          console.error('AION image', model, r.status, String((j.error && (j.error.message || j.error)) || '').slice(0, 140));
        } catch (e) { console.error('AION image', model, String(e.message || e).slice(0, 140)); }
      }
    }
    const free = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + Math.min(w, 1600) + '&height=' + Math.min(h, 1600) + '&seed=' + Math.floor(Math.random() * 1e6);
    if (!buf) { try { const c = new AbortController(), t = setTimeout(() => c.abort(), 45000); const g = await fetch(free, { signal: c.signal }); clearTimeout(t); if (g.ok && /image/.test(g.headers.get('content-type') || '')){ buf = Buffer.from(await g.arrayBuffer()); mime = g.headers.get('content-type'); via = 'pollinations'; } } catch (e) {} }
    if (!buf) return res.status(200).json({ src: free, via: 'pollinations-direto' });
    const up = await store(buf, mime).catch(e => { console.error('AION store', e.message); return null; });
    return res.status(200).json({ src: up || ('data:' + mime + ';base64,' + buf.toString('base64')), hosted: !!up, via });
  }
  // Plano A (preferência do Lowis): Higgsfield, pelo Orbit (que tem o conector). Pede a tarefa e o resultado volta em aion.kv 'fundo_hf_<tag>'.
  if (url.searchParams.get('hf') === 'pedir') {
    const b = req.body || {}, mood = String(b.mood || '').slice(0, 200), tag = String(b.tag || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    if (!mood || !tag) return res.status(400).json({ error: 'faltou mood ou tag' });
    const q = process.env.AION_HF_RES || '1080p';
    const pedido = 'FUNDO DE TELA DA NAVE (tag ' + tag + '). O Lowis autorizou gastar créditos do plano Higgsfield dele (assinatura já paga, sem cobrança nova) para este fundo: cerca de 207 créditos. Use SOMENTE o conector Higgsfield, nesta ordem: '
      + '1) generate_image com model gpt_image_2_6, quality max, resolution 4k, aspect_ratio 21:9, output_format jpeg, prompt: "Ultra realistic cinematic ultra-wide landscape photograph, ' + mood.replace(/"/g, "'") + ', horizon and main subject in the middle band, calm atmosphere, natural light, rich detail, no people, no text, no watermark, no window frame". Espere com jobs_wait. '
      + '2) generate_video com model cinematic_studio_3_0, resolution ' + q + ', aspect_ratio 21:9, duration 15, generate_audio false, medias com a imagem do passo 1 (job id) nos papéis start_image e end_image, prompt: "Seamless perfect loop, gentle ambient motion of the scene (' + mood.replace(/"/g, "'") + '), static camera, slow and calm, returns exactly to the first frame". Espere terminar com jobs_wait, consultando de novo até ficar pronto. '
      + '3) Grave o resultado com execute_sql: insert into aion.kv(name, value, updated_at) values (\'fundo_hf_' + tag + '\', jsonb_build_object(\'status\',\'pronto\',\'image\',<url da imagem>,\'video\',<url do video>), now()) on conflict (name) do update set value = excluded.value, updated_at = now(). '
      + 'Se faltar crédito ou qualquer passo falhar, grave o mesmo registro com status \'falhou\' e o campo erro explicando, e não tente outro gerador nem outra qualidade. Não crie aviso na caixa de avisos para esta tarefa.';
    const r = await fetch(SB + '/rest/v1/rpc/aion_task_add', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify({ p_key: MK, p_request: pedido }) });
    if (!r.ok) return res.status(200).json({ error: 'fila ' + r.status });
    return res.status(200).json({ ok: true, tag, id: await r.json().catch(() => null) });
  }
  if (url.searchParams.get('hf') === 'status') {
    const tag = String(url.searchParams.get('tag') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    const r = await fetch(SB + '/rest/v1/rpc/aion_kv_get', { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify({ p_key: MK, p_name: 'fundo_hf_' + tag }) });
    const v = r.ok ? await r.json().catch(() => null) : null;
    return res.status(200).json(v || { status: 'pendente' });
  }
  // fundo em vídeo: a imagem vira um vídeo em loop (o primeiro e o último quadro são a própria imagem, então a volta é perfeita)
  if (url.searchParams.get('video') === 'iniciar') {
    const b = req.body || {}, image = String(b.image || ''), prompt = String(b.prompt || '').slice(0, 900);
    if (!/^https:\/\//.test(image)) return res.status(400).json({ error: 'imagem sem endereço público' });
    if (!gw) return res.status(200).json({ error: 'sem acesso ao AI Gateway' });
    const { experimental_startVideo: startVideo } = require('ai'), { createGateway } = require('@ai-sdk/gateway'), g = createGateway({ apiKey: gw });
    const model = process.env.AION_VIDEO_MODEL || 'klingai/kling-v3.0-i2v';
    let last = '';
    for (const duration of [15, 10]) {
      try {
        const r = await startVideo({ model: g.videoModel(model), prompt: prompt + '. Seamless perfect loop: the scene moves gently and returns exactly to the opening frame. Slow, calm, cinematic ambient motion; static camera.', duration, aspectRatio: '16:9',
          frameImages: [{ image, frameType: 'first_frame' }, { image, frameType: 'last_frame' }], providerOptions: { klingai: { mode: 'std' } } });
        return res.status(200).json({ op: r.operation, model, duration });
      } catch (e) { last = String(e.message || e).slice(0, 220); console.error('AION video start', duration, last); }
    }
    return res.status(200).json({ error: last || 'não iniciou' });
  }
  if (url.searchParams.get('video') === 'status') {
    const b = req.body || {}; if (!b.op) return res.status(400).json({ error: 'sem operação' });
    if (!gw) return res.status(200).json({ status: 'error', error: 'sem acesso ao AI Gateway' });
    const { experimental_getVideoStatus: getVideoStatus } = require('ai'), { createGateway } = require('@ai-sdk/gateway'), g = createGateway({ apiKey: gw });
    try {
      const s = await getVideoStatus(g.videoModel(String(b.model || 'klingai/kling-v3.0-i2v')), { operation: b.op });
      if (s.status === 'pending') return res.status(200).json({ status: 'pending' });
      if (s.status === 'error') return res.status(200).json({ status: 'error', error: String(s.error || '').slice(0, 200) });
      const v = (s.videos || [])[0]; if (!v) return res.status(200).json({ status: 'error', error: 'vídeo vazio' });
      let buf = null;
      if (v.type === 'url'){ const r = await fetch(v.url); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); }
      else if (v.type === 'base64') buf = Buffer.from(v.data, 'base64');
      else if (v.data) buf = Buffer.from(v.data);
      if (!buf) return res.status(200).json({ status: 'completed', src: v.url || '' });
      const up = await store(buf, 'video/mp4').catch(e => { console.error('AION store video', e.message); return null; });
      return res.status(200).json({ status: 'completed', src: up || v.url || '' });
    } catch (e) { return res.status(200).json({ status: 'error', error: String(e.message || e).slice(0, 200) }); }
  }
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 200), tk = process.env.TAVILY_API_KEY;
  if (!q) return res.status(400).json({ error: 'empty' });
  if (!tk) return res.status(200).json({ images: [] });
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk },
      body: JSON.stringify({ query: q, max_results: 5, include_images: true, include_image_descriptions: true, search_depth: 'basic' }) });
    if (!r.ok) return res.status(200).json({ images: [], error: 'http ' + r.status });
    const j = await r.json();
    const images = (j.images || []).map(x => typeof x === 'string' ? { url: x } : { url: x.url, desc: x.description || '' })
      .filter(x => /^https:\/\//.test(x.url) && !/\.svg(\?|$)|logo|icon|avatar|sprite/i.test(x.url)).slice(0, 6);
    return res.status(200).json({ images });
  } catch (e) { return res.status(200).json({ images: [], error: String(e.message || e).slice(0, 80) }); }
  finally { clearTimeout(t); }
};
