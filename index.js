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

// ================= STATE =================
let lastBotMessage = null;

// ================= READY =================
client.once("clientReady", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// ================= UTIL =================
function rupiah(val) {
  const num = Number(val) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

async function sendCleanReply(message, payload) {
  try {
    if (lastBotMessage) {
      await lastBotMessage.delete().catch(() => {});
    }

    const sent = await message.reply(payload);
    lastBotMessage = sent;
    return sent;
  } catch (err) {
    console.error("SEND CLEAN ERROR:", err);
  }
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(".")) return;

  const cmd = message.content.slice(1).trim().toLowerCase();

  // ============ PING ============
  if (cmd === "ping") {
    const temp = await sendCleanReply(message, "🏓 Pong...");
    const latency = temp.createdTimestamp - message.createdTimestamp;

    await temp.edit(
      `🏓 **Ping Pong!**\n⏱️ Latency: **${latency} ms** 🟢 **Bot Online**`
    );
    return;
  }

  // ============ HELP ============
  if (cmd === "help") {
    return sendCleanReply(
      message,
      "📖 **DAFTAR COMMAND**\n\n" +
        "• `.ping` → Cek respon bot\n" +
        "• `.stock` → Cek stok barang\n" +
        "• `.help` → Bantuan\n\n" +
        "✨ Pesan lama akan otomatis dibersihkan"
    );
  }

  // ============ STOCK ============
  if (cmd === "stock") {
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
      .slice(0, 25);

    if (!options.length) {
      return sendCleanReply(message, "❌ Tidak ada data barang.");
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_stock_item")
      .setPlaceholder("📦 Pilih nama barang")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    return sendCleanReply(message, {
      content:
        "🛒 **CEK STOK BARANG**\n" +
        "Silakan pilih barang di bawah ini:",
      components: [row],
    });
  }
});

// ================= DROPDOWN =================
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

  try {
    if (lastBotMessage) {
      await lastBotMessage.delete().catch(() => {});
    }

    const sent = await interaction.reply({
      content:
        "━━━━━━━━━━━━━━━━━━━\n" +
        "🛍️ **INFORMASI STOK BARANG**\n" +
        "━━━━━━━━━━━━━━━━━━━\n\n" +
        `📦 **Produk** : ${name}\n` +
        `📊 **Total Stok** : ${total}\n` +
        `💰 **Harga / @** : ${rupiah(price)}\n` +
        `${statusEmoji} **Status** : ${statusText}\n\n` +
        "📞 Hubungi admin @habzee untuk pemesanan\n" +
        "━━━━━━━━━━━━━━━━━━━",
    });

    lastBotMessage = sent;
  } catch (err) {
    console.error("INTERACTION ERROR:", err);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
