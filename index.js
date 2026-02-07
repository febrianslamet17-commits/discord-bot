const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getStockMatrix } = require("./sheets");

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
function rupiah(val) {
  const num = Number(val) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

// ================= .stock =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== ".stock") return;

  const { items } = await getStockMatrix();

  const options = items
    .map((name, index) =>
      name
        ? {
            label: name,
            value: String(index),
            emoji: "📦",
          }
        : null
    )
    .filter(Boolean)
    .slice(0, 25); // limit Discord

  if (!options.length) {
    return message.reply("❌ Tidak ada data barang.");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_stock_item")
    .setPlaceholder("📦 Pilih nama barang")
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);

  return message.reply({
    content:
      "🛒 **CEK STOK BARANG**\n" +
      "Silakan pilih barang di bawah ini:",
    components: [row],
  });
});

// ================= PILIH BARANG =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "select_stock_item") return;

  const index = Number(interaction.values[0]);
  const { items, totals, prices } = await getStockMatrix();

  const name = items[index];
  const total = Number(totals[index]) || 0;
  const price = prices[index] || 0;

  const statusEmoji = total > 0 ? "🟢" : "🔴";
  const statusText = total > 0 ? "READY" : "HABIS";

  return interaction.reply({
    content:
      "━━━━━━━━━━━━━━━━━━━\n" +
      "🛍️ **INFORMASI STOK BARANG**\n" +
      "━━━━━━━━━━━━━━━━━━━\n\n" +
      `📦 **Produk** : ${name}\n` +
      `📊 **Total Stok** : ${total}\n` +
      `💰 **Harga / @** : ${rupiah(price)}\n` +
      `${statusEmoji} **Status** : ${statusText}\n\n` +
      "📞 Hubungi admin untuk pemesanan\n" +
      "━━━━━━━━━━━━━━━━━━━",
  });
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
