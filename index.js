const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');

// ===== CONFIG =====
const PORT = 10000;
const SERVER_HOST = 'sd-br3.blazebr.com';
const SERVER_PORT = 26280;

const NICKS = [
  'SraArabella_',
  'SrDoardo_',
  'SrZusdoz_',
];

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
    <body style="
      background:#111;
      color:white;
      text-align:center;
      margin-top:100px;
      font-family:sans-serif;
    ">
      <h2>Login</h2>

      <input type="password" id="p"/>
      <button onclick="go()">Entrar</button>

      <script>
        function go(){
          if(document.getElementById('p').value === "${PASSWORD}")
            location='/panel';
          else
            alert('Senha errada');
        }
      </script>
    </body>
    `);
  }

  // ===== PAINEL =====
  if (path === '/panel') {
    res.setHeader('Content-Type', 'text/html');

    return res.end(`
    <html>
    <body style="
      background:#0f172a;
      color:white;
      font-family:Arial;
      text-align:center;
    ">

    <h1>🤖 Dashboard</h1>

    <button onclick="api('/connect-all')">
      Connect All
    </button>

    <button onclick="api('/disconnect-all')">
      Disconnect All
    </button>

    <br><br>

    <input id="msg" placeholder="Mensagem"/>
    <button onclick="chat()">
      Enviar Chat
    </button>

    <br><br>

    <h2>Controle Individual</h2>

    <div id="individual"></div>

    <h3>Status</h3>
    <pre id="bots"></pre>

    <h3>Disconnects / Kicks</h3>
    <pre id="logs"></pre>

    <script>

      const ALL_NICKS = ${JSON.stringify(NICKS)};

      function api(route){
        fetch(route)
          .then(r => r.json())
          .then(d => alert(JSON.stringify(d,null,2)));
      }

      function chat(){
        const m = document.getElementById('msg').value;

        fetch(
          '/chat-all?message=' +
          encodeURIComponent(m)
        );
      }

      function connectBot(nick){
        fetch(
          '/connect?nick=' +
          encodeURIComponent(nick)
        )
        .then(r=>r.json())
        .then(console.log);
      }

      function disconnectBot(nick){
        fetch(
          '/disconnect?nick=' +
          encodeURIComponent(nick)
        )
        .then(r=>r.json())
        .then(console.log);
      }

      function load(){

        fetch('/check')
        .then(r=>r.json())
        .then(d=>{

          document.getElementById('bots').innerText =
            JSON.stringify(d,null,2);

          let html = '';

          for(const nick of ALL_NICKS){

            const online =
              d.bots.find(
                b => b.username === nick
              );

            html += \`
              <div style="
                margin:10px;
                padding:10px;
                border:1px solid #334155;
                border-radius:8px;
              ">

                <b>\${nick}</b>

                \${
                  online
                  ? '<span style="color:lime"> ONLINE</span>'
                  : '<span style="color:red"> OFFLINE</span>'
                }

                <br><br>

                <button onclick="connectBot('\${nick}')">
                  Conectar
                </button>

                <button onclick="disconnectBot('\${nick}')">
                  Desconectar
                </button>

              </div>
            \`;
          }

          document.getElementById('individual').innerHTML =
            html;
        });

        fetch('/disconnects')
        .then(r=>r.json())
        .then(d=>{
          document.getElementById('logs').innerText =
            JSON.stringify(d,null,2);
        });
      }

      setInterval(load, 2000);

      load();

    </script>

    </body>
    </html>
    `);
  }

  res.setHeader(
    'Content-Type',
    'application/json'
  );

  // ===== CHECK =====
  if (path === '/check') {
    return res.end(
      JSON.stringify({
        total: bots.length,

        online: bots.filter(
          b => b.ready
        ).length,

        bots: bots.map(b => ({
          username: b.username,
          ready: b.ready
        }))
      }, null, 2)
    );
  }

  // ===== LOGS =====
  if (path === '/disconnects') {
    return res.end(
      JSON.stringify(
        disconnectLogs,
        null,
        2
      )
    );
  }

  // ===== CONNECT ALL =====
  if (path === '/connect-all') {

    const added = [];

    for (const nick of NICKS) {

      if (
        !bots.find(
          b => b.username === nick
        )
      ) {
        createBot(nick);
        added.push(nick);
      }
    }

    return res.end(
      JSON.stringify({
        connecting: added
      })
    );
  }

  // ===== DISCONNECT ALL =====
  if (path === '/disconnect-all') {

    const names =
      bots.map(b => b.username);

    bots.forEach(b => b.end());

    bots = [];

    return res.end(
      JSON.stringify({
        disconnected: names
      })
    );
  }

  // ===== CONNECT INDIVIDUAL =====
  if (path === '/connect') {

    const nick = q.nick;

    if (!nick) {
      return res.end(
        JSON.stringify({
          error: 'nick não informado'
        })
      );
    }

    if (!NICKS.includes(nick)) {
      return res.end(
        JSON.stringify({
          error: 'nick não autorizado'
        })
      );
    }

    if (
      bots.find(
        b => b.username === nick
      )
    ) {
      return res.end(
        JSON.stringify({
          error: 'bot já conectado'
        })
      );
    }

    createBot(nick);

    return res.end(
      JSON.stringify({
        connected: nick
      })
    );
  }

  // ===== DISCONNECT INDIVIDUAL =====
  if (path === '/disconnect') {

    const nick = q.nick;

    const bot =
      bots.find(
        b => b.username === nick
      );

    if (!bot) {
      return res.end(
        JSON.stringify({
          error: 'bot não encontrado'
        })
      );
    }

    bot.end();

    bots =
      bots.filter(
        b => b.username !== nick
      );

    return res.end(
      JSON.stringify({
        disconnected: nick
      })
    );
  }

  // ===== CHAT ALL =====
  if (path === '/chat-all') {

    const { message } = q;

    const sent = [];

    bots.forEach(bot => {

      if (bot.ready) {

        bot.chat(message);

        sent.push(
          bot.username
        );
      }
    });

    return res.end(
      JSON.stringify({
        sent
      })
    );
  }

  // ===== 404 =====
  res.end(
    JSON.stringify({
      error: 'rota inválida'
    })
  );
});

// ===== START =====
server.listen(PORT, () => {
  console.log(
    `🚀 http://localhost:${PORT}`
  );
});
