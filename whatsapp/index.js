// Ponte do WhatsApp do AION: fica conectada como "aparelho conectado" do WhatsApp do Lowis,
// encaminha as mensagens recebidas para a caixa de avisos da nave e envia mensagens a pedido do AION.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';

const KEY = process.env.WA_KEY || '';
const AION = (process.env.AION_URL || '').replace(/\/$/, '');
const DIR = process.env.DATA_DIR || '/data';
const GROUPS = process.env.WA_GROUPS === '1';
const PORT = process.env.PORT || 3000;
if (!KEY) console.error('Falta a variável WA_KEY.');
fs.mkdirSync(path.join(DIR, 'auth'), { recursive: true });

const log = pino({ level: 'warn' });
const CONTACTS_FILE = path.join(DIR, 'contacts.json');
let contacts = {};
try { contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')); } catch (e) {}
let saveT = null;
const remember = (jid, name) => {
  if (!jid || !name || jid.endsWith('@g.us') || jid === 'status@broadcast' || contacts[jid] === name) return;
  contacts[jid] = name; clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts), () => {}), 2000);
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let sock = null, qr = null, connected = false, me = '', startedAt = Date.now();

function textOf(m) {
  const x = m.message || {}; const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x;
  return inner.conversation || inner.extendedTextMessage?.text || inner.imageMessage?.caption && '[foto] ' + inner.imageMessage.caption || inner.videoMessage?.caption && '[vídeo] ' + inner.videoMessage.caption
    || (inner.imageMessage ? '[foto]' : inner.videoMessage ? '[vídeo]' : inner.audioMessage ? '[áudio]' : inner.documentMessage ? '[documento] ' + (inner.documentMessage.fileName || '') : inner.stickerMessage ? '[figurinha]' : inner.locationMessage ? '[localização]' : inner.contactMessage ? '[contato]' : '');
}

async function forward(payload) {
  if (!AION) return;
  try { await fetch(AION + '/api/whats', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aion-wa': KEY }, body: JSON.stringify(payload) }); }
  catch (e) { console.error('Falha ao avisar a nave:', e.message); }
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DIR, 'auth'));
  let version; try { ({ version } = await fetchLatestBaileysVersion()); } catch (e) {}
  sock = makeWASocket({ auth: state, version, logger: log, browser: Browsers.appropriate('AION'), syncFullHistory: false, markOnlineOnConnect: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', u => {
    if (u.qr) { qr = u.qr; console.log('QR code pronto: abra /qr?k=SUA_CHAVE para escanear.'); }
    if (u.connection === 'open') { connected = true; qr = null; me = sock.user?.id || ''; console.log('WhatsApp conectado.'); }
    if (u.connection === 'close') {
      connected = false;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) { console.log('Sessão encerrada no celular. Limpando e gerando novo QR.'); fs.rmSync(path.join(DIR, 'auth'), { recursive: true, force: true }); fs.mkdirSync(path.join(DIR, 'auth'), { recursive: true }); }
      setTimeout(() => connect().catch(e => console.error('Erro ao reconectar:', e.message)), 3000);
    }
  });
  sock.ev.on('contacts.upsert', list => { for (const c of list || []) remember(c.id, c.name || c.notify || c.verifiedName); });
  sock.ev.on('messaging-history.set', h => { for (const c of h?.contacts || []) remember(c.id, c.name || c.notify || c.verifiedName); });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages || []) {
      const jid = m.key?.remoteJid || '';
      if (!jid || jid === 'status@broadcast' || m.key.fromMe) continue;
      const group = jid.endsWith('@g.us'); if (group && !GROUPS) continue;
      if ((Number(m.messageTimestamp) || 0) * 1000 < startedAt - 60000) continue;
      const text = textOf(m); if (!text) continue;
      const name = m.pushName || contacts[jid] || jid.split('@')[0];
      if (!group) remember(jid, m.pushName);
      await forward({ de: name, texto: String(text).slice(0, 1200), grupo: group });
    }
  });
}

function resolve(to) {
  const digits = String(to).replace(/\D/g, '');
  if (digits.length >= 10 && digits.length === String(to).replace(/[\s()+-]/g, '').length) return { jid: (digits.length <= 11 ? '55' + digits : digits) + '@s.whatsapp.net' };
  const q = norm(to), all = Object.entries(contacts).map(([jid, name]) => ({ jid, name, n: norm(name) }));
  let hit = all.filter(c => c.n === q); if (!hit.length) hit = all.filter(c => c.n.startsWith(q)); if (!hit.length) hit = all.filter(c => c.n.includes(q));
  if (hit.length === 1) return { jid: hit[0].jid, name: hit[0].name };
  if (!hit.length) return { error: 'Não encontrei nenhum contato chamado "' + to + '". Só conheço quem já mandou mensagem desde que a ponte foi ligada, ou use o número com DDD.' };
  return { error: 'Há mais de um contato parecido: ' + hit.slice(0, 6).map(c => c.name).join(', ') + '. Peça ao Lowis para dizer qual.' };
}

const send = (res, code, body, type) => { res.writeHead(code, { 'content-type': type || 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), auth = KEY && (req.headers['x-aion-wa'] === KEY || url.searchParams.get('k') === KEY);
  if (url.pathname === '/') return send(res, 200, { ok: true, connected });
  if (!auth) return send(res, 401, { error: 'locked' });
  if (url.pathname === '/qr') {
    if (connected) return send(res, 200, '<meta charset="utf-8"><body style="font:18px system-ui;background:#03050c;color:#e8f5ff;display:grid;place-items:center;height:100vh;margin:0"><p>WhatsApp conectado ao AION. Pode fechar esta página.</p>', 'text/html; charset=utf-8');
    if (!qr) return send(res, 200, '<meta charset="utf-8"><meta http-equiv="refresh" content="3"><body style="font:18px system-ui;background:#03050c;color:#e8f5ff;display:grid;place-items:center;height:100vh;margin:0"><p>Gerando o QR code…</p>', 'text/html; charset=utf-8');
    const img = await QRCode.toDataURL(qr, { margin: 2, width: 360 });
    return send(res, 200, '<meta charset="utf-8"><meta http-equiv="refresh" content="15"><body style="font:16px system-ui;background:#03050c;color:#e8f5ff;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><img alt="QR code" src="' + img + '" style="border-radius:12px"><p>No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.</p></div>', 'text/html; charset=utf-8');
  }
  if (url.pathname === '/send' && req.method === 'POST') {
    let raw = ''; for await (const c of req) raw += c;
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) {}
    const text = String(b.mensagem || b.text || '').trim(), to = String(b.contato || b.to || '').trim();
    if (!text || !to) return send(res, 400, { error: 'Faltou o contato ou a mensagem.' });
    if (!connected) return send(res, 503, { error: 'O WhatsApp não está conectado agora.' });
    const r = resolve(to); if (r.error) return send(res, 404, { error: r.error });
    try { await sock.sendMessage(r.jid, { text: text.slice(0, 3000) }); return send(res, 200, { ok: true, enviado_para: r.name || to }); }
    catch (e) { return send(res, 502, { error: 'Falha ao enviar: ' + String(e.message || e).slice(0, 120) }); }
  }
  if (url.pathname === '/contacts') return send(res, 200, { total: Object.keys(contacts).length, nomes: Object.values(contacts).slice(0, 300) });
  return send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('Ponte do AION ouvindo na porta ' + PORT));

connect().catch(e => console.error('Erro ao iniciar o WhatsApp:', e.message));
