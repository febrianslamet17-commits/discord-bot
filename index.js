const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getStockView } = require("./sheets");

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

// ================= FORMAT RUPIAH =================
function formatRupiah(angka) {
  if (!angka) return "-";
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

// ================= MESSAGE (.stock) =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== ".stock") return;

  const { items } = await getStockView();

  if (!items.length) {
    return message.reply("❌ Tidak ada data barang.");
  }

  // Discord limit: max 25 option
  const options = items.slice(0, 25).map((item, index) => ({
    label: item,
    value: String(index),
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_stock_item")
    .setPlaceholder("📦 Pilih nama barang")
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);

  return message.reply({
    content: "🛒 **Pilih barang untuk cek stok:**",
    components: [row],
  });
});

// ================= INTERACTION (PILIH BARANG) =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "select_stock_item") return;

  const index = Number(interaction.values[0]);

  const { items, totals, prices } = await getStockView();

  const name = items[index];
  const total = Number(totals[index]) || 0;
  const price = prices[index] || 0;

  const statusEmoji = total > 0 ? "🟢" : "🔴";
  const statusText = total > 0 ? "READY" : "HABIS";

  return interaction.reply({
    content:
      `🛒 **INFORMASI STOK BARANG**\n\n` +
      `📦 Nama Barang : **${name}**\n` +
      `📊 Total Stok  : **${total}**\n` +
      `💰 Harga / @   : **${formatRupiah(price)}**\n` +
      `${statusEmoji} Status      : **${statusText}**\n\n` +
      `✨ Silakan hubungi admin untuk pemesanan`,
    ephemeral: false,
  });
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
