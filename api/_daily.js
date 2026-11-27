// Módulos diários da tela de produção (gerados uma vez por dia e guardados no banco):
//  ia  — dicas avançadas de IA (Claude, Claude Code, ChatGPT, Higgsfield, ElevenLabs, Flow e IAs novas), prompts prontos e oportunidades reais
//  mix — mixagem e masterização avançadas para a VELT no Ableton Live (tema do dia em rodízio), rack pronto e construção de plugins
const SB = process.env.SUPABASE_URL, SK = process.env.SUPABASE_KEY, MK = process.env.AION_MEM_KEY;
async function rpc(fn, args) {
  const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ p_key: MK }, args)) });
  const t = await r.text(); if (!r.ok) throw new Error('db ' + r.status); return t ? JSON.parse(t) : null;
}
const today = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10); // dia em Brasília
const dayN = () => Math.floor((Date.now() - 3 * 36e5) / 864e5);

const MIX_TEMAS = [
  'violões de aço e nylon gravados em home studio (captação, limpeza, timbre e espaço na mix acústica da VELT)',
  'baixo elétrico gravado em linha e/ou amp (relação kick/baixo, saturação, compressão paralela, mono abaixo de 120 Hz)',
  'voz principal (cadeia completa: limpeza, de-esser, compressão em série, saturação, automação e espaço)',
  'backing vocals e dobras de 2 a 4 vozes (afinação, alinhamento, bus de vozes, largura estéreo sem mascarar a principal)',
  'bateria programada no Ableton (samples, humanização de MIDI, groove pool, layering de kick e caixa, bus de bateria)',
  'percussão gravada (cajón, shaker, pandeiro, congas): transientes, espaço, panorâmica e encaixe com a bateria programada',
  'mixagem por grupos no Ableton (bus de violões, vozes, ritmo): cola, saturação de bus e balanço de grupos',
  'canais de retorno do Ableton (reverbs de sala/plate/hall, delays sincronizados, pré-delay em ms pelo BPM, EQ nos retornos)',
  'racks de mix no Ableton (Audio Effect Rack com macros, cadeias paralelas, Chain Selector para variações A/B)',
  'masterização (rack de master para streaming −14 LUFS e para show ao vivo, true peak, inter-sample, mid/side)',
  'construção de plugins próprios (Max for Live, JUCE, DSP: filtros biquad, compressor, saturação; matemática e passos)',
  'mix ao vivo e playback da VELT (stems para o show, ganho de sistema, retorno in-ear, rack de show no Ableton)'
];

function prompts(mod, extra) {
  if (mod === 'ia') return {
    sys: 'Você é o radar de IA do Lowis (produtor musical, criador do AION, usa Claude Code todo dia). Responda só JSON válido em português do Brasil, sem markdown. Nada genérico: dicas avançadas, específicas, testáveis hoje. Não invente versões, preços ou recursos que você não tem certeza; quando algo for novo ou incerto, diga "verificar".',
    user: 'Data: ' + today() + '. Manchetes recentes de IA (use para trazer o que é novo):\n' + (extra || '(sem manchetes)') + '\n\n'
      + 'Monte o painel diário em JSON com este formato exato:\n'
      + '{"titulo":"frase curta do dia","ferramentas":[{"ia":"Claude|Claude Code|ChatGPT|Higgsfield|ElevenLabs|Flow","dica":"dica avançada e concreta (2 a 3 frases)","atalho":"comando, configuração ou fluxo exato quando houver"}],'
      + '"prompts":[{"titulo":"nome","para":"onde usar","prompt":"prompt completo, profissional e pronto para colar"}],'
      + '"oportunidades":[{"titulo":"produto ou sistema","dor":"problema real e quem paga","validacao":"sinal de demanda já comprovado (mercado existente, concorrentes faturando, busca)","claude_code":"como construir com Claude Code em passos curtos","primeiro_passo":"o que fazer hoje em até 1 hora"}],'
      + '"novas_ias":[{"nome":"ferramenta","acesso":"grátis | teste grátis | pago","uso":"para que serve e um truque"}]}\n'
      + 'Quantidades: ferramentas 6 (uma para cada IA da lista), prompts 3, oportunidades 3 (priorize oportunidades já validadas e construíveis por uma pessoa com Claude Code: sistemas, automações, apps, sites, micro-SaaS), novas_ias 2 a 3.'
  };
  const tema = MIX_TEMAS[dayN() % MIX_TEMAS.length];
  return {
    tema,
    sys: 'Você é engenheiro de mixagem e masterização sênior e desenvolvedor de DSP. Atende o Lowis, produtor da VELT (banda de releituras dos anos 70 a 2000: violões, baixo, voz principal, backing vocals, percussão gravados em home studio; bateria criada no Ableton). Ele usa Ableton Live e já criou plugins próprios. Responda só JSON válido em português do Brasil, sem markdown. Nada genérico: valores concretos (Hz, dB, ms, razão, attack/release, LUFS), por que de cada ajuste, alternativas de plugins conhecidos (FabFilter, Waves, UAD, Soundtoys, iZotope, Valhalla, nativos do Ableton) e a matemática quando ajudar.',
    user: 'Data: ' + today() + '. Tema do dia: ' + tema + '.\nMonte o painel em JSON com este formato exato:\n'
      + '{"titulo":"título do dia","resumo":"2 frases sobre o objetivo sonoro","dicas":[{"titulo":"nome","porque":"o problema que resolve","como":["passo com valores exatos","..."],"plugins":"opções nativas do Ableton e de terceiros"}],'
      + '"rack":{"nome":"nome do rack no Ableton","onde":"canal, grupo, retorno ou master","cadeia":[{"plugin":"nome","ajustes":"valores"}],"macros":["macro 1: o que controla e faixa"]},'
      + '"matematica":"uma conta útil do tema (ex.: pré-delay pelo BPM, frequência de corte, ganho em dB, tempo de release pelo andamento) com exemplo numérico",'
      + '"plugin":{"ideia":"plugin próprio que resolveria algo deste tema","passos":["passos de construção em Max for Live ou JUCE, com o algoritmo DSP"]}}\n'
      + 'Quantidades: dicas 4, cadeia do rack 4 a 7 plugins, macros 3 a 6, passos do plugin 4 a 6.'
  };
}

async function generate(mod, extra, gw) {
  if (!gw) throw new Error('sem acesso ao AI Gateway');
  const p = prompts(mod, extra);
  const models = [process.env.AION_DAILY_MODEL || 'anthropic/claude-opus-5', 'anthropic/claude-sonnet-4.5'];
  let last;
  for (const model of models) {
    try {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST',
        headers: { authorization: 'Bearer ' + gw, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 5000, temperature: .7, messages: [{ role: 'system', content: p.sys }, { role: 'user', content: p.user }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || 'gateway ' + r.status);
      const txt = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
      const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
      const data = JSON.parse(txt.slice(a, b + 1));
      if (p.tema) data.tema = p.tema;
      return data;
    } catch (e) { last = e; }
  }
  throw last;
}

// devolve o conteúdo do dia; gera na primeira chamada do dia (com trava para não gerar duas vezes)
async function daily(mod, extra, gw) {
  const name = 'daily_' + mod, day = today();
  let cur = null; try { cur = await rpc('aion_kv_get', { p_name: name }); } catch (e) {}
  if (cur && cur.day === day && cur.data) return Object.assign({ day }, cur.data);
  if (cur && cur.day === day && cur.lock && Date.now() - cur.lock < 120000) return cur.prev ? Object.assign({ day: cur.prevDay, stale: true }, cur.prev) : { day, pending: true };
  const prev = cur && cur.data ? cur.data : cur && cur.prev, prevDay = cur && (cur.data ? cur.day : cur.prevDay);
  try { await rpc('aion_kv_set', { p_name: name, p_value: { day, lock: Date.now(), prev, prevDay } }); } catch (e) {}
  try {
    const data = await generate(mod, extra, gw);
    await rpc('aion_kv_set', { p_name: name, p_value: { day, data } }).catch(() => {});
    return Object.assign({ day }, data);
  } catch (e) {
    await rpc('aion_kv_set', { p_name: name, p_value: { day: prevDay || '', data: prev || null } }).catch(() => {});
    if (prev) return Object.assign({ day: prevDay, stale: true }, prev);
    return { day, error: String(e.message || e).slice(0, 160) };
  }
}
module.exports = { daily };
