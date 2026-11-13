# AION

Briefing diário pessoal com voz, numa ponte de comando de nave.

## Como funciona

- `index.html`: a ponte em 3D (Three.js), os painéis e a narração.
- `api/briefing.js`: clima (Open-Meteo) e notícias (RSS dos veículos, com imagem), ao vivo.
- `api/velt.js`: números de anúncios, liberados só com o código de acesso.
- `api/tts.js`: voz pela ElevenLabs, também atrás do código de acesso.
- `api/agent.js`: entrega o id do agente de voz (ElevenLabs Agents), atrás do código de acesso.
- `vendor/elevenlabs-client.js`: SDK da ElevenLabs empacotado (`@elevenlabs/client` 1.36.1).
- `api/_content.js`: dica de estúdio e radar de nichos, em rodízio diário.

## Variáveis de ambiente (Vercel)

- `AION_KEY`: código de acesso.
- `VELT_SNAPSHOT`: JSON com os números dos anúncios.
- `AION_AGENT_ID`: id do agente de voz.
- `ELEVENLABS_API_KEY`: chave da ElevenLabs (opcional; sem ela a voz é a do navegador).
- `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`: opcionais.

Nenhum dado privado fica no repositório.
