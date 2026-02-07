const { Client, GatewayIntentBits } = require("discord.js");
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

// ================= FORMAT RUPIAH =================
function formatRupiah(angka) {
  if (!angka) return "-";
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(".")) return;

    const input = message.content.slice(1).trim().toLowerCase();
    if (!input) return;

    // ================= STOCK COMMAND =================
    if (input.startsWith("stock")) {
      const query = input.replace("stock", "").trim().toLowerCase();
      if (!query) {
        return message.reply(
          "❗ **Format salah**\nGunakan:\n`.stock nama_barang`"
        );
      }

      const { items, totals, prices } = await getStockView();

      const index = items.findIndex(
        (item) => item && item.toLowerCase() === query
      );

      if (index === -1) {
        return message.reply(
          "❌ **Barang tidak ditemukan**\nPeriksa kembali nama barang."
        );
      }

      const total = Number(totals[index]) || 0;
      const price = prices[index] || 0;
      const statusEmoji = total > 0 ? "🟢" : "🔴";
      const statusText = total > 0 ? "READY" : "HABIS";

      return message.reply(
        `🛒 **INFORMASI STOK BARANG**\n\n` +
        `📦 Nama Barang : **${items[index]}**\n` +
        `📊 Total Stok  : **${total}**\n` +
        `💰 Harga / @   : **${formatRupiah(price)}**\n` +
        `${statusEmoji} Status      : **${statusText}**\n\n` +
        `✨ Silakan hubungi admin untuk pemesanan`
      );
    }

    // ================= COMMAND LAIN =================
    const commands = await getCommands();
    const responses = await getResponses();

    const cmd = commands.find(
      (row) => row && row[0] === input && row[4] === "active"
    );

    if (!cmd) return;

    const responseKey = cmd[2];
    const response = responses.find(
      (row) => row && row[0] === responseKey && row[1]
    );
    if (!response) return;

    let template = response[1];

    if (template.includes("{{latency}}")) {
      const sent = await message.reply("⏳");
      const latency =
        sent.createdTimestamp - message.createdTimestamp;
      return sent.edit(template.replace("{{latency}}", latency));
    }

    return message.reply(template);
  } catch (err) {
    console.error("ERROR MESSAGE HANDLER:", err);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
