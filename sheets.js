const { google } = require("googleapis");

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getSheetsClient() {
  // 🔑 INI YANG KURANG
  await auth.authorize();

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function readRange(range) {
  const sheets = await getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });

  return res.data.values || [];
}

async function getCommands() {
  return await readRange("COMMANDS!A2:E");
}

async function getResponses() {
  return await readRange("RESPONSES!A2:B");
}

module.exports = {
  getCommands,
  getResponses,
};
