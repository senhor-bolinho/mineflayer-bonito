const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');

// ===== CONFIG =====
const PORT = process.env.PORT || 26280;
const SERVER_HOST = process.env.SERVER_HOST || 'sd-br3.blazebr.com';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || 'sd', 10);
const NICKS = (process.env.NICKS || 'iamobscure,naoeobolin,naoeobolin2,naoeobolin3').split(',').map(n => n.trim());
const PASSWORD = process.env.PASSWORD || '123';

// ===== STORAGE =====
let bots = [];

// ===== CRIAR BOT =====
function createBot(username) {
  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username,
    auth: 'offline'
  });

  bot.ready = false;

  bot.once('spawn', () => {
    bot.ready = true;
    console.log(`✅ [${username}] conectado`);
  });

  bot.on('end', () => {
    bot.ready = false;
    console.log(`❌ [${username}] desconectado`);
  });

  bot.on('error', err => {
    console.log(`⚠️ [${username}] ${err.message}`);
  });

  bots.push(bot);
}

// ===== API SERVER =====
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;
  const q = parsed.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // ===== LOGIN PAGE =====
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`
    <body style="background:#111;color:#fff;text-align:center;margin-top:100px;font-family:sans-serif;">
      <h2>Login Painel</h2>
      <input type="password" id="p" placeholder="Senha"/>
      <button onclick="go()">Entrar</button>
      <script>
        function go(){
          if(document.getElementById('p').value === "${PASSWORD}"){
            location='/panel';
          } else alert('Senha errada');
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
    <head>
      <style>
        body{background:#0f172a;color:white;font-family:Arial;text-align:center}
        .box{background:#1e293b;padding:20px;margin:20px;border-radius:12px}
        button{padding:10px;margin:5px;border:none;border-radius:8px;cursor:pointer}
        .g{background:#22c55e}
        .r{background:#ef4444}
        input{padding:10px;border-radius:8px;border:none}
      </style>
    </head>
    <body>

    <h1>🤖 Dashboard Bots</h1>

    <div class="box">
      <h3>Conexão</h3>
      <button class="g" onclick="api('/connect-all')">Connect All</button>
      <button class="r" onclick="api('/disconnect-all')">Disconnect All</button>
    </div>

    <div class="box">
      <h3>Chat Global</h3>
      <input id="msg" placeholder="Mensagem"/>
      <button onclick="send()">Enviar</button>
    </div>

    <div class="box">
      <h3>Status</h3>
      <pre id="bots">Carregando...</pre>
      <button onclick="load()">Atualizar</button>
    </div>

    <script>
      function api(r){
        fetch(r).then(x=>x.json()).then(d=>alert(JSON.stringify(d,null,2)));
      }
      function send(){
        let m=document.getElementById('msg').value;
        fetch('/chat-all?message='+encodeURIComponent(m));
      }
      function load(){
        fetch('/bots').then(r=>r.json()).then(d=>{
          document.getElementById('bots').innerText=JSON.stringify(d,null,2);
        });
      }
      load();
    </script>

    </body>
    </html>
    `);
  }

  // ===== LISTAR BOTS =====
  if (path === '/bots') {
    return res.end(JSON.stringify({
      bots: bots.map(b => ({
        username: b.username,
        ready: b.ready,
        health: b.health || 0,
        food: b.food || 0
      }))
    }));
  }

  // ===== CONNECT =====
  if (path === '/connect') {
    const { nick } = q;
    if (!nick) return res.end(JSON.stringify({ error: 'nick obrigatório' }));

    if (bots.find(b => b.username === nick)) {
      return res.end(JSON.stringify({ error: 'já conectado' }));
    }

    createBot(nick);
    return res.end(JSON.stringify({ status: 'connecting', nick }));
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
    return res.end(JSON.stringify({ connected: added }));
  }

  // ===== DISCONNECT =====
  if (path === '/disconnect') {
    const { nick } = q;
    const i = bots.findIndex(b => b.username === nick);

    if (i === -1) return res.end(JSON.stringify({ error: 'não encontrado' }));

    bots[i].end();
    bots.splice(i, 1);

    return res.end(JSON.stringify({ status: 'disconnected', nick }));
  }

  // ===== DISCONNECT ALL =====
  if (path === '/disconnect-all') {
    const names = bots.map(b => b.username);
    bots.forEach(b => b.end());
    bots = [];
    return res.end(JSON.stringify({ disconnected: names }));
  }

  // ===== CHAT =====
  if (path === '/chat') {
    const { nick, message } = q;
    const bot = bots.find(b => b.username === nick);

    if (!bot) return res.end(JSON.stringify({ error: 'bot não existe' }));
    if (!bot.ready) return res.end(JSON.stringify({ error: 'bot não pronto' }));

    bot.chat(message);
    return res.end(JSON.stringify({ ok: true }));
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
  console.log(`🚀 Rodando em http://localhost:${PORT}`);
});
