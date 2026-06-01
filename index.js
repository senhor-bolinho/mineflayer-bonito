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
let chatLogs = [];

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
  bot.position = { x: 0, y: 0, z: 0 };

  bot.on('login', () => {
    console.log(`🔐 [${username}] LOGOU`);
    addChatLog(username, '[SISTEMA] Bot logou');
  });

  bot.on('spawn', () => {
    bot.ready = true;
    console.log(`✅ [${username}] SPAWNOU (pronto)`);
    addChatLog(username, '[SISTEMA] Bot spawnou');
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

  // ===== EVENTOS DE CHAT =====
  bot.on('chat', (username_chat, message) => {
    if (username_chat !== bot.username) {
      addChatLog(bot.username, `[${username_chat}] ${message}`);
    }
  });

  bot.on('message', (message) => {
    const msg_text = message.toString();
    if (msg_text && msg_text.trim()) {
      addChatLog(bot.username, msg_text);
    }
  });

  bot.on('whisper', (username_whisper, message) => {
    addChatLog(bot.username, `[PRIVADO ${username_whisper}] ${message}`);
  });

  bot.on('system message', (message) => {
    const sys_msg = message.toString();
    if (sys_msg && sys_msg.trim()) {
      addChatLog(bot.username, `[SISTEMA] ${sys_msg}`);
    }
  });

  // ===== POSIÇÃO =====
  bot.on('move', () => {
    if (bot.entity && bot.entity.position) {
      bot.position = {
        x: Math.round(bot.entity.position.x * 10) / 10,
        y: Math.round(bot.entity.position.y * 10) / 10,
        z: Math.round(bot.entity.position.z * 10) / 10
      };
    }
  });

  bots.push(bot);
}

// ===== ADICIONAR LOG DE CHAT =====
function addChatLog(bot_name, message) {
  chatLogs.push({
    bot: bot_name,
    message: message,
    timestamp: new Date().toISOString()
  });

  // Manter histórico máximo
  if (chatLogs.length > 1000) {
    chatLogs.shift();
  }
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
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard Bot</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #e2e8f0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        h1 {
          text-align: center;
          margin-bottom: 30px;
          font-size: 2.5em;
          color: #60a5fa;
          text-shadow: 0 0 10px rgba(96, 165, 250, 0.3);
        }

        h2 {
          color: #60a5fa;
          margin-bottom: 20px;
          border-bottom: 2px solid #334155;
          padding-bottom: 10px;
          font-size: 1.5em;
        }

        .controls-top {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }

        button {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6);
        }

        button:active {
          transform: translateY(0);
        }

        input[type="text"],
        input[type="password"],
        textarea {
          background: #1e293b;
          color: #e2e8f0;
          border: 2px solid #334155;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        input[type="text"]:focus,
        input[type="password"]:focus,
        textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }

        .chat-input-section {
          text-align: center;
          margin-bottom: 30px;
          padding: 15px;
          background: #1e293b;
          border-radius: 8px;
          border: 1px solid #334155;
        }

        .chat-input-section input {
          width: 100%;
          max-width: 500px;
          margin-right: 10px;
        }

        .bots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .bot-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 2px solid #334155;
          border-radius: 12px;
          padding: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .bot-card:hover {
          border-color: #60a5fa;
          box-shadow: 0 8px 25px rgba(96, 165, 250, 0.2);
        }

        .bot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .bot-name {
          font-size: 1.3em;
          font-weight: bold;
          color: #e2e8f0;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-online {
          background: #10b981;
          color: white;
        }

        .status-offline {
          background: #ef4444;
          color: white;
        }

        .bot-position {
          background: #0f172a;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 15px;
          font-family: monospace;
          font-size: 12px;
          color: #60a5fa;
          border-left: 3px solid #60a5fa;
        }

        .position-label {
          color: #94a3b8;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .movement-controls {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 15px;
        }

        .movement-btn {
          padding: 10px;
          font-size: 18px;
          background: #475569;
          border: 2px solid #64748b;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .movement-btn:hover {
          background: #64748b;
          border-color: #94a3b8;
        }

        .movement-btn:active {
          transform: scale(0.95);
        }

        .empty {
          grid-column: 1;
        }

        .chat-section {
          margin-bottom: 15px;
        }

        .chat-label {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 5px;
          display: block;
        }

        .chat-input-group {
          display: flex;
          gap: 8px;
        }

        .chat-input-group input {
          flex: 1;
          padding: 8px;
          font-size: 13px;
        }

        .chat-input-group button {
          padding: 8px 16px;
          font-size: 13px;
          white-space: nowrap;
        }

        .connection-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .connection-buttons button {
          padding: 10px;
          font-size: 13px;
        }

        .btn-connect {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .btn-disconnect {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .logs-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .log-box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 15px;
          max-height: 400px;
          overflow-y: auto;
        }

        .log-box h3 {
          color: #60a5fa;
          margin-bottom: 10px;
          font-size: 1.1em;
        }

        .log-box pre {
          background: #0f172a;
          padding: 10px;
          border-radius: 6px;
          font-size: 11px;
          color: #94a3b8;
          overflow-x: auto;
        }

        .chat-live-section {
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 30px;
        }

        .chat-messages {
          background: #0f172a;
          border-radius: 6px;
          padding: 15px;
          height: 400px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
          border: 1px solid #334155;
        }

        .message {
          color: #cbd5e1;
          margin-bottom: 8px;
          padding: 5px;
          border-left: 2px solid #475569;
          padding-left: 10px;
        }

        .message-time {
          color: #64748b;
          font-weight: 600;
        }

        .message-bot {
          color: #60a5fa;
          font-weight: 600;
        }

        .message-text {
          color: #cbd5e1;
        }

        .no-messages {
          color: #64748b;
          text-align: center;
          margin-top: 150px;
        }

        @media (max-width: 768px) {
          .bots-grid {
            grid-template-columns: 1fr;
          }

          .logs-section {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 1.8em;
          }
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #0f172a;
        }

        ::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Dashboard Bot</h1>

        <div class="controls-top">
          <button onclick="api('/connect-all')">
            ✅ Connect All
          </button>

          <button onclick="api('/disconnect-all')">
            ❌ Disconnect All
          </button>
        </div>

        <div class="chat-input-section">
          <input id="msg" type="text" placeholder="Enviar mensagem para todos os bots..."/>
          <button onclick="chatAll()">📤 Enviar Chat para Todos</button>
        </div>

        <div class="chat-live-section">
          <h2>💬 Chat ao Vivo</h2>
          <div class="chat-messages" id="chatMessages">
            <div class="no-messages">Aguardando mensagens...</div>
          </div>
        </div>

        <h2>🎮 Controle Individual</h2>
        <div class="bots-grid" id="individual"></div>

        <div class="logs-section">
          <div class="log-box">
            <h3>📊 Status dos Bots</h3>
            <pre id="bots">Carregando...</pre>
          </div>

          <div class="log-box">
            <h3>⚠️ Desconexões / Kicks</h3>
            <pre id="logs">Nenhuma desconexão registrada</pre>
          </div>
        </div>
      </div>

      <script>
        const ALL_NICKS = ${JSON.stringify(NICKS)};

        function api(route){
          fetch(route)
            .then(r => r.json())
            .then(d => {
              if(d.error) {
                alert('Erro: ' + d.error);
              } else {
                console.log(JSON.stringify(d, null, 2));
              }
            })
            .catch(e => console.error(e));
        }

        function chatAll(){
          const m = document.getElementById('msg').value;

          if (!m.trim()) {
            alert('Digite uma mensagem!');
            return;
          }

          fetch(
            '/chat-all?message=' +
            encodeURIComponent(m)
          )
          .then(r => r.json())
          .then(d => {
            console.log(d);
            document.getElementById('msg').value = '';
          })
          .catch(e => console.error(e));
        }

        function connectBot(nick){
          fetch(
            '/connect?nick=' +
            encodeURIComponent(nick)
          )
          .then(r=>r.json())
          .then(d => {
            if(d.error) {
              alert('Erro: ' + d.error);
            }
            loadBots();
          })
          .catch(e => console.error(e));
        }

        function disconnectBot(nick){
          fetch(
            '/disconnect?nick=' +
            encodeURIComponent(nick)
          )
          .then(r=>r.json())
          .then(d => {
            if(d.error) {
              alert('Erro: ' + d.error);
            }
            loadBots();
          })
          .catch(e => console.error(e));
        }

        function sendChatIndividual(nick){
          const msg = document.getElementById('msg-' + nick).value;

          if (!msg.trim()) {
            alert('Digite uma mensagem!');
            return;
          }

          fetch(
            '/chat?nick=' + encodeURIComponent(nick) +
            '&message=' + encodeURIComponent(msg)
          )
          .then(r => r.json())
          .then(d => {
            if(d.error) {
              alert('Erro: ' + d.error);
            } else {
              document.getElementById('msg-' + nick).value = '';
            }
          })
          .catch(e => console.error(e));
        }

        function moveBot(nick, dir){
          fetch(
            '/move?nick=' + encodeURIComponent(nick) +
            '&dir=' + encodeURIComponent(dir)
          )
          .then(r => r.json())
          .then(d => {
            if(d.error) {
              console.error('Erro ao mover:', d.error);
            }
          })
          .catch(e => console.error(e));
        }

        function loadBots(){
          fetch('/check')
          .then(r=>r.json())
          .then(d=>{

            document.getElementById('bots').innerText =
              JSON.stringify(d,null,2);

            let html = '';

            for(const nick of ALL_NICKS){

              const bot_data =
                d.bots.find(
                  b => b.username === nick
                );

              const online = bot_data && bot_data.ready;

              const posX = bot_data && bot_data.position ? bot_data.position.x : '-';
              const posY = bot_data && bot_data.position ? bot_data.position.y : '-';
              const posZ = bot_data && bot_data.position ? bot_data.position.z : '-';

              html += \`
                <div class="bot-card">

                  <div class="bot-header">
                    <div class="bot-name">\${nick}</div>
                    <div class="status-badge \${online ? 'status-online' : 'status-offline'}">
                      \${online ? '🟢 ONLINE' : '🔴 OFFLINE'}
                    </div>
                  </div>

                  <div class="bot-position">
                    <div class="position-label">📍 Posição Atual:</div>
                    <div>X: \${posX}</div>
                    <div>Y: \${posY}</div>
                    <div>Z: \${posZ}</div>
                  </div>

                  <div class="movement-controls">
                    <div class="empty"></div>
                    <button class="movement-btn" onclick="moveBot('\${nick}', 'forward')" title="Frente">⬆️</button>
                    <div class="empty"></div>

                    <button class="movement-btn" onclick="moveBot('\${nick}', 'left')" title="Esquerda">⬅️</button>
                    <button class="movement-btn" onclick="moveBot('\${nick}', 'jump')" title="Pular">⤒</button>
                    <button class="movement-btn" onclick="moveBot('\${nick}', 'right')" title="Direita">➡️</button>

                    <div class="empty"></div>
                    <button class="movement-btn" onclick="moveBot('\${nick}', 'back')" title="Trás">⬇️</button>
                    <div class="empty"></div>
                  </div>

                  <div class="chat-section">
                    <label class="chat-label">Enviar Mensagem:</label>
                    <div class="chat-input-group">
                      <input 
                        type="text" 
                        id="msg-\${nick}"
                        placeholder="Mensagem..."
                      />
                      <button onclick="sendChatIndividual('\${nick}')">📨 Enviar</button>
                    </div>
                  </div>

                  <div class="connection-buttons">
                    <button class="btn-connect" onclick="connectBot('\${nick}')">
                      ✅ Conectar
                    </button>
                    <button class="btn-disconnect" onclick="disconnectBot('\${nick}')">
                      ❌ Desconectar
                    </button>
                  </div>

                </div>
              \`;
            }

            document.getElementById('individual').innerHTML = html;
          })
          .catch(e => console.error(e));
        }

        function loadChatLogs(){
          fetch('/chatlogs')
          .then(r => r.json())
          .then(d => {
            const container = document.getElementById('chatMessages');

            if(!d || d.length === 0){
              container.innerHTML = '<div class="no-messages">Nenhuma mensagem ainda</div>';
              return;
            }

            let html = '';

            const toShow = d.slice(-500).reverse();

            for(const log of toShow){
              const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
              html += \`
                <div class="message">
                  <span class="message-time">[\${time}]</span>
                  <span class="message-bot">[\${log.bot}]</span>
                  <span class="message-text">\${escapeHtml(log.message)}</span>
                </div>
              \`;
            }

            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;
          })
          .catch(e => console.error(e));
        }

        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        setInterval(loadBots, 2000);
        setInterval(loadChatLogs, 1000);

        loadBots();
        loadChatLogs();

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
          ready: b.ready,
          position: b.position
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

  // ===== CHAT LOGS =====
  if (path === '/chatlogs') {
    return res.end(
      JSON.stringify(
        chatLogs,
        null,
        2
      )
    );
  }

  // ===== CHAT INDIVIDUAL =====
  if (path === '/chat') {
    const nick = q.nick;
    const message = q.message;

    if (!nick) {
      return res.end(
        JSON.stringify({
          error: 'nick não informado'
        })
      );
    }

    if (!message) {
      return res.end(
        JSON.stringify({
          error: 'message não informada'
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

    const bot = bots.find(b => b.username === nick);

    if (!bot) {
      return res.end(
        JSON.stringify({
          error: 'bot não encontrado'
        })
      );
    }

    if (!bot.ready) {
      return res.end(
        JSON.stringify({
          error: 'bot não está pronto'
        })
      );
    }

    try {
      bot.chat(message);

      return res.end(
        JSON.stringify({
          sent: nick,
          message: message
        })
      );
    } catch (err) {
      return res.end(
        JSON.stringify({
          error: 'erro ao enviar mensagem: ' + err.message
        })
      );
    }
  }

  // ===== MOVE =====
  if (path === '/move') {
    const nick = q.nick;
    const dir = q.dir;

    if (!nick) {
      return res.end(
        JSON.stringify({
          error: 'nick não informado'
        })
      );
    }

    if (!dir) {
      return res.end(
        JSON.stringify({
          error: 'direction não informada'
        })
      );
    }

    const validDirections = ['forward', 'back', 'left', 'right', 'jump'];

    if (!validDirections.includes(dir)) {
      return res.end(
        JSON.stringify({
          error: 'direção inválida: ' + dir
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

    const bot = bots.find(b => b.username === nick);

    if (!bot) {
      return res.end(
        JSON.stringify({
          error: 'bot não encontrado'
        })
      );
    }

    if (!bot.ready) {
      return res.end(
        JSON.stringify({
          error: 'bot não está pronto'
        })
      );
    }

    try {
      const control = bot.getControlState();

      switch(dir) {
        case 'forward':
          control.forward = true;
          break;
        case 'back':
          control.back = true;
          break;
        case 'left':
          control.left = true;
          break;
        case 'right':
          control.right = true;
          break;
        case 'jump':
          control.jump = true;
          break;
      }

      bot.setControlState(control);

      setTimeout(() => {
        const resetControl = bot.getControlState();
        resetControl.forward = false;
        resetControl.back = false;
        resetControl.left = false;
        resetControl.right = false;
        resetControl.jump = false;
        bot.setControlState(resetControl);
      }, 100);

      return res.end(
        JSON.stringify({
          moved: nick,
          direction: dir
        })
      );
    } catch (err) {
      return res.end(
        JSON.stringify({
          error: 'erro ao mover: ' + err.message
        })
      );
    }
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

    bots.forEach(b => {
      try {
        b.end();
      } catch (err) {
        console.error('Erro ao desconectar ' + b.username + ':', err);
      }
    });

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

    try {
      bot.end();
    } catch (err) {
      console.error('Erro ao desconectar ' + nick + ':', err);
    }

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

    if (!message) {
      return res.end(
        JSON.stringify({
          error: 'message não informada'
        })
      );
    }

    const sent = [];

    bots.forEach(bot => {

      if (bot.ready) {
        try {
          bot.chat(message);
          sent.push(
            bot.username
          );
        } catch (err) {
          console.error('Erro ao enviar chat do ' + bot.username + ':', err);
        }
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
