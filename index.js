'use strict'
/* ============================================================================
   BOT MINEFLAYER (CONTA OFFLINE)  +  PAINEL WEB SIMPLES
   ----------------------------------------------------------------------------
   • Captura TODO e QUALQUER chat que aparecer na conta:
       - chat público de jogadores
       - /tell (whisper) recebido e enviado
       - mensagens do SERVIDOR (system)  -> kick, avisos, plugins, broadcasts
       - action bar (game_info)
       - chat assinado (1.19+) e formatos customizados de rede (BlazeBR etc.)
   • Comandos via TELL aceitos SOMENTE do dono (OWNER_NICK = "SrBoliin_")
   • Painel web embutido: http://SEU_IP:PANEL_PORT  (login com senha)
   • Editável pelo site: ip, porta, versão, nicks, dono, prefixo, senha...

   RODE:  npm install   e   npm start
   ========================================================================== */

const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')
const crypto = require('crypto')
const mineflayer = require('mineflayer')
const Vec3 = require('vec3').Vec3

// pathfinder é opcional: deixa "!vim" / "!meseguir" / "!ir x y z" muito melhores
let PF = null
try {
  PF = require('mineflayer-pathfinder')
} catch (e) {
  console.warn('[AVISO] mineflayer-pathfinder não carregado (usando andar manual):', e.message)
}

/* ==========================================================================
   1. CONFIG  (pode editar aqui OU pelo site - o site salva em data/config.json)
   ========================================================================== */

const CONFIG_FILE = path.join(__dirname, 'data', 'config.json')
const PANEL_FILE = path.join(__dirname, 'panel.html')

const DEFAULT_CONFIG = {
  // ---- servidor ----
  SERVER_HOST: 'sd-br3.blazebr.com',
  SERVER_PORT: 26280,
  VERSION: false,              // false = detectar sozinho | '1.8.9' | '1.16.5' | '1.20.4' ...
  VIEW_DISTANCE: 'normal',
  CHECK_TIMEOUT: 60000,
  HIDE_ERRORS: false,

  // ---- contas (offline) ----
  NICKS: ['SrZNexuxz_', 'SryXyz_', 'SrAura_', 'SrBolao_', 'SrSigma_', 'SrBeta_'],
  AUTH: 'offline',             // 'offline' = conta pirata/cracked | 'microsoft' = conta original
  AUTO_CONNECT: true,
  AUTO_RECONNECT: true,
  RECONNECT_DELAY: 5000,
  RESPAWN: true,               // renascer sozinho ao morrer

  // ---- dono / comandos ----
  OWNER_NICK: 'SrBoliin_',     // SOMENTE esse nick pode mandar comando
  EXTRA_OWNERS: [],            // nicks extras autorizados (opcional)
  COMMAND_PREFIX: '!',
  ONLY_VIA_TELL: false,        // true = só aceita comando por /tell (mais seguro)
  ALLOW_PUBLIC_COMMANDS: true, // true = comando do dono no chat público funciona (afeta todos os bots)
  LOOSE_OWNER_MATCH: true,     // true = reconhece o comando mesmo se o formato do /tell do servidor for estranho
  REPLY_VIA_TELL: true,        // o bot responde o dono por /tell
  REPLY_IN_CHAT: false,        // o bot responde no chat público
  COMMAND_COOLDOWN: 300,       // ms entre comandos do mesmo bot

  // ---- comportamento ----
  FOLLOW_DISTANCE: 3,          // blocos de distância ao seguir / "vim"
  WALK_SPRINT: true,           // correr quando anda pra frente
  WALK_TIMEOUT: 60000,         // tempo máximo de um "!andar"
  AUTO_JUMP: true,             // pular sozinho quando trava em bloco
  STOP_ON_FALL: 6,             // para de andar se cair X blocos (evita morrer)
  ATTACK_RANGE: 3.4,
  ATTACK_INTERVAL: 450,

  // ---- captura de chat ----
  CAPTURE_ACTION_BAR: true,    // game_info (barra acima da hotbar)
  CAPTURE_RAW_JSON: false,     // guarda o JSON cru da mensagem (debug de formato)
  CAPTURE_COLORS: false,       // false = remove os códigos de cor (§) do texto exibido
  MAX_CHAT_LOG: 3000,
  MAX_SERVER_LOG: 800,
  EXTRA_TELL_PATTERNS: [],     // regex (string) do formato de /tell do seu servidor, ex: "^De (\\w+): (.+)$"
  IGNORE_PATTERNS: [],         // regex (string) para IGNORAR mensagens (ex. anti-spam de score)

  // ---- painel ----
  PANEL_PORT: 10000,
  PANEL_HOST: '0.0.0.0',
  PANEL_PASSWORD: '123',
  CHAT_LENGTH_LIMIT: 0         // 0 = padrão do mineflayer | ex: 100 (1.8) / 256
}

let CONFIG = clone(DEFAULT_CONFIG)

function clone (o) { return JSON.parse(JSON.stringify(o)) }

function mergeDeep (base, extra) {
  for (const k of Object.keys(extra || {})) {
    const v = extra[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], v)
    else base[k] = v
  }
  return base
}

function loadConfig () {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      CONFIG = mergeDeep(clone(DEFAULT_CONFIG), saved)
      logInfo('config carregada de data/config.json')
    } else {
      saveConfig()
      logInfo('config padrão criada em data/config.json')
    }
  } catch (e) {
    logError('falha ao ler config: ' + e.message)
  }
}

function saveConfig () {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2))
    return true
  } catch (e) {
    logError('falha ao salvar config: ' + e.message)
    return false
  }
}

/* ==========================================================================
   2. STORAGE
   ========================================================================== */

const bots = new Map()      // nick -> wrap { nick, bot, ready, status, position, ... }
let chatLogs = []           // TUDO que passou no chat
let serverLogs = []         // console/log do sistema
let disconnectLogs = []     // quedas e kicks
let logId = 0
let msgId = 0
const stats = { total: 0, chat: 0, tell: 0, system: 0, actionbar: 0, out: 0, cmd: 0, ignored: 0, unknownOwner: 0 }
const tokens = new Map()    // sessão do painel
const recentMsg = new Map() // anti-duplicata
const lastCmdAt = new Map() // cooldown por bot

/* ==========================================================================
   3. HELPERS
   ========================================================================== */

function ts (d = new Date()) {
  return d.toLocaleTimeString('pt-BR', { hour12: false })
}

const COLORS = { reset: '\x1b[0m', gray: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m' }

function pushServerLog (level, msg) {
  const entry = { id: ++logId, ts: Date.now(), level, msg: String(msg) }
  serverLogs.push(entry)
  if (serverLogs.length > CONFIG.MAX_SERVER_LOG) serverLogs = serverLogs.slice(-CONFIG.MAX_SERVER_LOG)
  return entry
}

function logInfo (msg) { const e = pushServerLog('info', msg); console.log(`${COLORS.gray}[${ts(new Date(e.ts))}]${COLORS.reset} ${msg}`) }
function logOk (msg) { const e = pushServerLog('ok', msg); console.log(`${COLORS.green}[${ts(new Date(e.ts))}] ✔ ${msg}${COLORS.reset}`) }
function logWarn (msg) { const e = pushServerLog('warn', msg); console.log(`${COLORS.yellow}[${ts(new Date(e.ts))}] ⚠ ${msg}${COLORS.reset}`) }
function logError (msg) { const e = pushServerLog('error', msg); console.log(`${COLORS.red}[${ts(new Date(e.ts))}] ✖ ${msg}${COLORS.reset}`) }

// remove códigos de cor do minecraft (§a, §l, §r ...)
function stripColors (s) {
  return String(s === undefined || s === null ? '' : s).replace(/§[0-9a-fk-orx]/gi, '').replace(/§/g, '')
}

function cleanText (s) {
  const raw = String(s === undefined || s === null ? '' : s)
  return CONFIG.CAPTURE_COLORS ? raw : stripColors(raw).replace(/\s+/g, ' ').trim()
}

function normalize (s) {
  return stripColors(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function sameNick (a, b) {
  if (!a || !b) return false
  return normalize(a) === normalize(b)
}

function isOwner (nick) {
  if (!nick) return false
  if (sameNick(nick, CONFIG.OWNER_NICK)) return true
  return (CONFIG.EXTRA_OWNERS || []).some(o => sameNick(nick, o))
}

function escRe (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function sleep (ms) { return new Promise(r => setTimeout(r, ms)) }
function clamp (v, a, b) { return Math.max(a, Math.min(b, v)) }
function round1 (v) { return Math.round(Number(v || 0) * 10) / 10 }

function chunkText (text, size = 200) {
  const out = []
  let s = String(text)
  while (s.length > size) {
    let cut = s.lastIndexOf(' ', size)
    if (cut < size * 0.5) cut = size
    out.push(s.slice(0, cut))
    s = s.slice(cut).trim()
  }
  if (s.length) out.push(s)
  return out
}

function addChatLog (botNick, text, kind = 'chat', extra = {}) {
  const entry = {
    id: ++msgId,
    ts: Date.now(),
    bot: botNick,
    kind,                       // chat | tell | system | actionbar | out | cmd | reply | event
    from: extra.from || null,
    to: extra.to || null,
    text: cleanText(text),
    raw: CONFIG.CAPTURE_RAW_JSON && extra.raw ? safeJson(extra.raw) : undefined,
    cmd: extra.cmd || null,
    ignored: !!extra.ignored
  }
  if (!entry.text) return null
  chatLogs.push(entry)
  if (chatLogs.length > CONFIG.MAX_CHAT_LOG) chatLogs = chatLogs.slice(-CONFIG.MAX_CHAT_LOG)
  stats.total++
  if (stats[entry.kind] !== undefined) stats[entry.kind]++
  return entry
}

function safeJson (o) { try { return JSON.stringify(o) } catch (e) { return undefined } }

function pushDisconnect (nick, reason) {
  disconnectLogs.push({ bot: nick, reason: String(reason || 'desconhecido'), ts: Date.now() })
  if (disconnectLogs.length > 200) disconnectLogs = disconnectLogs.slice(-200)
}

/* ==========================================================================
   4. CAPTURA TOTAL DE CHAT
   ----------------------------------------------------------------------------
   O mineflayer emite:
     'messagestr' (texto, posição, msgOriginal, sender, verificado)
        posição = 'chat' | 'system' | 'game_info'
     'message'    (objeto ChatMessage)
     'actionBar'  (game_info)
     'chat'       (nick, msg)   -> quando bate o padrão vanilla de chat público
     'whisper'    (nick, msg)   -> quando bate o padrão vanilla de /tell
   A gente usa o 'messagestr' como fonte principal (pega TUDO, inclusive
   mensagem do servidor) e o 'chat'/'whisper' como reforço p/ descobrir o nick.
   ========================================================================== */

// formatos de /tell (whisper) - vanilla, PT-BR e redes customizadas
const TELL_REGEXES = [
  /^\[?\s*(\w{1,16})\s*(?:->|→|»+>|»|>|>>)\s*(?:eu|me|mim|\w{1,16})\s*\]?\s*[:\-–]?\s*(.+)$/i,
  /^\(\s*(\w{1,16})\s*(?:->|→|»|>)\s*(?:eu|me|mim|\w{1,16})\s*\)\s*[:\-–]?\s*(.+)$/i,
  /^(\w{1,16})\s+(?:whispers?(?:\s+to\s+you)?|sussurra(?:rou)?(?:\s+(?:para|pra|a)\s+você)?|murmura(?:\s+(?:para|pra)\s+você)?|cuchicha(?:\s+para\s+ti)?)\s*[:\-–]?\s*(.+)$/i,
  /^De\s+(\w{1,16})\s*[:\-–»>]\s*(.+)$/i,
  /^(?:Mensagem|Msg|MP|PM|W)\s+(?:de|from|para|to)?\s*(\w{1,16})\s*[:\-–»>]\s*(.+)$/i,
  /^\[\s*(\w{1,16})\s*\]\s*(?:sussurra|whispers?|diz|fala|->|→)\s*[:\-–]?\s*(.+)$/i,
  /^(\w{1,16})\s+(?:->|→)\s*(?:eu|\w{1,16})\s*[:\-–]?\s*(.+)$/i
]

// formatos de chat público (pra saber QUEM falou)
const CHAT_REGEXES = [
  /^<\s*(\w{1,16})\s*>\s*(.+)$/,
  /^\[\s*(\w{1,16})\s*\]\s*(?:»|>|:|\||-|~)?\s*(.+)$/,
  /^\(\s*(\w{1,16})\s*\)\s*(?:»|>|:|\||-|~)?\s*(.+)$/,
  /^(?:\[[^\]]{0,24}\]\s*){0,4}(\w{1,16})\s*(?:»|>|:|\||~|-)\s+(.+)$/,
  /^(\w{1,16})\s*[:»]\s*(.+)$/
]

// saída do NOSSO /tell (quando o bot sussurra alguém)
const OUT_TELL_REGEXES = [
  /^\[?(?:eu|me|\w{1,16})\s*(?:->|→|»|>)\s*(\w{1,16})\s*\]?\s*[:\-–]?\s*(.+)$/i,
  /^Para\s+(\w{1,16})\s*[:\-–»>]\s*(.+)$/i,
  /^(?:You whisper to|Você sussurra(?:rou)? para|Susurraste a)\s+(\w{1,16})\s*[:\-–]?\s*(.+)$/i
]

function extraRegexes (list) {
  const out = []
  for (const p of list || []) {
    try { out.push(new RegExp(p, 'i')) } catch (e) { /* regex inválida */ }
  }
  return out
}

function matchFirst (regexes, text) {
  for (const re of regexes) {
    const m = text.match(re)
    if (m) return m
  }
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolve o sender do pacote (pode vir UUID nas versões 1.19+) */
function resolveSender (bot, sender) {
  if (!sender) return null
  const s = String(typeof sender === 'object' && sender !== null ? (sender.toString ? sender.toString() : '') : sender)
  if (!s) return null
  if (UUID_RE.test(s)) {
    const p = Object.values(bot.players || {}).find(pl => pl && pl.uuid && String(pl.uuid).toLowerCase() === s.toLowerCase())
    return p ? p.username : null
  }
  if (/^\w{1,16}$/.test(s)) return s
  return null
}

/**
 * Descobre tipo/quem/texto de uma mensagem qualquer.
 * kind: tell | out_tell | chat | system | actionbar
 */
function parseMessage (bot, text, position, sender) {
  const clean = stripColors(text).replace(/\s+/g, ' ').trim()
  const out = { kind: 'system', from: null, to: null, body: clean }

  if (position === 'game_info') { out.kind = 'actionbar'; return out }

  const resolved = resolveSender(bot, sender)

  // 1) nosso próprio /tell saindo
  let m = matchFirst(OUT_TELL_REGEXES, clean)
  if (m) { out.kind = 'out_tell'; out.to = m[1]; out.body = m[2].trim(); return out }

  // 2) /tell recebido
  m = matchFirst([...TELL_REGEXES, ...extraRegexes(CONFIG.EXTRA_TELL_PATTERNS)], clean)
  if (m) { out.kind = 'tell'; out.from = m[1]; out.to = m[2] ? bot.username : null; out.body = (m[2] || '').trim(); return out }

  // 3) whisper detectado pelo próprio mineflayer (sender resolvido)
  if (position === 'chat' && resolved && isOwner(resolved)) { out.kind = 'chat'; out.from = resolved; out.body = clean; return out }

  // 4) system (mensagem do servidor: kick, aviso, plugin, broadcast, morte...)
  if (position === 'system') {
    out.kind = 'system'
    // mesmo em system, tenta achar um nick de jogador no começo ("Fulano saiu do jogo")
    const sm = clean.match(/^(\w{1,16})\s/)
    out.from = sm ? sm[1] : null
    out.body = clean
    return out
  }

  // 5) chat público
  m = matchFirst(CHAT_REGEXES, clean)
  if (m) { out.kind = 'chat'; out.from = m[1]; out.body = (m[2] || '').trim(); return out }

  out.kind = 'chat'
  out.from = resolved
  out.body = clean
  return out
}

/** Indício de que a mensagem é um /tell (usado no modo "loose") */
function hasTellHint (text) {
  return /->|→|»|whisper|sussurr|murmur|\bde\b|\bpara\b|\btell\b|\bmsg\b|\bmp\b/i.test(text)
}

/**
 * ENTRADA ÚNICA de toda mensagem que o bot enxerga.
 * Deduplica (messagestr + chat/whisper chegam juntos) e enriquece o remetente.
 */
function ingest (wrap, { text, position = 'chat', sender = null, forcedKind = null, forcedFrom = null, raw = null }) {
  if (!wrap) return null
  const full = String(text === undefined || text === null ? '' : text)
  if (!full.trim()) return null

  const clean = stripColors(full).replace(/\s+/g, ' ').trim()
  const key = wrap.nick + '|' + position + '|' + clean
  const now = Date.now()

  // duplicata (mesmo pacote chegou por 2 eventos) -> só enriquece
  const prev = recentMsg.get(key)
  if (prev && now - prev.ts < 600) {
    const e = prev.entry
    if (forcedFrom && !e.from) {
      e.from = forcedFrom
      e.kind = forcedKind === 'tell' ? 'tell' : (forcedKind || e.kind)
      tryRunCommand(wrap, e)
    }
    return e
  }

  const parsed = parseMessage(wrap.bot, full, position, sender)
  const kind = forcedKind === 'tell' ? 'tell' : (parsed.kind === 'out_tell' ? 'out' : parsed.kind)
  const from = forcedFrom || parsed.from

  // filtros de ignore
  for (const re of extraRegexes(CONFIG.IGNORE_PATTERNS)) {
    if (re.test(clean)) { stats.ignored++; return null }
  }

  const entry = addChatLog(wrap.nick, full, kind, {
    from,
    to: parsed.to,
    raw,
    ignored: false
  })
  if (!entry) return null

  recentMsg.set(key, { entry, ts: now })
  if (recentMsg.size > 400) {
    const firstKey = recentMsg.keys().next().value
    recentMsg.delete(firstKey)
  }

  tryRunCommand(wrap, entry)
  return entry
}
