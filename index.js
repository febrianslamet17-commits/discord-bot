require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { getCommands, getResponses } = require("./sheets");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// === BOT READY ===
client.once("clientReady", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// === MESSAGE HANDLER (.command) ===
client.on("messageCreate", async (message) => {
  try {
    // abaikan bot
    if (message.author.bot) return;

    // hanya proses pesan diawali titik
    if (!message.content.startsWith(".")) return;

    const input = message.content.slice(1).trim().toLowerCase();
    if (!input) return;

    // ambil data dari sheet
    const commands = await getCommands();
    const responses = await getResponses();

    // cari command yang aktif
    const cmd = commands.find(
      ([command, , , , status]) =>
        status === "active" && command === input
    );

    if (!cmd) return;

    const [, , responseKey] = cmd;

    const response = responses.find(([key]) => key === responseKey);
    if (!response) return;

    let template = response[1];

    // handle latency
    if (template.includes("{{latency}}")) {
      const sent = await message.reply("⏳");
      const latency = sent.createdTimestamp - message.createdTimestamp;
      template = template.replace("{{latency}}", latency);
      return sent.edit(template);
    }

    // balasan biasa
    return message.reply(template);
  } catch (err) {
    console.error("ERROR MESSAGE HANDLER:", err.message);
  }
});

// === LOGIN ===
client.login(process.env.DISCORD_TOKEN);
