// Briefing ao vivo: clima (Open-Meteo), notícias (RSS dos veículos) e curadoria do dia.
const { STUDIO, RADAR } = require('./_content.js');

const CITIES = [
  { name: 'Santo André', lat: -23.6639, lon: -46.5383 },
  { name: 'São Bernardo', lat: -23.6914, lon: -46.5646 },
  { name: 'Mauá', lat: -23.6677, lon: -46.4613 }
];

const AI_RE = /\bIA\b|\bAI\b|intelig[êe]ncia artificial|artificial intelligence|openai|chatgpt|gemini|claude|anthropic|\bllm\b|deepmind|copilot|agentes? de ia|machine learning|\bgpt/i;
const SEP_RE = /palmeiras|verd[ãa]o|alviverde|abel ferreira|allianz parque/i;

const FEEDS = {
  ai: [
    { url: 'https://olhardigital.com.br/tag/inteligencia-artificial/feed/', name: 'Olhar Digital', lang: 'pt' },
    { url: 'https://canaltech.com.br/rss/inteligencia-artificial/', name: 'Canaltech', lang: 'pt' },
    { url: 'https://tecnoblog.net/feed/', name: 'Tecnoblog', lang: 'pt', filter: AI_RE },
    { url: 'https://www.tecmundo.com.br/rss', name: 'TecMundo', lang: 'pt', filter: AI_RE },
    { url: 'https://exame.com/inteligencia-artificial/feed/', name: 'Exame', lang: 'pt' },
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', lang: 'en' },
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', lang: 'en' },
    { url: 'https://venturebeat.com/category/ai/feed/', name: 'VentureBeat', lang: 'en' }
  ],
  mkt: [
    { url: 'https://www.meioemensagem.com.br/feed', name: 'Meio & Mensagem', lang: 'pt' },
    { url: 'https://mundodomarketing.com.br/feed/', name: 'Mundo do Marketing', lang: 'pt' },
    { url: 'https://www.b9.com.br/feed/', name: 'B9', lang: 'pt' },
    { url: 'https://rockcontent.com/br/blog/feed/', name: 'Rock Content', lang: 'pt' },
    { url: 'https://www.socialmediatoday.com/feeds/news/', name: 'Social Media Today', lang: 'en' },
    { url: 'https://searchengineland.com/feed', name: 'Search Engine Land', lang: 'en' },
    { url: 'https://www.jonloomer.com/feed/', name: 'Jon Loomer', lang: 'en' }
  ],
  sep: [
    { url: 'https://www.palmeiras.com.br/feed/', name: 'Palmeiras (oficial)', lang: 'pt' },
    { url: 'https://ge.globo.com/rss/ge/futebol/times/palmeiras/', name: 'ge', lang: 'pt' },
    { url: 'https://nossopalestra.com.br/feed/', name: 'Nosso Palestra', lang: 'pt' },
    { url: 'https://www.gazetaesportiva.com/times/palmeiras/feed/', name: 'Gazeta Esportiva', lang: 'pt' },
    { url: 'https://www.lance.com.br/rss/palmeiras', name: 'Lance!', lang: 'pt' },
    { url: 'https://news.google.com/rss/search?q=Palmeiras&hl=pt-BR&gl=BR&ceid=BR:pt-419', name: 'Google Notícias', lang: 'pt', filter: SEP_RE, google: true }
  ]
};

async function get(url, ms, max) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: 'follow', headers: {
      'user-agent': 'Mozilla/5.0 (compatible; briefing-reader/1.0)',
      'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5' } });
    if (!r.ok) return { err: 'http ' + r.status };
    return { text: (await r.text()).slice(0, max) };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : String(e.message || e).slice(0, 80) }; }
  finally { clearTimeout(t); }
}

function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}
function tag(b, name) { const m = b.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i')); return m ? decode(m[1]).trim() : ''; }
function strip(s) { return decode(decode(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function okImg(u) { return /^https?:\/\//i.test(u) && !/\.(mp4|mp3|m3u8)(\?|$)/i.test(u) && !/gravatar|emoji|pixel|1x1|feedburner/i.test(u); }

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 30).map(b => {
    let link = tag(b, 'link'), m;
    if (!/^https?:/i.test(link)) { m = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i); link = m ? decode(m[1]) : ''; }
    let title = strip(tag(b, 'title')), source = feed.name;
    if (feed.google) { const sm = tag(b, 'source'); if (sm) { source = strip(sm); title = title.replace(new RegExp('\\s+-\\s+' + source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''); } }
    const ds = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const dt = ds ? new Date(ds) : null;
    let img = '';
    const cands = [];
    const re = /<(?:media:content|media:thumbnail|enclosure)[^>]*>/gi; let mm;
    while ((mm = re.exec(b))) { const u = mm[0].match(/url=["']([^"']+)["']/i); if (u && !/type=["'](?:video|audio)/i.test(mm[0])) cands.push(decode(u[1])); }
    const body = decode(tag(b, 'content:encoded') || tag(b, 'content') || '') + ' ' + decode(tag(b, 'description') || tag(b, 'summary') || '');
    const im = body.match(/<img[^>]+src=["']([^"']+)["']/i); if (im) cands.push(decode(im[1]));
    img = cands.find(okImg) || '';
    const summary = strip(tag(b, 'description') || tag(b, 'summary') || '').slice(0, 200);
    return { title, link: link.trim(), date: dt && !isNaN(dt) ? dt.toISOString() : null, image: img, source, lang: feed.lang, summary: feed.google ? '' : summary, noOg: !!feed.google };
  }).filter(i => i.title && /^https?:/i.test(i.link) && (!feed.filter || feed.filter.test(i.title + ' ' + i.summary)));
}

async function ogImage(item) {
  if (item.image || item.noOg) return;
  const r = await get(item.link, 3000, 200000);
  if (!r.text) return;
  const m = r.text.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
    || r.text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (m && okImg(decode(m[1]))) item.image = decode(m[1]);
}

async function section(key, want, debug) {
  const feeds = FEEDS[key];
  const res = await Promise.all(feeds.map(f => get(f.url, 4000, 600000)));
  const per = feeds.map((f, i) => { const items = res[i].text ? parseFeed(res[i].text, f) : []; if (debug) debug.push({ section: key, feed: f.name, ok: !!res[i].text, err: res[i].err || null, items: items.length, withImage: items.filter(x => x.image).length }); return items; });
  const now = Date.now();
  per.forEach(list => list.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  // rodízio entre veículos, português primeiro, só o que saiu nos últimos 5 dias
  const fresh = per.map(list => list.filter(i => !i.date || now - Date.parse(i.date) < 5 * 864e5));
  const order = feeds.map((f, i) => i).sort((a, b) => (feeds[a].lang === 'pt' ? 0 : 1) - (feeds[b].lang === 'pt' ? 0 : 1));
  const out = [], seen = new Set();
  for (let round = 0; out.length < want && round < 6; round++) {
    for (const i of order) {
      const it = fresh[i][round]; if (!it) continue;
      const k = it.title.toLowerCase().slice(0, 50); if (seen.has(k)) continue;
      seen.add(k); out.push(it); if (out.length >= want) break;
    }
  }
  await Promise.all(out.map(ogImage));
  return out.map(({ noOg, ...i }) => i);
}

function wx(code) { return code >= 95 ? 'tempestade' : code >= 51 ? 'chuva' : code >= 2 ? 'nuvem' : 'sol'; }
async function weather() {
  const q = 'https://api.open-meteo.com/v1/forecast?latitude=' + CITIES.map(c => c.lat).join(',') + '&longitude=' + CITIES.map(c => c.lon).join(',')
    + '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=7';
  const r = await get(q, 4000, 200000);
  if (!r.text) return null;
  try {
    const j = JSON.parse(r.text), arr = Array.isArray(j) ? j : [j];
    return arr.map((c, i) => ({
      city: CITIES[i].name, temp: Math.round(c.current.temperature_2m), icon: wx(c.current.weather_code),
      min: Math.round(c.daily.temperature_2m_min[0]), max: Math.round(c.daily.temperature_2m_max[0]), rain: c.daily.precipitation_probability_max[0],
      week: c.daily.time.map((d, k) => ({ date: d, icon: wx(c.daily.weather_code[k]), max: Math.round(c.daily.temperature_2m_max[k]), min: Math.round(c.daily.temperature_2m_min[k]), rain: c.daily.precipitation_probability_max[k] }))
    }));
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  const debug = /[?&]debug=1/.test(req.url || '') ? [] : null;
  const [w, ai, mkt, sep] = await Promise.all([weather(), section('ai', 5, debug), section('mkt', 4, debug), section('sep', 4, debug)]);
  const day = Math.floor((Date.now() - 3 * 36e5) / 864e5);
  const body = { generatedAt: new Date().toISOString(), weather: w, ai, mkt, sep, studio: STUDIO[day % STUDIO.length], radar: RADAR[day % RADAR.length] };
  if (debug) body.debug = debug;
  res.setHeader('Cache-Control', debug ? 'no-store' : 's-maxage=600, stale-while-revalidate=3600');
  res.status(200).json(body);
};
