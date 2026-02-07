const { getCommands, getResponses } = require("./sheets");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = ".";

client.once("clientReady", async () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);

  try {
    const commands = await getCommands();
    const responses = await getResponses();

    console.log("COMMANDS:", commands);
    console.log("RESPONSES:", responses);
  } catch (err) {
    console.error("GAGAL BACA SHEET:", err.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
