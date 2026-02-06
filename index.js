const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = ".";

client.once("ready", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  // Abaikan bot lain
  if (message.author.bot) return;

  // Harus diawali prefix
  if (!message.content.startsWith(PREFIX)) return;

  const command = message.content.slice(PREFIX.length).trim().toLowerCase();

  if (command === "ping") {
    const sent = await message.reply("🏓 ping...");
    const latency = sent.createdTimestamp - message.createdTimestamp;

    sent.edit(`🏓 **Ping Pong!**\n⏱️ ${latency} ms`);
  }
});

client.login(process.env.DISCORD_TOKEN);
