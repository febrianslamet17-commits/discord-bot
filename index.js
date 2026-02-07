const { Client, GatewayIntentBits } = require("discord.js");
const { getCommands, getResponses } = require("./sheets");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= READY =================
client.once("clientReady", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  try {
    // abaikan bot
    if (message.author.bot) return;

    // hanya command bertitik
    if (!message.content.startsWith(".")) return;

    const input = message.content.slice(1).trim().toLowerCase();
    if (!input) return;

    // ambil data dari Google Sheets
    const commands = await getCommands();
    const responses = await getResponses();

    // ================= CARI COMMAND (DEFENSIF) =================
    const cmd = commands.find((row) => {
      if (!row || row.length < 5) return false;

      const command = row[0];
      const status = row[4];

      if (!command || !status) return false;

      return status === "active" && command === input;
    });

    if (!cmd) return;

    const responseKey = cmd[2];
    if (!responseKey) return;

    // ================= CARI RESPONSE (DEFENSIF) =================
    const response = responses.find(
      (row) => row && row[0] === responseKey && row[1]
    );

    if (!response) return;

    let template = response[1];

    // ================= HANDLE LATENCY =================
    if (template.includes("{{latency}}")) {
      const sent = await message.reply("⏳");
      const latency = sent.createdTimestamp - message.createdTimestamp;
      template = template.replace("{{latency}}", latency);
      return sent.edit(template);
    }

    // ================= BALAS NORMAL =================
    return message.reply(template);
  } catch (err) {
    console.error("ERROR MESSAGE HANDLER:", err);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
