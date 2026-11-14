// Entrega o id do agente de voz só para quem tem o código de acesso.
const { allowed } = require('./_auth');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.AION_KEY;
  if (!(await allowed(req))) return res.status(401).json({ locked: true });
  return res.status(200).json({ agentId: process.env.AION_AGENT_ID || null });
};
