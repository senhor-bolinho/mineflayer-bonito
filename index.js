const mineflayer = require('mineflayer');
const http = require('http');
const url = require('url');

// ===== VARIÁVEIS DE AMBIENTE =====
const NICKS = (process.env.NICKS || 'bolinhogostoso,bolinhogostoso1').split(',').map(n => n.trim());
const SERVER_HOST = process.env.SERVER_HOST || '--';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '26280', 10);

// Storage global dos bots
let bots = [];

// ===== SERVIDOR HTTP COM API =====
function startHttpServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // OPTIONS para CORS
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // ===== ROTAS =====

    // GET /health - Status do servidor
    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        bots_total: bots.length,
        bots_connected: bots.filter(b => b.ready).length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /bots - Listar todos os bots
    if (pathname === '/bots') {
      res.writeHead(200);
      res.end(JSON.stringify({
        bots: bots.map(b => ({
          username: b.username,
          ready: b.ready,
          health: b.health?.hp || 0,
          hunger: b.food || 0,
          dimension: b.dimension || 'unknown'
        }))
      }));
      return;
    }

    // GET /chat - Enviar mensagem (chat)
    if (pathname === '/chat') {
      const { nick, message } = query;

      if (!nick || !message) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
          error: 'Parâmetros obrigatórios: nick e message',
          example: '/chat?nick=Bot1&message=Oi%20pessoal'
        }));
        return;
      }

      const bot = bots.find(b => b.username.toLowerCase() === nick.toLowerCase());
      if (!bot) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Bot "${nick}" não encontrado` }));
        return;
      }

      if (!bot.ready) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: `Bot "${nick}" não está pronto` }));
        return;
      }

      bot.chat(message);
      console.log(`💬 [API] [${nick}] ${message}`);
      
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        bot: nick,
        message: message,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /chat-all - Enviar para todos os bots
    if (pathname === '/chat-all') {
      const { message } = query;

      if (!message) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Parâmetro obrigatório: message',
          example: '/chat-all?message=Oi%20galera'
        }));
        return;
      }

      const sent = [];
      for (const bot of bots) {
        if (bot.ready) {
          bot.chat(message);
          sent.push(bot.username);
        }
      }

      console.log(`💬 [API] [TODOS] ${message}`);

      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        message: message,
        bots_sent: sent,
        count: sent.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /inventory - Ver inventário de um bot
    if (pathname === '/inventory') {
      const { nick } = query;

      if (!nick) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Parâmetro obrigatório: nick',
          example: '/inventory?nick=Bot1'
        }));
        return;
      }

      const bot = bots.find(b => b.username.toLowerCase() === nick.toLowerCase());
      if (!bot) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Bot "${nick}" não encontrado` }));
        return;
      }

      if (!bot.ready) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: `Bot "${nick}" não está pronto` }));
        return;
      }

      const items = [];
      for (let i = 0; i < bot.inventory.slots.length; i++) {
        const item = bot.inventory.slots[i];
        if (item && item.type > 0) {
          items.push({
            slot: i,
            name: item.name,
            count: item.count,
            type: item.type
          });
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        bot: nick,
        inventory: items,
        total_items: items.length,
        heldItem: bot.heldItem ? {
          name: bot.heldItem.name,
          count: bot.heldItem.count
        } : null
      }));
      return;
    }

    // GET /drop - Dropar item
    if (pathname === '/drop') {
      const { nick, item } = query;

      if (!nick) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Parâmetro obrigatório: nick',
          example: '/drop?nick=Bot1&item=dirt (ou deixe em branco para dropar item na mão)'
        }));
        return;
      }

      const bot = bots.find(b => b.username.toLowerCase() === nick.toLowerCase());
      if (!bot) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Bot "${nick}" não encontrado` }));
        return;
      }

      if (!bot.ready) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: `Bot "${nick}" não está pronto` }));
        return;
      }

      try {
        if (item) {
          // Dropar item específico
          const foundItem = bot.inventory.slots.find(s => s && s.name && s.name.toLowerCase() === item.toLowerCase());
          if (!foundItem) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Item "${item}" não encontrado no inventário` }));
            return;
          }
          bot.tossStack(foundItem);
          console.log(`✅ [API] [${nick}] Dropou item: ${item}`);
        } else {
          // Dropar item na mão
          const heldItem = bot.heldItem;
          if (!heldItem || heldItem.type === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Nada na mão para dropar' }));
            return;
          }
          bot.tossStack(heldItem);
          console.log(`✅ [API] [${nick}] Dropou item na mão`);
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          bot: nick,
          action: 'dropped',
          item: item || 'held item',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // GET /slot - Selecionar slot hotbar
    if (pathname === '/slot') {
      const { nick, number } = query;

      if (!nick || !number) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: 'Parâmetros obrigatórios: nick e number (0-8)',
          example: '/slot?nick=Bot1&number=3'
        }));
        return;
      }

      const slotNum = parseInt(number, 10);
      if (isNaN(slotNum) || slotNum < 0 || slotNum > 8) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Slot deve estar entre 0 e 8' }));
        return;
      }

      const bot = bots.find(b => b.username.toLowerCase() === nick.toLowerCase());
      if (!bot) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Bot "${nick}" não encontrado` }));
        return;
      }

      if (!bot.ready) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: `Bot "${nick}" não está pronto` }));
        return;
      }

      try {
        bot.setQuickBarSlot(slotNum);
        const heldItem = bot.heldItem;
        const itemName = heldItem && heldItem.type > 0 ? heldItem.name : 'ar';
        
        console.log(`✅ [API] [${nick}] Slot selecionado: ${slotNum}`);

        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          bot: nick,
          slot: slotNum,
          held_item: itemName,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // GET / - Documentação da API
    if (pathname === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        name: 'Mineflayer Bot Manager API',
        version: '1.0.0',
        endpoints: {
          'GET /health': 'Status do servidor e bots',
          'GET /bots': 'Listar todos os bots',
          'GET /chat?nick=Bot1&message=Oi': 'Enviar mensagem com um bot específico',
          'GET /chat-all?message=Oi': 'Enviar mensagem com todos os bots',
          'GET /inventory?nick=Bot1': 'Ver inventário de um bot',
          'GET /drop?nick=Bot1&item=dirt': 'Dropar item (deixe item em branco para dropar item na mão)',
          'GET /slot?nick=Bot1&number=3': 'Selecionar slot hotbar (0-8)',
          'GET /': 'Esta documentação'
        },
        examples: {
          chat_one: 'http://localhost:10000/chat?nick=Bot1&message=Olá%20pessoal',
          chat_all: 'http://localhost:10000/chat-all?message=Olá%20galera',
          inventory: 'http://localhost:10000/inventory?nick=Bot1',
          drop: 'http://localhost:10000/drop?nick=Bot1&item=dirt',
          slot: 'http://localhost:10000/slot?nick=Bot1&number=5'
        }
      }, null, 2));
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Rota não encontrada',
      available_routes: 'GET /'
    }));
  });

  server.listen(process.env.PORT || 10000, '0.0.0.0', () => {
    console.log(`\n✅ Servidor HTTP rodando em http://localhost:${process.env.PORT || 10000}`);
    console.log(`📖 Documentação: http://localhost:${process.env.PORT || 10000}/\n`);
  });
}

async function main() {
  // Iniciar servidor HTTP
  startHttpServer();

  console.log('=== Gerenciador de Contas Minecraft Offline (mineflayer) ===\n');
  console.log(`📋 Configuração:`);
  console.log(`   Nicks: ${NICKS.join(', ')}`);
  console.log(`   Servidor: ${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`   Total de bots: ${NICKS.length}\n`);

  const usernames = NICKS;
  const host = SERVER_HOST;
  const port = SERVER_PORT;

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    console.error('❌ Erro: Configurações inválidas!');
    console.error('   Verifique SERVER_HOST e SERVER_PORT');
    process.exit(1);
  }

  const version = false; // Let mineflayer auto-detect version

  console.log('🤖 Conectando bots...\n');
  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    const bot = mineflayer.createBot({
      host,
      port,
      username,
      version,
      auth: 'offline' // modo offline
    });

    // Manual ready system
    bot.ready = false;

    bot.once('spawn', () => {
      console.log(`✅ [${username}] Conectado ao servidor ${host}:${port}`);
      bot.ready = true;
    });

    bot.on('chat', (sender, message) => {
      // Ignore own messages to avoid echo
      if (sender === bot.username) return;
      console.log(`💬 [${sender}] ${message}`);
    });

    bot.on('end', () => {
      console.log(`❌ [${username}] Desconectado.`);
      bot.ready = false;
    });

    bot.on('error', err => {
      console.log(`⚠️  [${username}] Erro:`, err.message);
    });

    bots.push(bot);

    // Wait 5 seconds before connecting the next bot (except for the last one)
    if (i < usernames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Wait a bit for all bots to spawn
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📝 Use a API HTTP para controlar os bots:');
  console.log('   GET /chat?nick=Bot1&message=Oi%20pessoal');
  console.log('   GET /chat-all?message=Oi%20galera');
  console.log('   GET /inventory?nick=Bot1');
  console.log('   GET /bots\n');

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Desconectando todos os bots...');
    for (const bot of bots) {
      bot.end();
    }
    process.exit(0);
  });
}

main().catch(err => {
  console.error('❌ Erro inesperado:', err);
});
