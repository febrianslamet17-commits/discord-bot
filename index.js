const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const { google } = require("googleapis");
const { getStockMatrix, getSimpleList } = require("./sheets");

// ================= CLIENT =================
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
const CLEAR_WHITELIST_CHANNEL_IDS = ["489457795444506624"];

const BOT_REPLY_TTL = 20_000;
const BELI_LIMIT_PER_DAY = 2;
const AKUN_LIMIT_PER_DAY = 2;

// GOOGLE DRIVE
const DRIVE_FOLDER_ID = "1VRiR6OWMADt0N-SzcQN8IExveR-tJhE8";

// ================= STATE =================
const userState = new Map();     // per user per channel
const beliUsage = new Map();     // .beli limit
const akunUsage = new Map();     // .akun limit
const clearConfirmState = new Map();

// ================= GOOGLE DRIVE =================
const driveAuth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth: driveAuth });

// ================= READY =================
client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
});

// ================= UTIL =================
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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

// ================= DRIVE HELPER =================
async function getImagesFromDrive() {
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and mimeType contains 'image/'`,
    fields: "files(id, name)",
    pageSize: 100,
  });
  return res.data.files || [];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
    const sent = await message.reply("🏓 Ping...");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    setTimeout(() => sent.delete().catch(() => {}), BOT_REPLY_TTL);

    return sent.edit(
      `🏓 **PING PONG!**\n\n⏱️ ${latency} ms\n🟢 BOT ONLINE`
    );
  }

  // ============ AKUN (FINAL) ============
  if (cmd === "akun") {
    const userId = message.author.id;

    if (!staff) {
      const today = todayKey();
      const usage = akunUsage.get(userId);

      if (!usage || usage.date !== today) {
        akunUsage.set(userId, { date: today, count: 1 });
      } else {
        if (usage.count >= AKUN_LIMIT_PER_DAY) {
          return sendUserScopedReply(
            message,
            "⛔ **BATAS HARIAN TERCAPAI**\n\n" +
              "📂 Fitur **`.akun` hanya bisa digunakan 2x per hari**.\n" +
              "⏳ Silakan coba kembali besok.",
            60_000
          );
        }
        usage.count++;
      }
    }

    let files;
    try {
      files = await getImagesFromDrive();
    } catch {
      return sendUserScopedReply(
        message,
        "❌ **GAGAL MENGAMBIL DATA AKUN**",
        60_000
      );
    }

    if (!files.length) {
      return sendUserScopedReply(
        message,
        "📂 **BELUM ADA AKUN TERSEDIA**",
        60_000
      );
    }

    const waButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("💬 WhatsApp – Saya mau beli akun")
        .setStyle(ButtonStyle.Link)
        .setURL(
          "https://wa.me/6285156066467?text=" +
            encodeURIComponent("Halo, saya mau beli akun")
        )
    );

    try {
      await message.author.send(
        "📂✨ **DAFTAR AKUN TERSEDIA** ✨📂\n" +
          "━━━━━━━━━━━━━━━━━━\n" +
          "Scroll DM untuk melihat semua gambar.\n"
      );

      const batches = chunkArray(files, 5);

      for (const batch of batches) {
        const attachments = batch.map(
          f =>
            new AttachmentBuilder(
              `https://drive.google.com/uc?id=${f.id}`,
              { name: f.name }
            )
        );

        await message.author.send({
          files: attachments,
          components: [waButton],
        });

        await new Promise(res => setTimeout(res, 1500));
      }
    } catch {
      return sendUserScopedReply(
        message,
        "❌ **GAGAL MENGIRIM DM**\n\n" +
          "🔒 Aktifkan **Allow Direct Messages** di server ini,\n" +
          "lalu ketik **`.akun`** lagi.",
        60_000
      );
    }

    return;
  }

  // ============ MENU ============
  if (cmd === "menu") {
    let text =
      "📜 **MENU BOT**\n\n" +
      "🛒 `.stock`\n" +
      "🍎 `.perma`\n" +
      "🎮 `.gamepass`\n" +
      "📂 `.akun`\n" +
      "🛍️ `.beli`\n" +
      "🏓 `.ping`\n\n";

    if (staff) {
      text += "🧠 STAFF: `.clear`\n";
    }

    return sendUserScopedReply(message, text);
  }

  // ============ CLEAR ============
  if (cmd === "clear" && staff) {
    if (!CLEAR_WHITELIST_CHANNEL_IDS.includes(message.channelId)) {
      return sendUserScopedReply(
        message,
        "⛔ `.clear` tidak diizinkan di channel ini.",
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
          "⚠️ **YAKIN HAPUS SEMUA PESAN DI CHANNEL INI?**",
        components: [row],
      },
      60_000
    );
  }
});

// ================= INTERACTION =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const key = `${i.channelId}:${i.user.id}`;
  const step = clearConfirmState.get(key);

  if (i.customId === "clear_no") {
    clearConfirmState.delete(key);
    return i.reply({ content: "❎ Dibatalkan.", ephemeral: true });
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
      content: "🚨 **ANDA BENAR-BENAR YAKIN?**",
      components: [row],
    });
  }

  if (i.customId === "clear_yes_2" && step === 2) {
    clearConfirmState.delete(key);
    await i.reply({ content: "🧹 Menghapus pesan...", ephemeral: true });

    let fetched;
    do {
      fetched = await i.channel.messages.fetch({ limit: 100 });
      const deletable = fetched.filter(
        m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );
      if (!deletable.size) break;
      await i.channel.bulkDelete(deletable, true);
    } while (fetched.size >= 2);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
