// Ponto único das rotas de áudio (voz, vozes, arquivos de áudio, transcrição): o plano Hobby da Vercel limita o número de funções.
const H = { tts: require('./_tts'), make: require('./_make'), voices: require('./_voices'), transcribe: require('./_transcribe') };
module.exports = (req, res) => {
  const a = new URL(req.url, 'http://x').searchParams.get('a');
  return H[a] ? H[a](req, res) : res.status(404).json({ error: 'unknown' });
};
