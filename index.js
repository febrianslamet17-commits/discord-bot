const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getStockMatrix, getList } = require("./sheets");

/**
 * ================= ROLE CONFIG =================
 * GANTI DENGAN ROLE ID SERVER ANDA
 */
const OWNER_ROLE_IDS = [
  "1469804991987454022", // ROLE OWNER
];

const SELLER_TAG = "<@habzee>";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
});

/**
 * ================= UTILS =================
 */
function isStaff(member) {
  // JIKA DM / BUKAN GUILD → FALSE
  if (!member || !member.roles) return false;

  return member.roles.cache.some(role =>
    OWNER_ROLE_IDS.includes(role.id)
  );
}

function rupiah(val) {
  return "Rp " + Number(val || 0).toLocaleString("id-ID");
}

async function autoDeleteCommand(message) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, 2000);
}
