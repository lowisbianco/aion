// Trava contra memórias duplicadas: a gravação às vezes é chamada duas vezes seguidas (a ferramenta responde
// "in_progress" antes de confirmar). Antes de gravar, compara com as memórias recentes; igual ou quase igual
// (mesmo tipo e texto muito parecido) nos últimos minutos não grava de novo.
const WINDOW_MS = 30 * 60 * 1000, LIMIAR = 0.9;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const grams = s => { const t = ' ' + s + ' ', g = new Map(); for (let i = 0; i < t.length - 2; i++) { const k = t.slice(i, i + 3); g.set(k, (g.get(k) || 0) + 1); } return g; };
function parecido(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0; if (a === b) return 1;
  const A = grams(a), B = grams(b); let inter = 0, na = 0, nb = 0;
  A.forEach(v => { na += v; }); B.forEach(v => { nb += v; });
  A.forEach((v, k) => { if (B.has(k)) inter += Math.min(v, B.get(k)); });
  return (2 * inter) / (na + nb);
}
// items: saída de aion_recall ({id, created_at, kind, content}); devolve a memória já existente ou null
function duplicata(items, kind, content, agora = Date.now()) {
  const k = norm(kind || 'fato');
  return (items || []).find(m => agora - new Date(m.created_at).getTime() <= WINDOW_MS && norm(m.kind || 'fato') === k && parecido(m.content, content) >= LIMIAR) || null;
}
module.exports = { duplicata, parecido };
