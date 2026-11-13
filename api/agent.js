// Entrega o id do agente de voz só para quem tem o código de acesso.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY;
  if (!key || req.headers['x-aion-key'] !== key) return res.status(401).json({ locked: true });
  return res.status(200).json({ agentId: process.env.AION_AGENT_ID || null });
};
