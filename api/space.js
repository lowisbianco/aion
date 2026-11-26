// Destinos reais para a viagem da nave: sistemas com planetas confirmados, do mais perto ao mais longe (NASA Exoplanet Archive),
// com os dados da estrela e de cada planeta. Dados públicos, sem chave; a resposta fica em cache por um dia.
let cache = { at: 0, list: null };
const PC_LY = 3.26156; // 1 parsec em anos-luz
const n = (v, d) => (v == null || v === '' || isNaN(v)) ? null : Math.round(Number(v) * Math.pow(10, d)) / Math.pow(10, d);
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (cache.list && Date.now() - cache.at < 24 * 3600 * 1000) return res.status(200).json({ destinos: cache.list, fonte: 'NASA Exoplanet Archive' });
  try {
    const q = 'select hostname, sy_dist, ra, dec, sy_pnum, sy_snum, st_spectype, st_teff, st_rad, st_mass, st_age, pl_name, pl_letter, pl_orbper, pl_orbsmax, pl_rade, pl_bmasse, pl_eqt, discoverymethod, disc_year from pscomppars where sy_dist is not null and sy_dist < 80 order by sy_dist';
    const r = await fetch('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=json&query=' + encodeURIComponent(q), { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('nasa ' + r.status);
    const rows = await r.json(), by = new Map();
    for (const x of rows) {
      if (!x.hostname || !(x.sy_dist > 0)) continue;
      let s = by.get(x.hostname);
      if (!s) {
        if (by.size >= 40) continue;
        s = { nome: x.hostname, anosLuz: n(x.sy_dist * PC_LY, 1), ra: x.ra, dec: x.dec, planetas: x.sy_pnum || 0, estrelas: x.sy_snum || 1,
          estrela: { tipo: x.st_spectype || null, temp: n(x.st_teff, 0), raio: n(x.st_rad, 3), massa: n(x.st_mass, 3), idade: n(x.st_age, 2) }, lista: [] };
        by.set(x.hostname, s);
      }
      s.lista.push({ nome: x.pl_name, letra: x.pl_letter, periodo: n(x.pl_orbper, 2), dist: n(x.pl_orbsmax, 4), raio: n(x.pl_rade, 2), massa: n(x.pl_bmasse, 2), temp: n(x.pl_eqt, 0), metodo: x.discoverymethod, ano: x.disc_year });
    }
    const list = [...by.values()].map(s => (s.lista.sort((a, b) => (a.dist || a.periodo || 0) - (b.dist || b.periodo || 0)), s));
    cache = { at: Date.now(), list };
    return res.status(200).json({ destinos: list, fonte: 'NASA Exoplanet Archive' });
  } catch (e) { return res.status(502).json({ error: 'space-data', detail: String(e.message || e).slice(0, 120) }); }
};
