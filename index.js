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
const BOT_REPLY_TTL = 20_000;

// ================= USER STATE =================
// key = channelId:userId
const userState = new Map();

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

// 🔥 INTI AUTO DELETE PER USER
async function sendUserScopedReply(message, payload) {
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
  }, BOT_REPLY_TTL);

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

  // ============ PING (TIDAK MASUK AUTO DELETE BOT) ============
  if (cmd === "ping") {
    const sent = await message.reply("🏓 **Ping...**");
    const latency = sent.createdTimestamp - message.createdTimestamp;

    setTimeout(() => sent.delete().catch(() => {}), BOT_REPLY_TTL);

    return sent.edit(
      "🏓 **PING PONG!**\n\n" +
      `⏱️ Latency : **${latency} ms**\n` +
      "🟢 Status : **BOT ONLINE**"
    );
  }

  // ============ MENU ============
  if (cmd === "menu") {
    let text =
      "📜✨ **MENU BOT** ✨📜\n\n" +
      "👥 CUSTOMER\n" +
      "🛒 `.stock`\n" +
      "🍎 `.perma`\n" +
      "🎮 `.gamepass`\n\n";

    if (staff) {
      text += "🧠 STAFF\n📊 `.stock` (detail akun)\n\n";
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
      content: staff ? "🧠 MODE STAFF" : "🛒 CEK STOK",
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
