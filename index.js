const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const {
  getCommands,
  getResponses,
  getStockView,
} = require("./sheets");

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

// ================= FORMAT =================
function formatNumber(val) {
  return Number(val) || 0;
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(".")) return;

    const input = message.content.slice(1).trim().toLowerCase();
    if (!input) return;

    // ================= STOCK (DROPDOWN) =================
    if (input === "stock") {
      const { items } = await getStockView();

      const options = items
        .map((item, index) => item ? {
          label: item,
          value: String(index),
        } : null)
        .filter(Boolean)
        .slice(0, 25);

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_stock_item")
        .setPlaceholder("📦 Pilih nama barang")
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(menu);

      return message.reply({
        content: "🛒 **Pilih barang untuk cek stok:**",
        components: [row],
      });
    }

    // ================= COMMAND TEXT (PING DLL) =================
    const commands = await getCommands();
    const responses = await getResponses();

    const cmd = commands.find(
      (row) =>
        row &&
        row[0] === input &&
        row[4] === "active"
    );

    if (!cmd) return;

    const responseKey = cmd[2];
    const response = responses.find(
      (row) => row && row[0] === responseKey
    );
    if (!response) return;

    let template = response[1];

    if (template.includes("{{latency}}")) {
      const sent = await message.reply("⏳");
      const latency =
        sent.createdTimestamp - message.createdTimestamp;
      return sent.edit(
        template.replace("{{latency}}", latency)
      );
    }

    return message.reply(template);
  } catch (err) {
    console.error("ERROR MESSAGE:", err);
  }
});

// ================= DROPDOWN INTERACTION =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "select_stock_item") return;

  const index = Number(interaction.values[0]);
  const { items, totals } = await getStockView();

  const name = items[index];
  const total = formatNumber(totals[index]);
  const statusEmoji = total > 0 ? "🟢" : "🔴";
  const statusText = total > 0 ? "READY" : "HABIS";

  return interaction.reply({
    content:
      `🛒 **INFORMASI STOK BARANG**\n\n` +
      `📦 Nama Barang : **${name}**\n` +
      `📊 Total Stok  : **${total}**\n` +
      `${statusEmoji} Status      : **${statusText}**`,
  });
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
