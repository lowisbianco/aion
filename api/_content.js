// Conteúdo de curadoria que roda em rodízio diário (um item por dia).
const STUDIO = [
  { title: 'Voz principal em cover acústico', why: 'A voz é o centro do arranjo: controle em dois estágios, sem esmagar.', chain: [
    ['FabFilter Pro-Q 3', 'Passa-alta em 80–90 Hz e corte suave de 2–3 dB entre 250 e 350 Hz.'],
    ['Waves CLA-76 ou UAD 1176', 'Ataque lento, release rápido, 3–4 dB só nos picos.'],
    ['Softube Tube-Tech CL 1B', 'Mais 2–3 dB para assentar a dinâmica.'],
    ['oeksound Soothe2', 'Entre 3 e 6 kHz, o mínimo para tirar a aspereza.'],
    ['FabFilter Pro-DS', 'De-esser depois da compressão, nunca antes.'],
    ['Valhalla VintageVerb', 'Plate em envio, pre-delay de 40–60 ms para a voz ficar na frente.'] ] },
  { title: 'Violão de aço que soa caro', why: 'O violão segura a harmonia e o ritmo: tire o embolado e dê ar, sem deixar a palhetada agredir.', chain: [
    ['FabFilter Pro-Q 3', 'Passa-alta em 90 Hz, corte de 2–4 dB em 200–250 Hz e uma banda dinâmica em 2,5–3,5 kHz para a palhetada.'],
    ['Waves CLA-2A ou UAD LA-2A', 'Só 2–3 dB de redução, para nivelar sem perder o ataque.'],
    ['Soundtoys Decapitator', 'Estilo A, drive baixo e mix em 15–20% para dar corpo.'],
    ['Maag EQ4', 'Air Band em 20 kHz, +2 dB, para o brilho de corda nova.'],
    ['Soundtoys MicroShift', 'Em envio, se for um violão só, para abrir o estéreo.'],
    ['Valhalla Room', 'Sala curta, 0,8 s, bem baixa na mixagem.'] ] },
  { title: 'Baixo firme em arranjo acústico', why: 'Sem bateria pesada, o baixo é o chão da música: precisa aparecer até em caixa pequena.', chain: [
    ['FabFilter Pro-Q 3', 'Passa-alta em 35–40 Hz e corte em 200–300 Hz se embolar com o violão.'],
    ['UAD 1176 ou Waves CLA-76', 'Ataque médio, 4–6 dB, para igualar as notas.'],
    ['Plugin Alliance Ampeg SVT-VR', 'Em paralelo, 20–30%, para os médios que fazem o baixo ser ouvido no celular.'],
    ['Waves R-Bass', 'Um toque de harmônicos em 70–80 Hz.'],
    ['FabFilter Pro-MB', 'Uma banda segurando 60–120 Hz nas notas que sobram.'],
    ['Wavesfactory Trackspacer', 'Sidechain do cajón ou bumbo, 2–3 dB, para os dois não brigarem.'] ] },
  { title: 'Cajón com peso de bumbo e estalo de caixa', why: 'Um instrumento fazendo o papel de dois: trate grave e estalo como coisas separadas.', chain: [
    ['FabFilter Pro-Q 3', 'Reforço em 60–80 Hz, corte de 3–5 dB em 300–400 Hz (som de caixa de papelão) e +3 dB em 4–5 kHz.'],
    ['SPL Transient Designer Plus', 'Attack +2 a +3, sustain −1, para o toque saltar.'],
    ['Waves dbx 160', '4:1, 3–4 dB, para o grave ficar constante.'],
    ['Soundtoys Decapitator', 'Em paralelo, estilo E, para densidade.'],
    ['Valhalla Plate', 'Curto, só no estalo agudo, via envio com passa-alta em 500 Hz.'],
    ['Waves Submarine', 'Sub-harmônico bem dosado, se faltar peso no grave.'] ] },
  { title: 'Bateria leve que não atropela a voz', why: 'Em cover acústico a bateria acompanha: mais sala e cola, menos ataque.', chain: [
    ['FabFilter Pro-Q 3', 'Nos overheads, passa-alta em 120 Hz e corte suave em 3–4 kHz.'],
    ['UAD SSL G Bus Compressor', 'No grupo, 4:1, ataque 30 ms, release auto, 2 dB.'],
    ['UAD Studer A800', 'Fita no grupo, para arredondar os transientes.'],
    ['oeksound Soothe2', 'Nos pratos, 6–10 kHz, só quando abrem demais.'],
    ['Soundtoys Devil-Loc', 'Paralelo em 10–15%, para energia sem subir o volume.'],
    ['Valhalla Room', 'Envio com 1,1 s e pre-delay de 20 ms, para colocar a bateria atrás da voz.'] ] },
  { title: 'Cola no mix bus sem achatar', why: 'O mix bus junta as peças: mexa pouco e sempre comparando com o volume igualado.', chain: [
    ['Waves SSL G-Master Buss Compressor', '2:1 ou 4:1, ataque 30 ms, release auto, 1–2 dB no máximo.'],
    ['UAD Pultec EQP-1A', '+1 dB em 60 Hz e +1,5 dB em 10–12 kHz.'],
    ['UAD Ampex ATR-102', 'Fita a 15 ips, para cola e um grave mais redondo.'],
    ['Plugin Alliance Black Box HG-2', 'Saturação leve; se perceber, passou do ponto.'],
    ['Soundtheory Gullfoss', 'Tame e Recover em 15–20%.'],
    ['Youlean Loudness Meter', 'Entregue com picos em −6 dBFS para a master.'] ] },
  { title: 'Master de cover acústico para streaming', why: 'Acústico pede dinâmica: mirar volume de pop mata o que a gravação tem de melhor.', chain: [
    ['FabFilter Pro-Q 3', 'Fase linear: passa-alta em 25 Hz e ajustes de no máximo 1 dB.'],
    ['FabFilter Pro-Q 3 em mid/side', 'Abra 8–12 kHz só nos lados, +1 dB.'],
    ['Tokyo Dawn Kotelnikov GE', '1–1,5 dB de redução, ataque lento.'],
    ['Sonnox Oxford Inflator', 'Effect em 20–30%, para densidade sem limitar.'],
    ['FabFilter Pro-L 2', 'Estilo Transparent, true peak em −1 dBTP, alvo de −14 a −12 LUFS integrado.'],
    ['Youlean Loudness Meter', 'Confira LUFS e true peak antes de exportar.'] ] },
  { title: 'Profundidade com dois reverbs', why: 'Três planos (frente, meio, fundo) com dois reverbs bem equalizados soam maiores que cinco reverbs soltos.', chain: [
    ['Valhalla VintageVerb', 'Plate para a voz: 1,6 s, pre-delay de 50 ms.'],
    ['Valhalla Room', 'Sala para os instrumentos: 0,9 s.'],
    ['FabFilter Pro-Q 3', 'Nos retornos: passa-alta em 300 Hz e passa-baixa em 7–8 kHz.'],
    ['Soundtoys EchoBoy', 'Slap mono de 90–120 ms na voz, bem baixo.'],
    ['FabFilter Pro-C 2', 'No retorno do reverb, sidechain da voz, 2–3 dB, para limpar entre as frases.'],
    ['Soundtoys Little Plate', 'Uma segunda cor só no refrão, automatizada.'] ] }
];

const RADAR = [
  { niche: 'Bandas e artistas independentes', idea: 'Painel único de lançamento: pré-save, anúncios, agenda de shows e relatório de quanto cada música rendeu.', why: 'Artista pequeno usa cinco ferramentas soltas e não sabe o que deu retorno.' },
  { niche: 'Estúdios de tatuagem', idea: 'Orçamento por foto de referência, agenda e sinal por Pix no mesmo link.', why: 'O atendimento hoje é todo manual pelo direct, e o sinal é a maior fonte de furo.' },
  { niche: 'Clínicas de estética', idea: 'Reativação de pacientes parados: o sistema lê o histórico e manda a oferta certa na hora certa.', why: 'Custa menos reativar um paciente do que comprar um lead novo.' },
  { niche: 'Imobiliárias pequenas', idea: 'Triagem de leads por voz: qualifica, responde dúvidas do imóvel e agenda a visita.', why: 'A maioria dos leads de portal esfria por demora no primeiro contato.' },
  { niche: 'Professores de música', idea: 'Plataforma de aulas com devolutiva automática do áudio do aluno: tempo, afinação e evolução.', why: 'O professor escala sem dar mais horas de aula.' },
  { niche: 'Lojas de bairro com Instagram', idea: 'Catálogo que vira pedido: da mensagem ao Pix, com estoque atualizado.', why: 'Vendem pelo direct e perdem pedido por falta de resposta rápida.' },
  { niche: 'Produtores musicais', idea: 'Assistente de sessão: organiza takes, guarda o recall da mix e gera o orçamento do projeto.', why: 'É a parte chata do trabalho, e ninguém resolveu bem para estúdio pequeno.' }
];

module.exports = { STUDIO, RADAR };
