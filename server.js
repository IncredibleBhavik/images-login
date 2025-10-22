const express = require('express');  // Import Express for the server
const bodyParser = require('body-parser');  // Import body-parser to handle JSON
const XLSX = require('xlsx');  // Import xlsx for Excel operations
const fs = require('fs');  // Built-in Node.js module for file system
const path = require('path');  // Built-in Node.js module for file paths

const app = express();  // Create an Express app
const PORT = process.env.PORT || 3000;  // Port for the server (you can change this if needed)

// Middleware to parse JSON requests
app.use(bodyParser.json());
// Serve static files (like your HTML) from a 'public' folder
app.use(express.static('public'));

const { google } = require('googleapis');
// const credentials = require('./credentials.json');
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);


// Authenticate with Google Sheets
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Replace with your actual Google Sheet ID
const SPREADSHEET_ID = '1dlhWb_ISr3tGms3UJJFOotC0qADVLiJ_t_nc8kaDBnM';


// Endpoint to handle email submission (POST request from the form)
// app.post('/submit-email', (req, res) => {
//     const email = req.body.email;  // Get email from request body

//     // Basic validation: Check if email is provided and looks valid
//     if (!email || !email.includes('@')) {
//         return res.status(400).json({ error: 'Invalid email' });  // Send error response
//     }

//     // Path to the Excel file (will be created if it doesn't exist)
//     const filePath = path.join(__dirname, 'emails.xlsx');

//     let workbook;
//     if (fs.existsSync(filePath)) {
//         // If file exists, load it
//         workbook = XLSX.readFile(filePath);
//     } else {
//         // If not, create a new workbook with a sheet named 'Emails'
//         workbook = XLSX.utils.book_new();
//         workbook.SheetNames.push('Emails');
//         workbook.Sheets['Emails'] = XLSX.utils.aoa_to_sheet([['Email', 'Timestamp']]);  // Headers
//     }

//     // Get the worksheet and existing data
//     const worksheet = workbook.Sheets['Emails'];
//     const data = XLSX.utils.sheet_to_json(worksheet);

//     // Add new row: Email and current timestamp
//     data.push({ Email: email, Timestamp: new Date().toISOString() });

//     // Update the sheet with new data
//     workbook.Sheets['Emails'] = XLSX.utils.json_to_sheet(data);

//     // Save the file
//     XLSX.writeFile(workbook, filePath);

//     // Send success response
//     res.json({ message: 'Email stored successfully' });
// });

app.post('/submit-email', async (req, res) => {
  const email = req.body.email;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    // Append the email and timestamp to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Email Data!A:B', // Adjust if your sheet name differs
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[email, new Date().toISOString()]],
      },
    });

    res.json({ message: 'Email stored successfully in Google Sheets' });
  } catch (error) {
    console.error('Error adding to Google Sheets:', error);
    res.status(500).json({ error: 'Failed to save to Google Sheets' });
  }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});