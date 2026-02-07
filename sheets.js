const { google } = require("googleapis");

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getClient() {
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function read(range) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });
  return res.data.values || [];
}

// ================= STOCK =================
async function getStockMatrix() {
  return {
    items: (await read("STOCK_MATRIX!B6:T6"))[0] || [],
    totals: (await read("STOCK_MATRIX!B21:T21"))[0] || [],
    prices: (await read("STOCK_MATRIX!B23:T23"))[0] || [],
    owners: (await read("STOCK_MATRIX!A7:A20")).flat(),
    perOwner: await read("STOCK_MATRIX!B7:T20"),
  };
}

// ================= GENERIC LIST =================
async function getList(sheet) {
  const rows = await read(`${sheet}!A2:B`);
  return rows
    .filter(r => r[0])
    .map(r => ({
      name: r[0],
      price: r[1] || null,
    }));
}

module.exports = {
  getStockMatrix,
  getList,
};
