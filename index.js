const mineflayer = require('mineflayer');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot rodando!');
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, ans => resolve(ans.trim())));
}

async function main() {
  console.log('=== Gerenciador de Contas Minecraft Offline (mineflayer) ===\n');

  const count = parseInt(await askQuestion('Quantas contas? '));
  if (isNaN(count) || count <= 0) {
    console.log('Número inválido.');
    rl.close();
    return;
  }

  const usernames = [];
  for (let i = 0; i < count; i++) {
    const nick = await askQuestion(`Nick da conta ${i + 1}: `);
    if (!nick) {
      console.log('Nick não pode estar vazio.');
      rl.close();
      return;
    }
    usernames.push(nick);
  }

  const host = await askQuestion('IP do servidor: ');
  const portStr = await askQuestion('Porta do servidor: ');
  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    console.log('Porta inválida.');
    rl.close();
    return;
  }

  const version = false; // Let mineflayer auto-detect version
  const bots = [];

  console.log('\nConectando bots...\n');
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
      console.log(`[${username}] Conectado ao servidor ${host}:${port}`);
      bot.ready = true;
    });

    bot.on('chat', (sender, message) => {
      // Ignore own messages to avoid echo
      if (sender === bot.username) return;
      console.log(`[${sender}] ${message}`);
    });

    bot.on('end', () => {
      console.log(`[${username}] Desconectado.`);
      bot.ready = false;
    });

    bot.on('error', err => {
      console.log(`[${username}] Erro:`, err.message);
    });

    bots.push(bot);

    // Wait 5 seconds before connecting the next bot (except for the last one)
    if (i < usernames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Wait a bit for all bots to spawn
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Helper function to find bot by nick (case insensitive)
  function findBotByNick(nick) {
    return bots.find(bot => bot.username.toLowerCase() === nick.toLowerCase());
  }

  // Helper function to find item by name in bot's inventory (case insensitive)
  function findItemByName(bot, itemName) {
    if (!bot || !bot.inventory) return null;
    const slots = bot.inventory.slots;
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (item && item.name && item.name.toLowerCase() === itemName.toLowerCase() && item.type > 0) {
        return { item, slot: i };
      }
    }
    return null;
  }

  // Set up stdin to send commands to bots
  console.log('\nDigite mensagens ou comandos.');
  console.log('Formato para enviar para um bot específico: <nick>: <mensagem>');
  console.log('Exemplo: Bot1: /logar ahahah123');
  console.log('Exemplo: Bot1: Oi, todos!');
  console.log('Comandos de inventário (não precisam do formato <nick>: ):');
  console.log('  $slot <numero> - seleciona slot da hotbar (0-8)');
  console.log('  $inv - lista o inventário completo');
  console.log('  $drop - dropa item na mão');
  console.log('  $drop <nome_item> - dropa item específico pelo nome');
  console.log('  $equip <nome_item> - equipa item na mão');
  console.log('  $unequip - remove item da mão');
  console.log('  $move <slot_origem> <slot_destino> - move item entre slots (0-35)');
  console.log('Se não usar o formato acima e não for um comando de inventário, a mensagem será enviada por todos os bots.\n');

  rl.on('line', line => {
    const msg = line.trim();
    if (!msg) return;

    // Check for inventory commands (starting with $)
    if (msg.startsWith('$')) {
      const parts = msg.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Process inventory commands
      switch (cmd) {
        case '$slot': {
          if (args.length === 0) {
            console.log('Erro: comando $slot requer <numero> (0-8)');
            return;
          }
          const slotNum = parseInt(args[0], 10);
          if (isNaN(slotNum)) {
            console.log('Erro: numero do slot deve ser um número inteiro.');
            return;
          }
          if (slotNum < 0 || slotNum > 8) {
            console.log('Erro: numero do slot deve estar entre 0 e 8 (hotbar).');
            return;
          }

          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                bot.setQuickBarSlot(slotNum);
                const heldItem = bot.heldItem;
                const itemName = heldItem && heldItem.type > 0 ? heldItem.name : 'ar';
                const itemCount = heldItem && heldItem.type > 0 ? heldItem.count : 0;
                console.log(`[${bot.username}] Slot hotbar selecionado: ${slotNum}. Item na mão: ${itemName} (${itemCount})`);
              } catch (error) {
                console.log(`[${bot.username}] Erro ao selecionar slot: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        case '$inv': {
          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                const slots = bot.inventory.slots;
                let invText = `[INVENTARIO DO ${bot.username}]:\n`;
                let hasItems = false;

                for (let i = 0; i < slots.length; i++) {
                  const item = slots[i];
                  if (item && item.type > 0) { // not air
                    hasItems = true;
                    invText += `Slot ${i}: ${item.name} (${item.count})\n`;
                  }
                }

                if (!hasItems) {
                  invText += ' (vazio)\n';
                }

                console.log(invText);
              } catch (error) {
                console.log(`[${bot.username}] Erro ao listar inventário: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        case '$drop': {
          let itemName = null;
          if (args.length > 0) {
            itemName = args.join(' ');
          }

          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                let itemToDrop = null;
                let slotIndex = -1;

                if (itemName) {
                  // Find specific item by name
                  const result = findItemByName(bot, itemName);
                  if (!result) {
                    console.log(`[${bot.username}] Item "${itemName}" não encontrado no inventário.`);
                    continue;
                  }
                  itemToDrop = result.item;
                  slotIndex = result.slot;
                } else {
                  // Drop item in hand
                  itemToDrop = bot.heldItem;
                  if (!itemToDrop || itemToDrop.type === 0) {
                    console.log(`[${bot.username}] Nada na mão para dropar.`);
                    continue;
                  }
                  // Find slot of held item (approximate - held item might not be in inventory slots)
                  for (let i = 0; i < bot.inventory.slots.length; i++) {
                    if (bot.inventory.slots[i] === itemToDrop) {
                      slotIndex = i;
                      break;
                    }
                  }
                }

                bot.tossStack(itemToDrop, null, (err) => {
                  if (err) {
                    console.log(`[${bot.username}] Erro ao dropar item: ${err.message}`);
                  } else {
                    const itemDesc = itemName || `${itemToDrop.name} (${itemToDrop.count})`;
                    console.log(`[${bot.username}] Dropar item: ${itemDesc}`);
                  }
                });
              } catch (error) {
                console.log(`[${bot.username}] Erro ao processar comando drop: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        case '$equip': {
          if (args.length === 0) {
            console.log('Erro: comando $equip requer <nome_item>');
            return;
          }
          const itemName = args.join(' ');

          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                const result = findItemByName(bot, itemName);
                if (!result) {
                  console.log(`[${bot.username}] Item "${itemName}" não encontrado no inventário.`);
                  continue;
                }

                const item = result.item;
                bot.equip(item, 'hand', (err) => {
                  if (err) {
                    console.log(`[${bot.username}] Erro ao equipar item: ${err.message}`);
                  } else {
                    console.log(`[${bot.username}] Equipou item: ${item.name}`);
                  }
                });
              } catch (error) {
                console.log(`[${bot.username}] Erro ao processar comando equip: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        case '$unequip': {
          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                const heldItem = bot.heldItem;
                if (!heldItem || heldItem.type === 0) {
                  console.log(`[${bot.username}] Nada na mão para desequipar.`);
                  continue;
                }

                bot.equip(null, 'hand', (err) => {
                  if (err) {
                    console.log(`[${bot.username}] Erro ao desequipar item: ${err.message}`);
                  } else {
                    console.log(`[${bot.username}] Desequipou item: ${heldItem.name}`);
                  }
                });
              } catch (error) {
                console.log(`[${bot.username}] Erro ao processar comando unequip: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        case '$move': {
          if (args.length < 2) {
            console.log('Erro: comando $move requer <slot_origem> <slot_destino>');
            return;
          }
          const srcSlot = parseInt(args[0], 10);
          const destSlot = parseInt(args[1], 10);

          if (isNaN(srcSlot) || isNaN(destSlot)) {
            console.log('Erro: numeros dos slots devem ser números inteiros.');
            return;
          }

          if (srcSlot < 0 || srcSlot > 35 || destSlot < 0 || destSlot > 35) {
            console.log('Erro: numeros dos slots devem estar entre 0 e 35 (inventário completo).');
            return;
          }

          // Apply to all bots that are ready
          for (const bot of bots) {
            if (bot.ready) {
              try {
                // Check if source slot has an item
                const srcItem = bot.inventory.slots[srcSlot];
                if (!srcItem || srcItem.type === 0) {
                  console.log(`[${bot.username}] Slot de origem ${srcSlot} está vazio.`);
                  continue;
                }

                // Move item: click source slot then destination slot
                bot.clickWindow(srcSlot, 0, 0, null, (err1) => {
                  if (err1) {
                    console.log(`[${bot.username}] Erro ao clicar slot origem: ${err1.message}`);
                    return;
                  }
                  bot.clickWindow(destSlot, 0, 0, null, (err2) => {
                    if (err2) {
                      console.log(`[${bot.username}] Erro ao clicar slot destino: ${err2.message}`);
                    } else {
                      console.log(`[${bot.username}] Movido item de slot ${srcSlot} para slot ${destSlot}`);
                    }
                  });
                });
              } catch (error) {
                console.log(`[${bot.username}] Erro ao processar comando move: ${error.message}`);
              }
            } else {
              console.log(`[${bot.username}] Bot não está pronto.`);
            }
          }
          break;
        }

        default:
          console.log(`Comando desconhecido: ${cmd}`);
          return;
      }
      return; // Important: don't fall through to chat sending
    }

    // Check if the line matches the pattern: <nick>: <message>
    const match = line.match(/^([^:]+):\s*(.+)/);
    if (match) {
      const [, targetNick, command] = match;
      const bot = bots.find(b => b.username.toLowerCase() === targetNick.toLowerCase());
      if (bot) {
        bot.chat(command.trim());
        console.log(`[COMANDO ENVIADO APENAS POR ${bot.username}] ${command.trim()}`);
      } else {
        console.log(`Bot com nick "${targetNick}" não encontrado. Enviando para todos os bots.`);
        // Fallback: send to all bots
        for (const b of bots) {
          b.chat(line);
        }
      }
    } else {
      // No specific target, send to all bots
      for (const bot of bots) {
        bot.chat(msg);
      }
      console.log(`[COMANDO ENVIADO POR TODOS OS BOTS] ${msg}`);
    }
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\nDesconectando todos os bots...');
    for (const bot of bots) {
      bot.end();
    }
    rl.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  rl.close();
});
