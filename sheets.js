const { google } = require("googleapis");

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getSheetsClient() {
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function readRange(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });
  return res.data.values || [];
}

// ================= STOCK MATRIX (ASLI + DETAIL AKUN) =================
async function getStockMatrix() {
  const itemsRow = await readRange("STOCK_MATRIX!B6:T6");
  const totalsRow = await readRange("STOCK_MATRIX!B21:T21");
  const pricesRow = await readRange("STOCK_MATRIX!B23:T23");

  // TAMBAHAN (UNTUK STAFF)
  const owners = (await readRange("STOCK_MATRIX!A7:A20")).flat();
  const perOwner = await readRange("STOCK_MATRIX!B7:T20");

  return {
    items: itemsRow[0] || [],
    totals: totalsRow[0] || [],
    prices: pricesRow[0] || [],
    owners,
    perOwner,
  };
}

// ================= GENERIC LIST (FRUIT / GP) =================
async function getSimpleList(sheet) {
  const rows = await readRange(`${sheet}!A2:B`);
  return rows
    .filter(r => r[0])
    .map(r => ({
      name: r[0],
      price: r[1] || null,
    }));
}

module.exports = {
  getStockMatrix,
  getSimpleList,
};
