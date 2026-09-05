import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { initDB } from './db.js';
import { startPoller } from './poller.js';
import * as trackCommand from './commands/track.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
client.commands.set(trackCommand.data.name, trackCommand);

client.once(Events.ClientReady, async () => {
  console.log(`✅ ล็อกอินสำเร็จ: ${client.user.tag}`);
  await initDB();
  startPoller(client);
  console.log(`⏱️  เช็คอัปเดตทุก ${process.env.POLL_INTERVAL_MINUTES || 10} นาที`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const reply = { content: '❌ เกิดข้อผิดพลาดขณะรันคำสั่ง', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

client.login(process.env.DISCORD_TOKEN);
