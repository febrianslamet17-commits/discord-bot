const { google } = require("googleapis");

// ================= GOOGLE AUTH =================
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getSheetsClient() {
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// ================= HELPER =================
async function readRange(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });
  return res.data.values || [];
}

// ================= COMMAND ENGINE =================
async function getCommands() {
  return await readRange("COMMANDS!A2:E");
}

async function getResponses() {
  return await readRange("RESPONSES!A2:B");
}

// ================= STOCK + PRICE =================
async function getStockView() {
  const itemsRow = await readRange("BOT_VIEW!B6:T6");
  const totalsRow = await readRange("BOT_VIEW!B21:T21");
  const pricesCol = await readRange("BOT_VIEW!D2:D");

  return {
    items: itemsRow[0] || [],
    totals: totalsRow[0] || [],
    prices: pricesCol.map((r) => r[0]) || [],
  };
}

module.exports = {
  getCommands,
  getResponses,
  getStockView,
};
