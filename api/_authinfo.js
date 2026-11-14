// Diz à nave se o login está ligado e se este aparelho já está com a sessão do Lowis.
const { allowed, loginOn } = require('./_auth');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ login: loginOn(), ok: loginOn() ? await allowed(req) : false });
};
