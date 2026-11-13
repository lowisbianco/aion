// Números dos anúncios: só responde com o código de acesso correto.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY;
  if (!key || req.headers['x-aion-key'] !== key) return res.status(401).json({ locked: true });
  try { return res.status(200).json(JSON.parse(process.env.VELT_SNAPSHOT || 'null') || { empty: true }); }
  catch (e) { return res.status(200).json({ empty: true }); }
};
