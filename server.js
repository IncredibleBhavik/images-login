// server.js
// Final production-ready server with Google Sheets integration and Excel fallback.

const express = require('express');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // serve your index.html in /public

// ------------------ Helpers for Google Credentials ------------------
function getCredentialsFromEnv() {
    // Priority: base64 env var (recommended) -> raw JSON env var
    const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    const raw = process.env.GOOGLE_CREDENTIALS;

    if (b64) {
        try {
            const json = Buffer.from(b64, 'base64').toString('utf8');
            return JSON.parse(json);
        } catch (err) {
            console.error('Failed to parse GOOGLE_CREDENTIALS_BASE64:', err.message);
            return null;
        }
    }

    if (raw) {
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.error('Failed to parse GOOGLE_CREDENTIALS (raw):', err.message);
            return null;
        }
    }

    return null;
}

const credentials = getCredentialsFromEnv();
const SPREADSHEET_ID = (process.env.SPREADSHEET_ID || '').trim(); // set this in Render env

if (!credentials) {
    console.warn('No Google credentials found in environment (GOOGLE_CREDENTIALS_BASE64 or GOOGLE_CREDENTIALS). Google Sheets will be disabled until you set them.');
} else {
    console.log('Google credentials detected. service account email (if present):', credentials.client_email || 'N/A');
}
if (!SPREADSHEET_ID) {
    console.warn('No SPREADSHEET_ID found in environment. Set SPREADSHEET_ID to your sheet ID.');
}

// ------------------ Google Sheets append function ------------------
async function appendToGoogleSheet(email) {
    if (!credentials) {
        throw new Error('Missing Google credentials');
    }
    if (!SPREADSHEET_ID) {
        throw new Error('Missing SPREADSHEET_ID');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const res = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Email Data!A:B'
        , // change if your sheet name is different
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[email, new Date().toISOString()]],
        },
    });

    return res;
}

// ------------------ Route: submit email ------------------
app.post('/submit-email', async (req, res) => {
    const email = req.body.email;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    // Try Google Sheets first
    if (credentials && SPREADSHEET_ID) {
        try {
            const sheetsRes = await appendToGoogleSheet(email);
            console.log('Google Sheets append success, status:', sheetsRes.status);
            return res.json({ message: 'Email stored successfully in Google Sheets' });
        } catch (err) {
            console.error('Error adding to Google Sheets:', err.message || err);
            if (err.response && err.response.data) {
                console.error('Sheets API response:', JSON.stringify(err.response.data));
            }
            // fall through to Excel fallback
        }
    } else {
        console.log('Skipping Google Sheets because credentials or SPREADSHEET_ID missing.');
    }

    // Fallback: save to local Excel file in server filesystem
    try {
        const filePath = path.join(__dirname, 'emails.xlsx');
        let workbook;
        if (fs.existsSync(filePath)) {
            workbook = XLSX.readFile(filePath);
        } else {
            workbook = XLSX.utils.book_new();
            workbook.SheetNames.push('Emails');
            workbook.Sheets['Emails'] = XLSX.utils.aoa_to_sheet([['Email', 'Timestamp']]);
        }

        const worksheet = workbook.Sheets['Emails'];
        const data = XLSX.utils.sheet_to_json(worksheet);
        data.push({ Email: email, Timestamp: new Date().toISOString() });
        workbook.Sheets['Emails'] = XLSX.utils.json_to_sheet(data);
        XLSX.writeFile(workbook, filePath);

        console.log('Saved email to local Excel fallback:', email);
        return res.json({ message: 'Email stored locally (fallback) because Sheets failed or not configured' });
    } catch (writeErr) {
        console.error('Failed to write local Excel fallback:', writeErr);
        return res.status(500).json({ error: 'Failed to save email (sheets + fallback both failed)' });
    }
});

// ------------------ Optional: Download the local Excel file ------------------
app.get('/download', (req, res) => {
    const filePath = path.join(__dirname, 'emails.xlsx');
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('No local emails.xlsx file found');
    }
    res.download(filePath, 'emails.xlsx', (err) => {
        if (err) console.error('Error sending file:', err);
    });
});

// ------------------ Health endpoint ------------------
app.get('/health', (req, res) => res.json({ status: 'ok', googleConfigured: !!credentials && !!SPREADSHEET_ID }));

// ------------------ Start server ------------------
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
