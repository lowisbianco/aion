// Imagens para ilustrar a fala do AION: busca fotos reais (Tavily) para um assunto.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY, url = new URL(req.url, 'http://x');
  if (!key || req.headers['x-aion-key'] !== key) return res.status(401).json({ error: 'locked' });
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
