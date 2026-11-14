// Quem pode usar a nave. Com ALLOWED_EMAIL configurado, só vale a sessão do Supabase Auth desse e-mail (login de verdade).
// Enquanto ALLOWED_EMAIL não existir, continua valendo o código de acesso antigo, para a troca não trancar ninguém do lado de fora.
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, seen = new Map();
const loginOn = () => !!String(process.env.ALLOWED_EMAIL || '').trim();
async function session(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || ''), want = String(process.env.ALLOWED_EMAIL || '').trim().toLowerCase();
  if (!m || !want || !SB || !SK) return false;
  const tk = m[1], hit = seen.get(tk); if (hit && hit > Date.now()) return true;
  try {
    const r = await fetch(SB + '/auth/v1/user', { headers: { apikey: SK, authorization: 'Bearer ' + tk } });
    if (!r.ok) return false;
    const u = await r.json(), ok = String(u.email || '').toLowerCase() === want && !!(u.email_confirmed_at || u.confirmed_at);
    if (ok) { if (seen.size > 40) seen.clear(); seen.set(tk, Date.now() + 60000); }
    return ok;
  } catch (e) { return false; }
}
async function allowed(req) {
  if (loginOn()) return session(req);
  const key = process.env.AION_KEY; return !!key && req.headers['x-aion-key'] === key;
}
module.exports = { allowed, loginOn };
