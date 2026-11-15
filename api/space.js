// Destinos reais para a viagem da nave: sistemas com planetas confirmados, do mais perto ao mais longe (NASA Exoplanet Archive).
// Dados públicos, sem chave; a resposta fica em cache por um dia para não repetir a consulta a cada clique.
let cache = { at: 0, list: null };
const PC_LY = 3.26156; // 1 parsec em anos-luz
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (cache.list && Date.now() - cache.at < 24 * 3600 * 1000) return res.status(200).json({ destinos: cache.list, fonte: 'NASA Exoplanet Archive' });
  try {
    const q = 'select hostname, sy_dist, ra, dec, sy_pnum from pscomppars where sy_dist is not null and sy_dist < 80 order by sy_dist';
    const r = await fetch('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=json&query=' + encodeURIComponent(q), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('nasa ' + r.status);
    const rows = await r.json(), seen = new Set(), list = [];
    for (const x of rows) {
      if (!x.hostname || seen.has(x.hostname) || !(x.sy_dist > 0)) continue; seen.add(x.hostname);
      list.push({ nome: x.hostname, anosLuz: Math.round(x.sy_dist * PC_LY * 10) / 10, ra: x.ra, dec: x.dec, planetas: x.sy_pnum || 0 });
      if (list.length >= 40) break;
    }
    cache = { at: Date.now(), list };
    return res.status(200).json({ destinos: list, fonte: 'NASA Exoplanet Archive' });
  } catch (e) { return res.status(502).json({ error: 'space-data', detail: String(e.message || e).slice(0, 120) }); }
};
