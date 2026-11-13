// Ponte do WhatsApp do AION: fica conectada como "aparelho conectado" do WhatsApp do Lowis,
// encaminha as mensagens recebidas para a caixa de avisos da nave e envia mensagens a pedido do AION.
import http from 'node:http';
import zlib from 'node:zlib';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';

const KEY = process.env.WA_KEY || '';
const AION = (process.env.AION_URL || '').replace(/\/$/, '');
let DIR = process.env.DATA_DIR || '/data';
const GROUPS = process.env.WA_GROUPS !== '0';
const PORT = process.env.PORT || 3000;
if (!KEY) console.error('Falta a variável WA_KEY.');
try { fs.mkdirSync(path.join(DIR, 'auth'), { recursive: true }); } catch (e) { DIR = path.join(os.tmpdir(), 'aion-wa'); fs.mkdirSync(path.join(DIR, 'auth'), { recursive: true }); }

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

// Conversas ativas (texto apenas, sem fotos de perfil), espelhadas no painel da nave.
let chats = {}, groupNames = {}, chatsT = null, chatsDirty = false;
const MAXMSG = 20, MAXCHATS = 40;
const isGroup = jid => String(jid).endsWith('@g.us');
const okJid = jid => jid && jid !== 'status@broadcast' && !String(jid).endsWith('@newsletter') && !String(jid).endsWith('@broadcast');
function chatName(jid, fallback) { return isGroup(jid) ? (groupNames[jid] || chats[jid]?.name || fallback || 'Grupo') : (contacts[jid] || chats[jid]?.name || fallback || '+' + String(jid).split('@')[0]); }
function touch(jid, patch) {
  if (!okJid(jid) || (isGroup(jid) && !GROUPS)) return null;
  const c = chats[jid] || (chats[jid] = { jid, name: '', group: isGroup(jid), t: 0, unread: 0, msgs: [] });
  Object.assign(c, patch || {}); c.name = chatName(jid, c.name); chatsDirty = true; scheduleChats(); return c;
}
function addMsg(jid, msg) {
  const c = touch(jid); if (!c) return;
  if (msg.id && c.msgs.some(x => x.id === msg.id)) return;
  c.msgs.push(msg); c.msgs.sort((a, b) => a.t - b.t); if (c.msgs.length > MAXMSG) c.msgs = c.msgs.slice(-MAXMSG);
  if (msg.t > c.t) c.t = msg.t; if (!msg.me && msg.t * 1000 > startedAt - 60000) c.unread = (c.unread || 0) + 1; if (msg.me) c.unread = 0;
}
function chatsSnapshot() {
  return Object.values(chats).filter(c => c.t).sort((a, b) => b.t - a.t).slice(0, MAXCHATS)
    .map(c => ({ jid: c.jid, name: chatName(c.jid, c.name), group: c.group, t: c.t, unread: c.unread || 0, msgs: c.msgs.map(m => ({ me: !!m.me, from: m.from || '', text: String(m.text).slice(0, 500), t: m.t })) }));
}
function scheduleChats() { if (chatsT) return; chatsT = setTimeout(async () => { chatsT = null; if (!chatsDirty || !AION) return; chatsDirty = false; try { await home({ acao: 'conversas_gravar', chats: chatsSnapshot() }); } catch (e) { chatsDirty = true; } }, 6000); }
async function restoreChats() { try { const j = await home({ acao: 'conversas_ler' }); for (const c of (j && j.chats) || []) chats[c.jid] = Object.assign({ unread: 0, msgs: [] }, c); } catch (e) {} }
async function loadGroups() { try { const g = await sock.groupFetchAllParticipating(); for (const [jid, info] of Object.entries(g || {})) { groupNames[jid] = info.subject || groupNames[jid]; if (chats[jid]) chats[jid].name = groupNames[jid]; } chatsDirty = true; scheduleChats(); } catch (e) {} }
function asMsg(m) {
  const text = textOf(m); if (!text) return null;
  const jid = m.key?.remoteJid || '', me = !!m.key?.fromMe;
  const from = me ? 'Você' : isGroup(jid) ? (m.pushName || contacts[m.key?.participant] || '') : '';
  return { id: m.key?.id, me, from, text: String(text).slice(0, 500), t: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000) };
}

// O login do WhatsApp é guardado no banco do AION (via site), então a ponte não depende de volume no Railway.
async function home(body) {
  const r = await fetch(AION + '/api/whats', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aion-wa': KEY }, body: JSON.stringify(body) });
  return r.ok ? r.json() : null;
}
async function restore() {
  if (!AION || !KEY) return;
  try {
    const j = await home({ acao: 'estado_ler' }); if (!j || !j.z) return;
    const data = JSON.parse(zlib.gunzipSync(Buffer.from(j.z, 'base64')).toString('utf8'));
    for (const [name, content] of Object.entries(data.files || {})) if (!name.includes('/') && !name.includes('..')) fs.writeFileSync(path.join(DIR, 'auth', name), content);
    if (data.contacts) contacts = Object.assign(data.contacts, contacts);
    console.log('Login do WhatsApp restaurado (' + Object.keys(data.files || {}).length + ' arquivos).');
  } catch (e) { console.error('Não consegui restaurar o login:', e.message); }
}
let lastSig = '', persistT = null;
async function persist() {
  if (!AION || !KEY) return;
  try {
    const dir = path.join(DIR, 'auth'), files = {}; let sig = '';
    for (const name of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, name)); if (!st.isFile()) continue; sig += name + st.size + st.mtimeMs; files[name] = fs.readFileSync(path.join(dir, name), 'utf8'); }
    if (!files['creds.json'] || sig === lastSig) return;
    const z = zlib.gzipSync(Buffer.from(JSON.stringify({ files, contacts }))).toString('base64');
    if (z.length > 3500000) return console.error('Login grande demais para guardar.');
    if (await home({ acao: 'estado_gravar', z })) lastSig = sig;
  } catch (e) { console.error('Não consegui guardar o login:', e.message); }
}
const persistSoon = () => { clearTimeout(persistT); persistT = setTimeout(persist, 8000); };
setInterval(persist, 5 * 60 * 1000);
async function pulse() {
  if (!AION || !KEY) return;
  try { await home({ acao: 'pulso', connected, qr: qr ? await QRCode.toDataURL(qr, { margin: 2, width: 320 }) : null, dominio: process.env.RAILWAY_PUBLIC_DOMAIN || '' }); } catch (e) {}
}
(function loop() { pulse().finally(() => setTimeout(loop, qr && !connected ? 5000 : 30000)); })();

function textOf(m) {
  const x = m.message || {}; const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x;
  return inner.conversation || inner.extendedTextMessage?.text || inner.imageMessage?.caption && '[foto] ' + inner.imageMessage.caption || inner.videoMessage?.caption && '[vídeo] ' + inner.videoMessage.caption
    || (inner.imageMessage ? '[foto]' : inner.videoMessage ? '[vídeo]' : inner.audioMessage ? '[áudio]' : inner.documentMessage ? '[documento] ' + (inner.documentMessage.fileName || '') : inner.stickerMessage ? '[figurinha]' : inner.locationMessage ? '[localização]' : inner.contactMessage ? '[contato]' : '');
}

async function forward(payload) {
  if (!AION) return;
  try { await home(Object.assign({ acao: 'msg' }, payload)); }
  catch (e) { console.error('Falha ao avisar a nave:', e.message); }
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DIR, 'auth'));
  let version; try { ({ version } = await fetchLatestBaileysVersion()); } catch (e) {}
  sock = makeWASocket({ auth: state, version, logger: log, browser: Browsers.appropriate('AION'), syncFullHistory: false, markOnlineOnConnect: false });
  sock.ev.on('creds.update', async () => { await saveCreds(); persistSoon(); });
  sock.ev.on('connection.update', u => {
    if (u.qr) { qr = u.qr; console.log('QR code pronto: abra /qr?k=SUA_CHAVE para escanear.'); }
    if (u.connection === 'open') { connected = true; qr = null; me = sock.user?.id || ''; console.log('WhatsApp conectado.'); persistSoon(); pulse(); loadGroups(); }
    if (u.connection === 'close') {
      connected = false;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) { console.log('Sessão encerrada no celular. Limpando e gerando novo QR.'); fs.rmSync(path.join(DIR, 'auth'), { recursive: true, force: true }); fs.mkdirSync(path.join(DIR, 'auth'), { recursive: true }); lastSig = ''; home({ acao: 'estado_gravar', z: '' }).catch(() => {}); }
      setTimeout(() => connect().catch(e => console.error('Erro ao reconectar:', e.message)), 3000);
    }
  });
  const fromContacts = list => { for (const c of list || []) { remember(c.id, c.name || c.notify || c.verifiedName); if (c.lid && (c.name || c.notify)) remember(c.lid, c.name || c.notify); if (chats[c.id]) chats[c.id].name = chatName(c.id); } };
  sock.ev.on('contacts.upsert', fromContacts);
  sock.ev.on('contacts.update', fromContacts);
  sock.ev.on('groups.update', list => { for (const g of list || []) if (g.id && g.subject) { groupNames[g.id] = g.subject; if (chats[g.id]) chats[g.id].name = g.subject; } scheduleChats(); });
  sock.ev.on('chats.upsert', list => { for (const c of list || []) touch(c.id, { name: c.name || '', t: Number(c.conversationTimestamp) || chats[c.id]?.t || 0, unread: c.unreadCount || 0 }); });
  sock.ev.on('chats.update', list => { for (const c of list || []) if (chats[c.id]) touch(c.id, Object.assign({}, c.unreadCount != null ? { unread: c.unreadCount } : {}, c.conversationTimestamp ? { t: Number(c.conversationTimestamp) } : {})); });
  sock.ev.on('messaging-history.set', h => {
    fromContacts(h?.contacts);
    for (const c of h?.chats || []) touch(c.id, { name: c.name || '', t: Number(c.conversationTimestamp) || 0, unread: c.unreadCount || 0 });
    for (const m of h?.messages || []) { const x = asMsg(m); if (x) addMsg(m.key.remoteJid, x); }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const m of messages || []) { const x = asMsg(m); if (x) { if (!x.me && !isGroup(m.key.remoteJid)) remember(m.key.remoteJid, m.pushName); addMsg(m.key.remoteJid, x); } }
    if (type !== 'notify') return;
    for (const m of messages || []) {
      const jid = m.key?.remoteJid || '';
      if (!okJid(jid) || m.key.fromMe) continue;
      const group = isGroup(jid); if (group) continue; // grupos aparecem no painel, mas não viram alerta
      if ((Number(m.messageTimestamp) || 0) * 1000 < startedAt - 60000) continue;
      const text = textOf(m); if (!text) continue;
      const name = contacts[jid] || m.pushName || jid.split('@')[0];
      if (!group) remember(jid, m.pushName);
      await forward({ de: name, texto: String(text).slice(0, 1200), grupo: group });
    }
  });
}

function resolve(to) {
  const digits = String(to).replace(/\D/g, '');
  if (digits.length >= 10 && digits.length === String(to).replace(/[\s()+-]/g, '').length) return { jid: (digits.length <= 11 ? '55' + digits : digits) + '@s.whatsapp.net' };
  const q = norm(to), pool = Object.assign({}, contacts); for (const c of Object.values(chats)) pool[c.jid] = chatName(c.jid, c.name);
  const all = Object.entries(pool).map(([jid, name]) => ({ jid, name, n: norm(name) }));
  let hit = all.filter(c => c.n === q); if (!hit.length) hit = all.filter(c => c.n.startsWith(q)); if (!hit.length) hit = all.filter(c => c.n.includes(q));
  if (hit.length === 1) return { jid: hit[0].jid, name: hit[0].name };
  if (!hit.length) return { error: 'Não encontrei nenhum contato chamado "' + to + '". Use o nome como aparece nas conversas da nave, ou o número com DDD.' };
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
    try { const sent = await sock.sendMessage(r.jid, { text: text.slice(0, 3000) }); addMsg(r.jid, { id: sent?.key?.id, me: true, from: 'Você', text: text.slice(0, 500), t: Math.floor(Date.now() / 1000) }); return send(res, 200, { ok: true, enviado_para: r.name || chatName(r.jid) || to }); }
    catch (e) { return send(res, 502, { error: 'Falha ao enviar: ' + String(e.message || e).slice(0, 120) }); }
  }
  if (url.pathname === '/contacts') return send(res, 200, { total: Object.keys(contacts).length, nomes: Object.values(contacts).slice(0, 300) });
  return send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log('Ponte do AION ouvindo na porta ' + PORT));

restore().then(restoreChats).then(connect).catch(e => console.error('Erro ao iniciar o WhatsApp:', e.message));
