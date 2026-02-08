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

// WHITELIST CHANNEL UNTUK .clear
const CLEAR_WHITELIST_CHANNEL_IDS = [
  "489457795444506624", // channel yang BOLEH di clear
];

const SELLER_TAG = "<@habzee>";
const BOT_REPLY_TTL = 20_000;
const BELI_LIMIT_PER_DAY = 2;

// ================= STATE =================
// per user per channel
const userState = new Map(); // key = channelId:userId

// limit .beli
const beliUsage = new Map(); // userId -> { date, count }

// state konfirmasi .clear
// key = channelId:userId -> step (1 | 2)
const clearConfirmState = new Map();

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
  return member.roles.cache.some(r =>
    OWNER_ROLE_IDS.includes(r.id)
  );
}

function autoDeleteCommand(message) {
  setTimeout(() => message.delete().catch(() => {}), 1000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// AUTO DELETE BOT PER USER
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

  // ============ BELI ============
  if (cmd === "beli") {
    const userId = message.author.id;

    if (!staff) {
      const today = todayKey();
      const usage = beliUsage.get(userId);

      if (!usage || usage.date !== today) {
        beliUsage.set(userId, { date: today, count: 1 });
      } else {
        if (usage.count >= BELI_LIMIT_PER_DAY) {
          return sendUserScopedReply(
            message,
            "⛔ **BATAS HARIAN TERCAPAI**\n\n" +
              "Fitur **`.beli` hanya bisa digunakan 2x per hari**.\n" +
              "Silakan coba kembali **besok**.\n\n" +
              "🙏 Terima kasih atas pengertiannya",
            60_000
          );
        }
        usage.count++;
      }
    }

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

    try {
      await message.author.send({
        content:
          "🛒✨ **INFORMASI PEMBELIAN** ✨🛒\n" +
          "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
          "📱 **WhatsApp — Fast Response**\n" +
          "💠 **Discord — Diskusi & Update**\n" +
          "🤖 **Telegram Bot — Otomatis**\n\n" +
          "━━━━━━━━━━━━━━━━━━━━━━\n" +
          "⚡ Fast response via WhatsApp\n" +
          "📥 Pesan dibalas satu per satu\n" +
          "⏳ Jika belum dibalas berarti **antri / toko offline**\n\n" +
          "🙏 Terima kasih atas kesabaran dan orderannya ❤️",
        components: [buttons],
      });
    } catch {
      return sendUserScopedReply(
        message,
        "❌ **GAGAL MENGIRIM DM**\n\n" +
          "🔒 DM kamu **nonaktif**.\n\n" +
          "📌 **Cara mengaktifkan DM:**\n" +
          "1️⃣ Klik **Nama Server**\n" +
          "2️⃣ **Privacy Settings**\n" +
          "3️⃣ Aktifkan **Allow Direct Messages**\n" +
          "4️⃣ Ketik **`.beli`** lagi",
        60_000
      );
    }

    return;
  }

  // ============ MENU ============
  if (cmd === "menu") {
    let text =
      "📜✨ **MENU BOT** ✨📜\n\n" +
      "👥 CUSTOMER\n" +
      "🛒 `.stock`\n" +
      "🍎 `.perma`\n" +
      "🎮 `.gamepass`\n" +
      "🛍️ `.beli`\n" +
      "🏓 `.ping`\n\n";

    if (staff) {
      text +=
        "━━━━━━━━━━━━━━━━━━\n" +
        "🧠 OWNER / STAFF\n" +
        "📊 `.stock` (detail akun)\n" +
        "🧹 `.clear` (hapus channel)\n\n";
    }

    return sendUserScopedReply(message, text);
  }

  // ============ CLEAR (STAFF ONLY + WHITELIST) ============
  if (cmd === "clear" && staff) {
    if (!CLEAR_WHITELIST_CHANNEL_IDS.includes(message.channelId)) {
      return sendUserScopedReply(
        message,
        "⛔ **AKSES DITOLAK**\n\n" +
          "Perintah **`.clear` tidak diizinkan di channel ini**.",
        30_000
      );
    }

    const key = `${message.channelId}:${message.author.id}`;
    clearConfirmState.set(key, 1);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("clear_yes_1")
        .setLabel("✅ YA")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("clear_no")
        .setLabel("❌ TIDAK")
        .setStyle(ButtonStyle.Secondary)
    );

    return sendUserScopedReply(
      message,
      {
        content:
          "⚠️ **PERINGATAN** ⚠️\n\n" +
          "Apakah Anda yakin ingin **menghapus semua pesan di channel ini?**",
        components: [row],
      },
      60_000
    );
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

  if (cmd === "perma") return listCommand(message, "FRUIT", "🍎");
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

// ================= INTERACTION (BUTTON + SELECT) =================
client.on("interactionCreate", async (i) => {
  // ===== BUTTON CLEAR =====
  if (i.isButton()) {
    const key = `${i.channelId}:${i.user.id}`;
    const step = clearConfirmState.get(key);

    if (i.customId === "clear_no") {
      clearConfirmState.delete(key);
      return i.reply({
        content: "❎ **Perintah dibatalkan.**",
        ephemeral: true,
      });
    }

    if (i.customId === "clear_yes_1" && step === 1) {
      clearConfirmState.set(key, 2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("clear_yes_2")
          .setLabel("🔥 YA, SAYA YAKIN")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("clear_no")
          .setLabel("❌ BATAL")
          .setStyle(ButtonStyle.Secondary)
      );

      return i.update({
        content:
          "🚨 **KONFIRMASI TERAKHIR** 🚨\n\n" +
          "**Anda BENAR-BENAR yakin ingin menghapus semua pesan di channel ini?**",
        components: [row],
      });
    }

    if (i.customId === "clear_yes_2" && step === 2) {
      clearConfirmState.delete(key);

      await i.reply({
        content: "🧹 **Menghapus pesan...**",
        ephemeral: true,
      });

      let fetched;
      do {
        fetched = await i.channel.messages.fetch({ limit: 100 });
        const deletable = fetched.filter(
          m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
        );
        if (deletable.size === 0) break;
        await i.channel.bulkDelete(deletable, true);
      } while (fetched.size >= 2);

      return;
    }
  }

  // ===== SELECT MENU =====
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
