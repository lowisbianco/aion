// Briefing ao vivo: clima (Open-Meteo), notícias (RSS dos veículos) e curadoria do dia.
const { STUDIO, RADAR } = require('./_content.js');

const CITIES = [
  { name: 'Santo André', lat: -23.6639, lon: -46.5383 }
];

const AI_RE = /\bIA\b|\bAI\b|intelig[êe]ncia artificial|artificial intelligence|openai|chatgpt|gemini|claude|anthropic|\bllm\b|deepmind|copilot|agentes? de ia|machine learning|\bgpt/i;
const SEP_RE = /palmeiras|verd[ãa]o|alviverde|abel ferreira|allianz parque/i;

const FEEDS = {
  ai: [
    { url: 'https://olhardigital.com.br/tag/inteligencia-artificial/feed/', name: 'Olhar Digital', lang: 'pt' },
    { url: 'https://canaltech.com.br/rss/inteligencia-artificial/', name: 'Canaltech', lang: 'pt' },
    { url: 'https://tecnoblog.net/feed/', name: 'Tecnoblog', lang: 'pt', filter: AI_RE },
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', lang: 'en' },
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', lang: 'en' }
  ],
  mkt: [
    { url: 'https://www.meioemensagem.com.br/feed', name: 'Meio & Mensagem', lang: 'pt' },
    { url: 'https://www.b9.com.br/feed/', name: 'B9', lang: 'pt' },
    { url: 'https://rockcontent.com/br/blog/feed/', name: 'Rock Content', lang: 'pt' },
    { url: 'https://www.socialmediatoday.com/feeds/news/', name: 'Social Media Today', lang: 'en' },
    { url: 'https://www.jonloomer.com/feed/', name: 'Jon Loomer', lang: 'en' }
  ],
  sep: [
    { url: 'https://www.palmeiras.com.br/feed/', name: 'Palmeiras (oficial)', lang: 'pt' },
    { url: 'https://ge.globo.com/rss/ge/futebol/times/palmeiras/', name: 'ge', lang: 'pt' },
    { url: 'https://nossopalestra.com.br/feed/', name: 'Nosso Palestra', lang: 'pt' },
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
    const summary = strip(tag(b, 'description') || tag(b, 'summary') || '').split(/\s(?:O post|The post)\s/)[0].slice(0, 200);
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
  for (let pass = 0; pass < 2 && out.length < want; pass++) for (let round = 0; out.length < want && round < 6; round++) {
    for (const i of order) {
      if (!!feeds[i].google !== (pass === 1)) continue;
      const it = fresh[i][round]; if (!it) continue;
      const k = it.title.toLowerCase().slice(0, 50); if (seen.has(k)) continue;
      seen.add(k); out.push(it); if (out.length >= want) break;
    }
  }
  await Promise.all(out.map(ogImage));
  return out.map(({ noOg, ...i }) => i);
}

function wx(code) { return code >= 95 ? 'tempestade' : code >= 51 ? 'chuva' : code >= 2 ? 'nuvem' : 'sol'; }
const WXDESC = c => c >= 95 ? 'tempestade' : c >= 80 ? 'pancadas de chuva' : c >= 61 ? 'chuva' : c >= 51 ? 'garoa' : c >= 45 ? 'neblina' : c >= 3 ? 'nublado' : c >= 2 ? 'parcialmente nublado' : c >= 1 ? 'poucas nuvens' : 'céu limpo';
// clima detalhado de Santo André: agora, próximas horas e a semana
async function weather() {
  const c0 = CITIES[0];
  const q = 'https://api.open-meteo.com/v1/forecast?latitude=' + c0.lat + '&longitude=' + c0.lon
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code'
    + '&hourly=temperature_2m,precipitation_probability,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max'
    + '&timezone=America%2FSao_Paulo&forecast_days=7';
  const r = await get(q, 4000, 400000);
  if (!r.text) return null;
  try {
    const c = JSON.parse(r.text), now = c.current.time.slice(0, 13), h0 = Math.max(0, c.hourly.time.findIndex(t => t.slice(0, 13) === now));
    const hm = t => String(t || '').slice(11, 16);
    return [{
      city: c0.name, temp: Math.round(c.current.temperature_2m), icon: wx(c.current.weather_code), desc: WXDESC(c.current.weather_code),
      feels: Math.round(c.current.apparent_temperature), humidity: Math.round(c.current.relative_humidity_2m), wind: Math.round(c.current.wind_speed_10m),
      min: Math.round(c.daily.temperature_2m_min[0]), max: Math.round(c.daily.temperature_2m_max[0]), rain: c.daily.precipitation_probability_max[0],
      rainMm: Math.round((c.daily.precipitation_sum[0] || 0) * 10) / 10, uv: Math.round(c.daily.uv_index_max[0] || 0), sunrise: hm(c.daily.sunrise[0]), sunset: hm(c.daily.sunset[0]),
      hours: c.hourly.time.slice(h0, h0 + 12).map((t, k) => ({ h: hm(t), temp: Math.round(c.hourly.temperature_2m[h0 + k]), rain: c.hourly.precipitation_probability[h0 + k], icon: wx(c.hourly.weather_code[h0 + k]) })),
      week: c.daily.time.map((d, k) => ({ date: d, icon: wx(c.daily.weather_code[k]), max: Math.round(c.daily.temperature_2m_max[k]), min: Math.round(c.daily.temperature_2m_min[k]), rain: c.daily.precipitation_probability_max[k] }))
    }];
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  // módulos diários da tela de produção: ?mod=ia | ?mod=mix
  const mod = (/[?&]mod=(ia|mix)\b/.exec(req.url || '') || [])[1];
  if (mod) {
    let extra = '';
    if (mod === 'ia') { const n = await section('ai', 8, null).catch(() => []); extra = (n || []).map(x => '- ' + x.title + ' (' + x.source + ')').join('\n'); }
    const out = await require('./_daily').daily(mod, extra);
    res.setHeader('Cache-Control', out.error || out.pending ? 'no-store' : 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json(out);
  }
  const debug = /[?&]debug=1/.test(req.url || '') ? [] : null;
  const [w, ai, mkt, sep] = await Promise.all([weather(), section('ai', 5, debug), section('mkt', 4, debug), section('sep', 4, debug)]);
  const day = Math.floor((Date.now() - 3 * 36e5) / 864e5);
  const body = { generatedAt: new Date().toISOString(), weather: w, ai, mkt, sep, studio: STUDIO[day % STUDIO.length], radar: RADAR[day % RADAR.length] };
  if (debug) body.debug = debug;
  res.setHeader('Cache-Control', debug ? 'no-store' : 's-maxage=600, stale-while-revalidate=3600');
  res.status(200).json(body);
};
