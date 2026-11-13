// Pesquisa ao vivo para o agente de voz: notícias recentes (com leitura das matérias), enciclopédia e, com chave, busca geral na web.
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6' };

async function get(url, ms, max, opt) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, Object.assign({ signal: c.signal, redirect: 'follow', headers: UA }, opt || {}));
    if (!r.ok) return { err: 'http ' + r.status };
    return { text: (await r.text()).slice(0, max) };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : String(e.message || e).slice(0, 80) }; }
  finally { clearTimeout(t); }
}
function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
}
const strip = s => decode(decode(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); return m ? decode(m[1]).trim() : ''; };

function unwrap(url) {
  url = decode(url); let m;
  if ((m = url.match(/[?&]url=([^&]+)/)) && /bing\.com\/news\/apiclick/.test(url)) { try { return decodeURIComponent(m[1]); } catch (e) {} }
  return url;
}
// Busca geral na web: só com um buscador de verdade (Tavily), quando a chave estiver configurada.
async function tavily(q) {
  const k = process.env.TAVILY_API_KEY; if (!k) return { off: true, items: [] };
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + k },
      body: JSON.stringify({ query: q, max_results: 6, search_depth: 'basic', include_answer: true }) });
    if (!r.ok) return { err: 'http ' + r.status, items: [] };
    const j = await r.json();
    return { answer: j.answer || '', items: (j.results || []).map(x => { let site = ''; try { site = new URL(x.url).hostname.replace(/^www\./, ''); } catch (e) {} return { site, title: x.title, snippet: String(x.content || '').slice(0, 900) }; }) };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : String(e.message || e).slice(0, 80), items: [] }; }
  finally { clearTimeout(t); }
}
async function news(q) {
  const [g, b] = await Promise.all([
    get('https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=' + encodeURIComponent(q), 4500, 400000),
    get('https://www.bing.com/news/search?format=rss&setlang=pt-BR&cc=BR&q=' + encodeURIComponent(q), 4500, 400000)]);
  const out = [];
  for (const [src, r] of [['google', g], ['bing', b]]) {
    if (!r.text) continue;
    for (const it of (r.text.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 10)) {
      let title = strip(tag(it, 'title')), source = strip(tag(it, 'source') || tag(it, 'News:Source'));
      if (source) title = title.replace(new RegExp('\\s+-\\s+' + source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');
      const d = new Date(tag(it, 'pubDate'));
      out.push({ title, source, date: isNaN(d) ? null : d.toISOString(), snippet: src === 'bing' ? strip(tag(it, 'description')).slice(0, 260) : '', url: src === 'bing' ? unwrap(tag(it, 'link')) : '' });
    }
  }
  const seen = new Set();
  return out.filter(n => { const k = n.title.toLowerCase().slice(0, 45); if (!n.title || seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
}
async function wiki(q) {
  for (const lang of ['pt', 'en']) {
    const s = await get('https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=' + encodeURIComponent(q), 3500, 100000);
    try {
      const hit = JSON.parse(s.text).query.search[0]; if (!hit) continue;
      const p = await get('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(hit.title.replace(/ /g, '_')), 3500, 100000);
      const j = JSON.parse(p.text); if (j.extract) return { title: j.title, extract: j.extract.slice(0, 900), lang };
    } catch (e) {}
  }
  return null;
}
async function readPage(item) {
  const r = await get(item.url, 3500, 500000);
  if (!r.text || !/<html|<body|<p[\s>]/i.test(r.text)) return;
  let h = r.text.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ');
  const main = h.match(/<(article|main)[\s\S]*?<\/\1>/i); if (main && main[0].length > 800) h = main[0];
  const ps = (h.match(/<p[\s>][\s\S]*?<\/p>/gi) || []).map(strip).filter(t => t.length > 60);
  const text = ps.join(' ').slice(0, 1500); if (text.length > 200) item.text = text;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_TOOL_KEY, url = new URL(req.url, 'http://x');
  if (!key || (req.headers['x-aion-tool'] !== key && url.searchParams.get('t') !== key)) return res.status(401).json({ error: 'locked' });
  const q = (url.searchParams.get('q') || (req.body && req.body.q) || '').toString().trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'empty' });
  const debug = url.searchParams.get('debug') === '1';
  const [tv, n, w] = await Promise.all([tavily(q), news(q), wiki(q)]);
  await Promise.all(n.filter(x => /^https?:/.test(x.url)).slice(0, 3).map(readPage));
  const out = { query: q, now: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), answer: tv.answer || undefined, web: tv.items, news: n.map(({ url, ...r }) => r), wiki: w };
  if (!tv.items.length && !n.length && !w) out.note = 'Nenhuma fonte ao vivo retornou resultado para esta consulta. Responda com o que você sabe e avise que não conseguiu confirmar ao vivo.';
  if (debug) out.debug = { tavily: tv.off ? 'sem chave' : tv.err || tv.items.length, news: n.length, wiki: !!w, read: n.filter(x => x.text).length };
  res.status(200).json(out);
};
