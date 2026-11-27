// Imagens para ilustrar a fala do AION: busca fotos reais (Tavily) para um assunto.
const { allowed } = require('./_auth');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, url = new URL(req.url, 'http://x');
  if (!(await allowed(req))) return res.status(401).json({ error: 'locked' });
  // gerar imagem nova (fundo de tela da janela, ilustrações): AI Gateway (Flux) quando houver créditos; senão o endereço gratuito do Pollinations
  if (url.searchParams.has('gerar')) {
    const b = req.body || {}, prompt = String(b.prompt || url.searchParams.get('prompt') || '').trim().slice(0, 900), w = Math.min(2048, +b.w || 1536), h = Math.min(2048, +b.h || 640);
    if (!prompt) return res.status(400).json({ error: 'empty' });
    const seed = Math.floor(Math.random() * 1e6), free = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + Math.min(w, 1600) + '&height=' + Math.min(h, 1600) + '&seed=' + seed;
    const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers['x-vercel-oidc-token'];
    if (gw) {
      for (const model of [process.env.AION_IMAGE_MODEL || 'bfl/flux-2-pro', 'openai/gpt-image-2']) {
        try {
          const r = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', { method: 'POST', headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json' },
            body: JSON.stringify({ model, prompt, n: 1, size: w + 'x' + h, response_format: 'b64_json' }) });
          const j = await r.json().catch(() => ({}));
          const d = j.data && j.data[0];
          if (r.ok && d && (d.b64_json || d.url)) return res.status(200).json({ src: d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url, via: model });
          console.error('AION image', model, r.status, String((j.error && (j.error.message || j.error)) || '').slice(0, 140));
        } catch (e) { console.error('AION image', model, String(e.message || e).slice(0, 140)); }
      }
    }
    return res.status(200).json({ src: free, via: 'pollinations' });
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
