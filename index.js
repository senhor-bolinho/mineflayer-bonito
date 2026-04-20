const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');

// ===== CONFIG =====
const PORT = 10000;
const SERVER_HOST = 'sd-br3.blazebr.com';
const SERVER_PORT = 26280;
const NICKS = ['iamobscure','naoeobolin','naoeobolin2','naoeobolin3'];
const PASSWORD = '123';

// ===== STORAGE =====
let bots = [];
let disconnectLogs = [];

// ===== CRIAR BOT =====
function createBot(username) {
  console.log(`🔄 Criando bot ${username}...`);

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username,
    auth: 'offline',
    version: false
  });

  bot.ready = false;

  bot.on('login', () => {
    console.log(`🔐 [${username}] LOGOU`);
  });

  bot.on('spawn', () => {
    bot.ready = true;
    console.log(`✅ [${username}] SPAWNOU (pronto)`);
  });

  bot.on('end', (reason) => {
    bot.ready = false;
    console.log(`❌ [${username}] DESCONECTADO:`, reason);

    disconnectLogs.push({
      bot: username,
      reason: reason || 'unknown',
      time: new Date().toISOString()
    });
  });

  bot.on('kicked', (reason) => {
    console.log(`🚫 [${username}] KICKADO:`, reason);

    disconnectLogs.push({
      bot: username,
      reason: 'KICK: ' + JSON.stringify(reason),
      time: new Date().toISOString()
    });
  });

  bot.on('error', (err) => {
    console.log(`⚠️ [${username}] ERRO COMPLETO:`, err);
  });

  bots.push(bot);
}

// ===== SERVER =====
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const q = parsed.query;

  res.setHeader('Access-Control-Allow-Origin', '*');

  // ===== LOGIN =====
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`
    <body style="background:#111;color:#fff;text-align:center;margin-top:100px;font-family:sans-serif;">
      <h2>Login</h2>
      <input type="password" id="p"/>
      <button onclick="go()">Entrar</button>
      <script>
        function go(){
          if(document.getElementById('p').value === "${PASSWORD}") location='/panel';
          else alert('Senha errada');
        }
      </script>
    </body>
    `);
  }

  // ===== DASHBOARD =====
  if (path === '/panel') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`
    <html>
    <body style="background:#0f172a;color:white;font-family:Arial;text-align:center">

    <h1>🤖 Dashboard</h1>

    <button onclick="api('/connect-all')">Connect All</button>
    <button onclick="api('/disconnect-all')">Disconnect All</button>

    <br><br>

    <input id="msg" placeholder="Mensagem"/>
    <button onclick="chat()">Enviar Chat</button>

    <h3>Status</h3>
    <pre id="bots"></pre>

    <h3>Disconnects / Kicks</h3>
    <pre id="logs"></pre>

    <script>
      function api(r){
        fetch(r).then(r=>r.json()).then(d=>alert(JSON.stringify(d,null,2)));
      }

      function chat(){
        let m=document.getElementById('msg').value;
        fetch('/chat-all?message='+encodeURIComponent(m));
      }

      function load(){
        fetch('/check').then(r=>r.json()).then(d=>{
          document.getElementById('bots').innerText=JSON.stringify(d,null,2);
        });

        fetch('/disconnects').then(r=>r.json()).then(d=>{
          document.getElementById('logs').innerText=JSON.stringify(d,null,2);
        });
      }

      setInterval(load,2000);
      load();
    </script>

    </body>
    </html>
    `);
  }

  res.setHeader('Content-Type', 'application/json');

  // ===== CHECK =====
  if (path === '/check') {
    return res.end(JSON.stringify({
      total: bots.length,
      online: bots.filter(b => b.ready).length,
      bots: bots.map(b => ({
        username: b.username,
        ready: b.ready
      }))
    }, null, 2));
  }

  // ===== DISCONNECT LOGS =====
  if (path === '/disconnects') {
    return res.end(JSON.stringify(disconnectLogs, null, 2));
  }

  // ===== CONNECT ALL =====
  if (path === '/connect-all') {
    const added = [];

    for (const n of NICKS) {
      if (!bots.find(b => b.username === n)) {
        createBot(n);
        added.push(n);
      }
    }

    return res.end(JSON.stringify({ connecting: added }));
  }

  // ===== DISCONNECT ALL =====
  if (path === '/disconnect-all') {
    const names = bots.map(b => b.username);

    bots.forEach(b => b.end());
    bots = [];

    return res.end(JSON.stringify({ disconnected: names }));
  }

  // ===== CHAT ALL =====
  if (path === '/chat-all') {
    const { message } = q;
    const sent = [];

    bots.forEach(b => {
      if (b.ready) {
        b.chat(message);
        sent.push(b.username);
      }
    });

    return res.end(JSON.stringify({ sent }));
  }

  // ===== 404 =====
  res.end(JSON.stringify({ error: 'rota inválida' }));
});

// ===== START =====
server.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});
