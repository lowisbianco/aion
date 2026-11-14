# AION

Briefing diário pessoal com voz, numa ponte de comando de nave.

## Como funciona

- `index.html`: o Observatório Vivo em 3D (Three.js): o AION com rosto e gestos, quatro cenários, modos de iluminação, cartões por aba, microfone central e a narração.
- `api/briefing.js`: clima (Open-Meteo) e notícias (RSS dos veículos, com imagem), ao vivo.
- `api/velt.js`: números de anúncios, liberados só com o código de acesso.
- `api/tts.js`: voz pela ElevenLabs, também atrás do código de acesso.
- `api/agent.js`: entrega o id do agente de voz (ElevenLabs Agents), atrás do código de acesso.
- `vendor/elevenlabs-client.js`: SDK da ElevenLabs empacotado (`@elevenlabs/client` 1.36.1).
- `api/inbox.js`, `api/whats.js`: caixa de avisos, fila de tarefas e ligação com a ponte do WhatsApp.
- `whatsapp/`: ponte do WhatsApp (serviço Node separado, roda no Railway com Root Directory `whatsapp`, volume em `/data` e as variáveis `WA_KEY` e `AION_URL`).
- `api/_auth.js`, `api/auth.js`: login. Com `ALLOWED_EMAIL` definido, as rotas só aceitam a sessão do Supabase Auth desse e-mail; sem ele, vale o código de acesso antigo.
- `api/see.js`: visão. Descreve imagens e quadros de vídeo com o Claude para o agente de voz.
- `api/_content.js`: dica de estúdio e radar de nichos, em rodízio diário.
- `api/brain.js`: o cérebro. Copia cada conversa encerrada (falas e resumo) da ElevenLabs para o banco, devolve os resumos recentes e o ponto onde a última parou, e faz busca no histórico (`?q=`).
- `api/voices.js`: vozes da ElevenLabs (da conta e da biblioteca em português) para escolher no menu.
- `api/make.js`: gera áudio para baixar (narração, efeito sonoro, música).
- `api/transcribe.js`: transcreve áudio e o som de vídeos enviados à nave (a nave corta em trechos de 100 s).

## Variáveis de ambiente (Vercel)

- `AION_KEY`: código de acesso.
- `VELT_SNAPSHOT`: JSON com os números dos anúncios.
- `AION_AGENT_ID`: id do agente de voz.
- `ELEVENLABS_API_KEY`: chave da ElevenLabs (opcional; sem ela a voz é a do navegador).
- `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`: opcionais.
- `ALLOWED_EMAIL`: e-mail único com acesso. Definir esta variável liga o login e desliga o código de acesso.
- `ANTHROPIC_API_KEY`: liga a visão (opcional). `AION_VISION_MODEL` troca o modelo.

Nenhum dado privado fica no repositório.
