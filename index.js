const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getStockMatrix, getSimpleList } = require("./sheets");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= CONFIG =================
const OWNER_ROLE_IDS = ["1469804991987454022"];
const SELLER_TAG = "<@habzee>";
const DROPDOWN_TIMEOUT = 30_000;

// ================= STATE =================
let lastBotMessage = null;

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
});

// ================= UTIL =================
function rupiah(val) {
  return "Rp " + Number(val || 0).toLocaleString("id-ID");
}

function isStaff(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => OWNER_ROLE_IDS.includes(r.id));
}

function autoDeleteCommand(message) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, 2000);
}

async function sendCleanReply(message, payload) {
  if (lastBotMessage) {
    await lastBotMessage.delete().catch(() => {});
  }
  const sent = await message.reply(payload);
  lastBotMessage = sent;
  return sent;
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(".")) return;

  autoDeleteCommand(message);

  const cmd = message.content.slice(1).trim().toLowerCase();
  const staff = isStaff(message.member);

  // ============ 🔥 PING (FIX FINAL) ============
  if (cmd === "ping") {
    const sent = await message.reply("🏓 **Ping...**");
    const latency = sent.createdTimestamp - message.createdTimestamp;

    return sent.edit(
      "🏓 **PING PONG!** 🏓\n\n" +
      `⏱️ **Latency** : **${latency} ms**\n` +
      "🟢 **Status** : **BOT ONLINE**"
    );
  }

  // ============ MENU ============
  if (cmd === "menu") {
    let text =
      "📜✨ **MENU BOT** ✨📜\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "👥 **CUSTOMER**\n" +
      "🛒 `.stock` → Cek stok produk\n" +
      "🍎 `.perma` → Produk FRUIT\n" +
      "🎮 `.gamepass` → Produk Game Pass\n" +
      "🏓 `.ping` → Cek status bot\n\n";

    if (staff) {
      text +=
        "━━━━━━━━━━━━━━━━━━\n" +
        "🧠 **OWNER / STAFF**\n" +
        "📊 `.stock` → Detail stok per akun\n\n";
    }

    return sendCleanReply(message, text);
  }

  // ============ STOCK ============
  if (cmd === "stock") {
    const data = await getStockMatrix();

    const options = data.items
      .map((name, i) =>
        name ? { label: name, value: String(i), emoji: "📦" } : null
      )
      .filter(Boolean)
      .slice(0, 25);

    if (!options.length) {
      return sendCleanReply(message, "❌ Tidak ada data stok.");
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(staff ? "stock_staff" : "stock_user")
      .setPlaceholder("📦 Pilih produk")
      .addOptions(options);

    return sendCleanReply(message, {
      content: staff
        ? "🧠📊 **MODE STAFF — DETAIL STOK**"
        : "🛒✨ **CEK STOK PRODUK**",
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  // ============ PERMA ============
  if (cmd === "perma") {
    return listCommand(message, "FRUIT", "🍎");
  }

  // ============ GAMEPASS ============
  if (cmd === "gamepass") {
    return listCommand(message, "GP", "🎮");
  }
});

// ================= LIST COMMAND =================
async function listCommand(message, sheet, emoji) {
  const list = await getSimpleList(sheet);
  if (!list.length) {
    return sendCleanReply(message, "❌ Data kosong.");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`list_${sheet}`)
    .setPlaceholder("📦 Pilih produk")
    .addOptions(
      list.slice(0, 25).map((v, i) => ({
        label: v.name,
        value: String(i),
        emoji,
      }))
    );

  return sendCleanReply(message, {
    content: `${emoji}✨ **DAFTAR PRODUK** ✨${emoji}`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

// ================= INTERACTION =================
client.on("interactionCreate", async (i) => {
  if (!i.isStringSelectMenu()) return;

  setTimeout(() => {
    i.deleteReply().catch(() => {});
  }, DROPDOWN_TIMEOUT);

  const data = await getStockMatrix();

  if (i.customId === "stock_user") {
    const idx = Number(i.values[0]);
    return i.reply({
      content:
        `📦 **${data.items[idx]}**\n` +
        `📊 Stok : **${data.totals[idx]}**\n` +
        `💰 Harga : **${rupiah(data.prices[idx])}**\n` +
        `🟢 Status : **${data.totals[idx] > 0 ? "READY" : "HABIS"}**\n\n` +
        `📞 Seller : ${SELLER_TAG}`,
    });
  }

  if (i.customId === "stock_staff") {
    const idx = Number(i.values[0]);
    let detail = "";

    data.owners.forEach((o, r) => {
      const val = data.perOwner[r]?.[idx];
      if (val) detail += `👤 **${o}** → ${val}\n`;
    });

    return i.reply(
      `📦 **${data.items[idx]}**\n\n${detail}\n📊 Total : **${data.totals[idx]}**`
    );
  }

  if (i.customId.startsWith("list_")) {
    const sheet = i.customId.split("_")[1];
    const list = await getSimpleList(sheet);
    const item = list[Number(i.values[0])];

    return i.reply(
      `🛍️ **${item.name}**\n` +
      `💰 Harga : **${item.price ? rupiah(item.price) : "❌"}**\n` +
      `🟢 Status : **${item.price ? "READY" : "KOSONG"}**\n\n` +
      `📞 Seller : ${SELLER_TAG}`
    );
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
