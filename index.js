const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { getStockMatrix, getSimpleList } = require("./sheets");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// ================= CONFIG =================
const OWNER_ROLE_IDS = ["1469804991987454022"];
const SELLER_TAG = "<@habzee>";
const BOT_REPLY_TTL = 20_000;
const BELI_LIMIT_PER_DAY = 2;

// ================= STATE =================
const userState = new Map(); // channelId:userId
const beliUsage = new Map(); // userId -> { date, count }

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
  setTimeout(() => message.delete().catch(() => {}), 1000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function sendUserScopedReply(message, payload, ttl = BOT_REPLY_TTL) {
  const key = `${message.channelId}:${message.author.id}`;
  const prev = userState.get(key);

  if (prev?.botMessage) {
    await prev.botMessage.delete().catch(() => {});
    clearTimeout(prev.timeout);
  }

  const botMessage = await message.reply(payload);

  const timeout = setTimeout(() => {
    botMessage.delete().catch(() => {});
    userState.delete(key);
  }, ttl);

  userState.set(key, { botMessage, timeout });
  return botMessage;
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(".")) return;

  autoDeleteCommand(message);

  const cmd = message.content.slice(1).trim().toLowerCase();
  const staff = isStaff(message.member);

  // ============ PING ============
  if (cmd === "ping") {
    const sent = await message.reply("🏓 **Ping...**");
    const latency = sent.createdTimestamp - message.createdTimestamp;

    setTimeout(() => sent.delete().catch(() => {}), BOT_REPLY_TTL);

    return sent.edit(
      "🏓 **PING PONG!** 🏓\n\n" +
        `⏱️ **Latency** : **${latency} ms**\n` +
        "🟢 **Status** : **BOT ONLINE**"
    );
  }

  // ============ BELI (ANTI ABUSE + DM) ============
  if (cmd === "beli") {
    const userId = message.author.id;

    // ---- LIMIT UNTUK USER BIASA ----
    if (!staff) {
      const today = todayKey();
      const usage = beliUsage.get(userId);

      if (!usage || usage.date !== today) {
        beliUsage.set(userId, { date: today, count: 1 });
      } else {
        if (usage.count >= BELI_LIMIT_PER_DAY) {
          return sendUserScopedReply(
            message,
            "⛔ **Batas Penggunaan Tercapai**\n\n" +
              "🛍️ Fitur **`.beli` hanya bisa digunakan 2x per hari**.\n" +
              "⏳ Silakan coba kembali **besok**.\n\n" +
              "🙏 Terima kasih atas pengertiannya",
            60_000
          );
        }
        usage.count++;
      }
    }

    // ---- BUTTONS (WA + DISCORD + TELEGRAM) ----
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("💬 WhatsApp")
        .setStyle(ButtonStyle.Link)
        .setURL("https://wa.me/6285156066467"),

      new ButtonBuilder()
        .setLabel("💠 Discord Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/s8Cj5CEZqB"),

      new ButtonBuilder()
        .setLabel("🤖 Telegram Bot")
        .setStyle(ButtonStyle.Link)
        .setURL("https://t.me/QodirStockBot")
    );

    // ---- DM ----
    try {
      await message.author.send({
        content:
          "🛒✨ **INFORMASI PEMBELIAN** ✨🛒\n" +
          "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
          "📱 **WhatsApp — Fast Response**\n" +
          "💠 **Discord — Diskusi & Update**\n" +
          "🤖 **Telegram Bot — Otomatis**\n\n" +
          "━━━━━━━━━━━━━━━━━━━━━━\n" +
          "⚡ **Fast response via WhatsApp**\n" +
          "📥 Pesan dibalas satu per satu\n" +
          "⏳ Jika belum dibalas berarti **antri / toko sedang offline**\n\n" +
          "🙏 Terima kasih atas kesabaran dan orderannya ❤️",
        components: [buttons],
      });
    } catch (err) {
      // ---- DM GAGAL ----
      return sendUserScopedReply(
        message,
        "❌ **GAGAL MENGIRIM DM**\n\n" +
          "🔒 DM kamu kemungkinan **dinonaktifkan**.\n\n" +
          "📌 **Cara mengaktifkan DM Discord:**\n" +
          "1️⃣ Klik **Nama Server**\n" +
          "2️⃣ Pilih **Privacy Settings**\n" +
          "3️⃣ Aktifkan **Allow Direct Messages**\n" +
          "4️⃣ Ketik **`.beli`** lagi\n\n" +
          "🙏 Setelah DM aktif, bot akan mengirimkan info pembelian otomatis",
        60_000
      );
    }

    return;
  }

  // ============ MENU ============
  if (cmd === "menu") {
    let text =
      "📜✨ **MENU BOT** ✨📜\n\n" +
      "👥 **CUSTOMER**\n" +
      "🛒 `.stock` → Cek stok produk\n" +
      "🍎 `.perma` → Produk FRUIT\n" +
      "🎮 `.gamepass` → Produk Game Pass\n" +
      "🛍️ `.beli` → Cara pembelian\n" +
      "🏓 `.ping` → Status bot\n\n";

    if (staff) {
      text +=
        "━━━━━━━━━━━━━━━━━━\n" +
        "🧠 **OWNER / STAFF**\n" +
        "📊 `.stock` → Detail stok per akun\n\n";
    }

    return sendUserScopedReply(message, text);
  }

  // ============ STOCK ============
  if (cmd === "stock") {
    const data = await getStockMatrix();

    const menu = new StringSelectMenuBuilder()
      .setCustomId(staff ? "stock_staff" : "stock_user")
      .setPlaceholder("📦 Pilih produk")
      .addOptions(
        data.items
          .map((v, i) => v && ({ label: v, value: String(i), emoji: "📦" }))
          .filter(Boolean)
          .slice(0, 25)
      );

    return sendUserScopedReply(message, {
      content: staff
        ? "🧠📊 **MODE STAFF — DETAIL STOK**"
        : "🛒✨ **CEK STOK PRODUK**",
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  }

  // ============ PERMA ============
  if (cmd === "perma") return listCommand(message, "FRUIT", "🍎");

  // ============ GAMEPASS ============
  if (cmd === "gamepass") return listCommand(message, "GP", "🎮");
});

// ================= LIST COMMAND =================
async function listCommand(message, sheet, emoji) {
  const list = await getSimpleList(sheet);
  if (!list.length) {
    return sendUserScopedReply(message, "❌ Data kosong.");
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

  return sendUserScopedReply(message, {
    content: `${emoji}✨ **DAFTAR PRODUK**`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

// ================= INTERACTION =================
client.on("interactionCreate", async (i) => {
  if (!i.isStringSelectMenu()) return;

  const key = `${i.channelId}:${i.user.id}`;
  const prev = userState.get(key);

  if (prev?.botMessage) {
    await prev.botMessage.delete().catch(() => {});
    clearTimeout(prev.timeout);
  }

  const data = await getStockMatrix();
  let content = "";

  if (i.customId === "stock_user") {
    const idx = Number(i.values[0]);
    content =
      `📦 **${data.items[idx]}**\n` +
      `📊 Stok : **${data.totals[idx]}**\n` +
      `💰 Harga : **${rupiah(data.prices[idx])}**\n` +
      `🟢 Status : **${data.totals[idx] > 0 ? "READY" : "HABIS"}**\n\n` +
      `📞 Seller : ${SELLER_TAG}`;
  }

  if (i.customId === "stock_staff") {
    const idx = Number(i.values[0]);
    let detail = "";
    data.owners.forEach((o, r) => {
      const v = data.perOwner[r]?.[idx];
      if (v) detail += `👤 ${o} → ${v}\n`;
    });
    content = `📦 **${data.items[idx]}**\n\n${detail}`;
  }

  if (i.customId.startsWith("list_")) {
    const sheet = i.customId.split("_")[1];
    const list = await getSimpleList(sheet);
    const item = list[Number(i.values[0])];
    content =
      `🛍️ **${item.name}**\n` +
      `💰 Harga : **${item.price ? rupiah(item.price) : "❌"}**\n` +
      `🟢 Status : **${item.price ? "READY" : "KOSONG"}**\n\n` +
      `📞 Seller : ${SELLER_TAG}`;
  }

  const botMessage = await i.reply({ content, fetchReply: true });

  const timeout = setTimeout(() => {
    botMessage.delete().catch(() => {});
    userState.delete(key);
  }, BOT_REPLY_TTL);

  userState.set(key, { botMessage, timeout });
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
