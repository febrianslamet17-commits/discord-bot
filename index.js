const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

const commands = [
  { name: "ping", description: "Test bot hidup" }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Slash command siap.");
  } catch (e) {
    console.error(e);
  }
})();

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === "ping") await i.reply("pong");
});

client.login(process.env.DISCORD_TOKEN);
