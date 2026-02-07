console.log("ENV CHECK");
console.log("GOOGLE_CLIENT_EMAIL ADA:", !!process.env.GOOGLE_CLIENT_EMAIL);
console.log("GOOGLE_PRIVATE_KEY ADA:", !!process.env.GOOGLE_PRIVATE_KEY);
console.log("GOOGLE_SHEET_ID ADA:", !!process.env.GOOGLE_SHEET_ID);

const { google } = require("googleapis");

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets.readonly"]
);

const sheets = google.sheets({ version: "v4", auth });

async function readRange(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
  });

  return res.data.values || [];
}

async function getCommands() {
  // A2:E → lewati header
  return await readRange("COMMANDS!A2:E");
}

async function getResponses() {
  // A2:B → lewati header
  return await readRange("RESPONSES!A2:B");
}

module.exports = {
  getCommands,
  getResponses,
};
